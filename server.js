import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import "dotenv/config";
import express from "express";
import helmet from "helmet";
import Database from "better-sqlite3";
import { Resend } from "resend";
import { z } from "zod";

const required = ["ADMIN_API_KEY", "DOWNLOAD_SECRET", "RESEND_API_KEY", "EMAIL_FROM", "OWNER_NOTIFICATION_EMAIL"];
for (const name of required) {
  if (!process.env[name]) throw new Error(`Missing required environment variable: ${name}`);
}

const port = Number(process.env.PORT || 3000);
const databasePath = path.resolve(process.env.DATABASE_PATH || "./data/orders.sqlite");
const documentDirectory = path.resolve(process.env.DOCUMENT_DIR || "./documents");
fs.mkdirSync(path.dirname(databasePath), { recursive: true });
const database = new Database(databasePath);
database.pragma("journal_mode = WAL");
database.exec(`
  CREATE TABLE IF NOT EXISTS orders (
    id TEXT PRIMARY KEY,
    customer_name TEXT NOT NULL,
    customer_email TEXT NOT NULL,
    phone TEXT NOT NULL,
    product_name TEXT NOT NULL,
    package_name TEXT NOT NULL,
    amount INTEGER NOT NULL,
    payment_method TEXT NOT NULL,
    transaction_id TEXT NOT NULL,
    account_type TEXT,
    account_info_json TEXT,
    description TEXT,
    payment_status TEXT NOT NULL DEFAULT 'Pending',
    order_status TEXT NOT NULL DEFAULT 'Awaiting payment verification',
    document_name TEXT,
    created_at TEXT NOT NULL,
    verified_at TEXT
  );
  CREATE UNIQUE INDEX IF NOT EXISTS orders_transaction_key ON orders(phone, transaction_id);
  CREATE TABLE IF NOT EXISTS email_deliveries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id TEXT NOT NULL REFERENCES orders(id),
    recipient TEXT NOT NULL,
    kind TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    attempts INTEGER NOT NULL DEFAULT 0,
    last_error TEXT,
    sent_at TEXT,
    created_at TEXT NOT NULL,
    UNIQUE(order_id, recipient, kind)
  );
`);

const app = express();
app.use(helmet());
app.use(express.json({ limit: "50kb" }));
app.use(express.static("."));
app.get("/healthz", (_request, response) => response.json({ ok: true }));

const orderSchema = z.object({
  customerName: z.string().trim().min(1).max(120),
  email: z.string().trim().email().max(254),
  phone: z.string().trim().regex(/^01\d{9}$/, "Enter a valid Bangladesh mobile number"),
  productName: z.string().trim().min(1).max(120),
  packageName: z.string().trim().min(1).max(120),
  amount: z.number().int().positive(),
  payment: z.enum(["bKash", "Nagad", "Sun Money"]),
  transactionId: z.string().trim().min(4).max(100),
  accountType: z.string().trim().max(40).optional().nullable(),
  accountInfo: z.record(z.string().trim().max(500)).optional().nullable(),
  description: z.string().trim().max(2000).optional().nullable()
});

function now() {
  return new Date().toISOString();
}

function adminAuthorized(request) {
  const supplied = request.get("authorization")?.replace(/^Bearer\s+/i, "") || "";
  const expected = process.env.ADMIN_API_KEY;
  return supplied.length === expected.length && crypto.timingSafeEqual(Buffer.from(supplied), Buffer.from(expected));
}

function safeDocumentName(documentName) {
  if (!documentName || documentName !== path.basename(documentName)) return null;
  return documentName;
}

function createDownloadToken(orderId, documentName) {
  const expires = Date.now() + 86400000;
  const payload = `${orderId}:${documentName}:${expires}`;
  const signature = crypto.createHmac("sha256", process.env.DOWNLOAD_SECRET).update(payload).digest("hex");
  return Buffer.from(`${payload}:${signature}`).toString("base64url");
}

function verifyDownloadToken(token) {
  try {
    const decoded = Buffer.from(token, "base64url").toString();
    const last = decoded.lastIndexOf(":");
    const signature = decoded.slice(last + 1);
    const payload = decoded.slice(0, last);
    const parts = payload.split(":");
    if (parts.length !== 3) return null;
    const [orderId, documentName, expiresText] = parts;
    const expires = Number(expiresText);
    const expected = crypto.createHmac("sha256", process.env.DOWNLOAD_SECRET).update(payload).digest("hex");
    if (!Number.isFinite(expires) || expires < Date.now() || signature.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null;
    return { orderId, documentName };
  } catch {
    return null;
  }
}

function queueNotifications(order) {
  const insert = database.prepare("INSERT OR IGNORE INTO email_deliveries (order_id, recipient, kind, created_at) VALUES (?, ?, ?, ?)");
  insert.run(order.id, process.env.OWNER_NOTIFICATION_EMAIL, "owner_order", now());
  insert.run(order.id, order.customer_email, "customer_order", now());
  if (order.payment_status === "Successful") insert.run(order.id, process.env.OWNER_NOTIFICATION_EMAIL, "owner_payment", now());
  if (order.payment_status === "Successful") insert.run(order.id, order.customer_email, "customer_payment", now());
}

async function deliverEmail(delivery) {
  const resend = new Resend(process.env.RESEND_API_KEY);
  const order = database.prepare("SELECT * FROM orders WHERE id = ?").get(delivery.order_id);
  if (!order) throw new Error("Order no longer exists");
  const subject = delivery.kind.includes("payment") ? `Payment verified — ${order.id}` : `Order received — ${order.id}`;
  const lines = [
    `Order ID: ${order.id}`,
    `Product: ${order.product_name}`,
    `Package: ${order.package_name}`,
    `Amount: ৳${order.amount.toLocaleString("en-BD")}`,
    `Payment status: ${order.payment_status}`,
    `Order status: ${order.order_status}`,
    `Customer: ${order.customer_name}`,
    `Customer email: ${order.customer_email}`,
    `Phone: ${order.phone}`,
    `Payment method: ${order.payment_method}`,
    `Transaction ID: ${order.transaction_id}`
  ];
  if (order.document_name) lines.push(`Secure document: ${process.env.PUBLIC_ORIGIN}/api/orders/${order.id}/download/${createDownloadToken(order.id, order.document_name)}`);
  const result = await resend.emails.send({ from: process.env.EMAIL_FROM, to: delivery.recipient, subject, text: lines.join("\n") });
  if (result.error) throw new Error(result.error.message);
  database.prepare("UPDATE email_deliveries SET status = 'sent', sent_at = ?, attempts = attempts + 1, last_error = NULL WHERE id = ?").run(now(), delivery.id);
}

async function processPendingEmails() {
  const rows = database.prepare("SELECT * FROM email_deliveries WHERE status = 'pending' AND attempts < 5 ORDER BY created_at LIMIT 20").all();
  for (const delivery of rows) {
    try {
      await deliverEmail(delivery);
    } catch (error) {
      database.prepare("UPDATE email_deliveries SET attempts = attempts + 1, last_error = ? WHERE id = ?").run(error.message, delivery.id);
    }
  }
}

app.post("/api/orders", (request, response) => {
  const parsed = orderSchema.safeParse(request.body);
  if (!parsed.success) return response.status(400).json({ error: "Invalid order details", details: parsed.error.flatten() });
  const order = parsed.data;
  const id = `MB${Date.now().toString().slice(-8)}${crypto.randomInt(100, 999)}`;
  try {
    database.prepare(`
      INSERT INTO orders (id, customer_name, customer_email, phone, product_name, package_name, amount, payment_method, transaction_id, account_type, account_info_json, description, created_at)
      VALUES (@id, @customerName, @email, @phone, @productName, @packageName, @amount, @payment, @transactionId, @accountType, @accountInfo, @description, @createdAt)
    `).run({ ...order, id, accountInfo: order.accountInfo ? JSON.stringify(order.accountInfo) : null, createdAt: now() });
    const saved = database.prepare("SELECT * FROM orders WHERE id = ?").get(id);
    queueNotifications(saved);
    void processPendingEmails();
    return response.status(201).json({ orderId: id, paymentStatus: "Pending", orderStatus: saved.order_status });
  } catch (error) {
    if (error.code === "SQLITE_CONSTRAINT_UNIQUE") return response.status(409).json({ error: "This transaction has already been submitted." });
    console.error(error);
    return response.status(500).json({ error: "Unable to save order" });
  }
});

app.get("/api/admin/orders", (request, response) => {
  if (!adminAuthorized(request)) return response.status(401).json({ error: "Unauthorized" });
  return response.json(database.prepare("SELECT id, customer_name, customer_email, phone, product_name, package_name, amount, payment_method, transaction_id, payment_status, order_status, document_name, created_at FROM orders ORDER BY created_at DESC").all());
});

app.get("/api/orders/:id", (request, response) => {
  const order = database.prepare("SELECT id, product_name, payment_status, order_status, created_at FROM orders WHERE id = ?").get(request.params.id);
  if (!order) return response.status(404).json({ error: "Order not found" });
  return response.json(order);
});

app.post("/api/admin/orders/:id/verify", async (request, response) => {
  if (!adminAuthorized(request)) return response.status(401).json({ error: "Unauthorized" });
  const documentName = request.body?.documentName ? safeDocumentName(request.body.documentName) : null;
  if (request.body?.documentName && !documentName) return response.status(400).json({ error: "Invalid document name" });
  const order = database.prepare("SELECT * FROM orders WHERE id = ?").get(request.params.id);
  if (!order) return response.status(404).json({ error: "Order not found" });
  if (order.payment_status !== "Pending") return response.status(409).json({ error: `Order is already ${order.payment_status}` });
  database.prepare("UPDATE orders SET payment_status = 'Successful', order_status = 'Processing', document_name = ?, verified_at = ? WHERE id = ?").run(documentName, now(), order.id);
  const updated = database.prepare("SELECT * FROM orders WHERE id = ?").get(order.id);
  queueNotifications(updated);
  void processPendingEmails();
  return response.json({ orderId: order.id, paymentStatus: updated.payment_status, orderStatus: updated.order_status });
});

app.post("/api/admin/email-retry", async (request, response) => {
  if (!adminAuthorized(request)) return response.status(401).json({ error: "Unauthorized" });
  await processPendingEmails();
  return response.json({ ok: true });
});

app.get("/api/orders/:id/download/:token", (request, response) => {
  const token = verifyDownloadToken(request.params.token);
  if (!token || token.orderId !== request.params.id) return response.status(404).send("Download link expired or invalid");
  const order = database.prepare("SELECT payment_status, document_name FROM orders WHERE id = ?").get(token.orderId);
  if (!order || order.payment_status !== "Successful" || order.document_name !== token.documentName) return response.status(403).send("Payment verification required");
  const file = path.resolve(documentDirectory, order.document_name);
  if (path.dirname(file) !== documentDirectory || !fs.existsSync(file)) return response.status(404).send("Document not found");
  return response.download(file, path.basename(file));
});

app.listen(port, () => console.log(`MB BD backend listening on port ${port}`));

export { app, database, processPendingEmails };
