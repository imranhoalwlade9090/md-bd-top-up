import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import "dotenv/config";
import express from "express";
import helmet from "helmet";
import pg from "pg";
import admin from "firebase-admin";
import { Resend } from "resend";
import { z } from "zod";

const required = ["DATABASE_URL", "FIREBASE_PROJECT_ID", "FIREBASE_CLIENT_EMAIL", "FIREBASE_PRIVATE_KEY", "DOWNLOAD_SECRET", "RESEND_API_KEY", "EMAIL_FROM", "OWNER_NOTIFICATION_EMAIL"];
for (const name of required) if (!process.env[name]) throw new Error(`Missing required environment variable: ${name}`);
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false });
admin.initializeApp({ credential: admin.credential.cert({ projectId: process.env.FIREBASE_PROJECT_ID, clientEmail: process.env.FIREBASE_CLIENT_EMAIL, privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n") }) });
const app = express();
const port = Number(process.env.PORT || 3000);
const documentDirectory = path.resolve(process.env.DOCUMENT_DIR || "./documents");
app.use(helmet());
app.use(express.json({ limit: "50kb" }));
app.get("/firebase-config.js", (_request, response) => {
  const config = { apiKey: process.env.FIREBASE_WEB_API_KEY, authDomain: process.env.FIREBASE_AUTH_DOMAIN, projectId: process.env.FIREBASE_PROJECT_ID, appId: process.env.FIREBASE_WEB_APP_ID };
  if (Object.values(config).some((value) => !value)) return response.status(503).type("text").send("window.MB_FIREBASE_CONFIG_ERROR='Firebase web configuration is missing';");
  return response.type("application/javascript").send(`window.MB_FIREBASE_CONFIG=${JSON.stringify(config)};`);
});
app.use(express.static("."));
const orderSchema = z.object({
  customerName: z.string().trim().min(1).max(120), email: z.string().trim().email().max(254), phone: z.string().trim().regex(/^01\d{9}$/),
  productName: z.string().trim().min(1).max(120), packageName: z.string().trim().min(1).max(120), amount: z.number().int().positive(),
  payment: z.enum(["bKash", "Nagad", "Sun Money"]), transactionId: z.string().trim().min(4).max(100),
  accountType: z.string().trim().max(40).optional().nullable(), accountInfo: z.record(z.string().trim().max(500)).optional().nullable(), description: z.string().trim().max(2000).optional().nullable()
});
const bearer = (request) => request.get("authorization")?.replace(/^Bearer\s+/i, "") || "";
async function authenticated(request, response, next) {
  try {
    const token = bearer(request);
    if (!token) return response.status(401).json({ error: "Sign-in required" });
    request.user = await admin.auth().verifyIdToken(token);
    return next();
  } catch {
    return response.status(401).json({ error: "Invalid or expired sign-in session" });
  }
}
async function administrator(request, response, next) {
  return authenticated(request, response, async () => {
    const allowed = request.user.admin === true || (process.env.ADMIN_UIDS || "").split(",").map((value) => value.trim()).includes(request.user.uid);
    if (!allowed) return response.status(403).json({ error: "Administrator access required" });
    return next();
  });
}
const safeDocumentName = (name) => name && name === path.basename(name) ? name : null;
const now = () => new Date().toISOString();
function createDownloadToken(orderId, documentName) {
  const expires = Date.now() + 86400000;
  const payload = `${orderId}:${documentName}:${expires}`;
  const signature = crypto.createHmac("sha256", process.env.DOWNLOAD_SECRET).update(payload).digest("hex");
  return Buffer.from(`${payload}:${signature}`).toString("base64url");
}
function verifyDownloadToken(token) {
  try {
    const decoded = Buffer.from(token, "base64url").toString();
    const split = decoded.lastIndexOf(":");
    const payload = decoded.slice(0, split);
    const signature = decoded.slice(split + 1);
    const expected = crypto.createHmac("sha256", process.env.DOWNLOAD_SECRET).update(payload).digest("hex");
    if (signature.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null;
    const [orderId, documentName, expires] = payload.split(":");
    return Number(expires) >= Date.now() ? { orderId, documentName } : null;
  } catch { return null; }
}
async function queueNotifications(order) {
  const values = [[order.id, process.env.OWNER_NOTIFICATION_EMAIL, "owner_order"], [order.id, order.customer_email, "customer_order"]];
  if (order.payment_status === "Successful") values.push([order.id, process.env.OWNER_NOTIFICATION_EMAIL, "owner_payment"], [order.id, order.customer_email, "customer_payment"]);
  for (const [id, recipient, kind] of values) await pool.query("INSERT INTO email_deliveries (order_id, recipient, kind) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING", [id, recipient, kind]);
}
async function processPendingEmails() {
  const { rows } = await pool.query("SELECT * FROM email_deliveries WHERE status='pending' AND attempts < 5 ORDER BY created_at LIMIT 20");
  const resend = new Resend(process.env.RESEND_API_KEY);
  for (const delivery of rows) {
    try {
      const { rows: orders } = await pool.query("SELECT * FROM orders WHERE id=$1", [delivery.order_id]);
      const order = orders[0];
      if (!order) throw new Error("Order no longer exists");
      const lines = [`Order ID: ${order.id}`, `Product: ${order.product_name}`, `Package: ${order.package_name}`, `Amount: ৳${order.amount.toLocaleString("en-BD")}`, `Payment status: ${order.payment_status}`, `Order status: ${order.order_status}`, `Customer: ${order.customer_name}`, `Email: ${order.customer_email}`, `Phone: ${order.phone}`, `Payment method: ${order.payment_method}`, `Transaction ID: ${order.transaction_id}`];
      if (order.document_name) lines.push(`Secure document: ${process.env.PUBLIC_ORIGIN}/api/orders/${order.id}/download/${createDownloadToken(order.id, order.document_name)}`);
      const result = await resend.emails.send({ from: process.env.EMAIL_FROM, to: delivery.recipient, subject: `${delivery.kind.includes("payment") ? "Payment verified" : "Order received"} — ${order.id}`, text: lines.join("\n") });
      if (result.error) throw new Error(result.error.message);
      await pool.query("UPDATE email_deliveries SET status='sent', sent_at=NOW(), attempts=attempts+1, last_error=NULL WHERE id=$1", [delivery.id]);
    } catch (error) {
      await pool.query("UPDATE email_deliveries SET attempts=attempts+1, last_error=$1 WHERE id=$2", [error.message, delivery.id]);
    }
  }
}
app.get("/healthz", async (_request, response) => {
  try { await pool.query("SELECT 1"); return response.json({ ok: true, database: "connected" }); }
  catch { return response.status(503).json({ ok: false, database: "unavailable" }); }
});
app.post("/api/orders", authenticated, async (request, response) => {
  const parsed = orderSchema.safeParse(request.body);
  if (!parsed.success) return response.status(400).json({ error: "Invalid order details", details: parsed.error.flatten() });
  const order = parsed.data;
  const id = `MB${Date.now().toString().slice(-8)}${crypto.randomInt(100, 999)}`;
  try {
    await pool.query("INSERT INTO orders (id,firebase_uid,customer_name,customer_email,phone,product_name,package_name,amount,payment_method,transaction_id,account_type,account_info_json,description) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)", [id, request.user.uid, order.customerName, request.user.email || order.email, order.phone, order.productName, order.packageName, order.amount, order.payment, order.transactionId, order.accountType, order.accountInfo ? JSON.stringify(order.accountInfo) : null, order.description]);
    const { rows } = await pool.query("SELECT * FROM orders WHERE id=$1", [id]);
    await queueNotifications(rows[0]);
    void processPendingEmails();
    return response.status(201).json({ orderId: id, paymentStatus: "Pending", orderStatus: rows[0].order_status });
  } catch (error) {
    if (error.code === "23505") return response.status(409).json({ error: "This transaction has already been submitted." });
    console.error(error);
    return response.status(500).json({ error: "Unable to save order" });
  }
});
app.get("/api/orders/:id", authenticated, async (request, response) => {
  const { rows } = await pool.query("SELECT id,product_name,payment_status,order_status,created_at FROM orders WHERE id=$1 AND firebase_uid=$2", [request.params.id, request.user.uid]);
  return rows[0] ? response.json(rows[0]) : response.status(404).json({ error: "Order not found" });
});
app.get("/api/admin/orders", administrator, async (_request, response) => response.json((await pool.query("SELECT id,customer_name,customer_email,phone,product_name,package_name,amount,payment_method,transaction_id,payment_status,order_status,document_name,created_at FROM orders ORDER BY created_at DESC")).rows));
app.post("/api/admin/orders/:id/verify", administrator, async (request, response) => {
  const documentName = request.body?.documentName ? safeDocumentName(request.body.documentName) : null;
  if (request.body?.documentName && !documentName) return response.status(400).json({ error: "Invalid document name" });
  const result = await pool.query("UPDATE orders SET payment_status='Successful',order_status='Processing',document_name=$1,verified_at=NOW() WHERE id=$2 AND payment_status='Pending' RETURNING *", [documentName, request.params.id]);
  if (!result.rows[0]) return response.status(404).json({ error: "Pending order not found" });
  await queueNotifications(result.rows[0]);
  void processPendingEmails();
  return response.json({ orderId: result.rows[0].id, paymentStatus: "Successful", orderStatus: "Processing" });
});
app.post("/api/admin/email-retry", administrator, async (_request, response) => { await processPendingEmails(); return response.json({ ok: true }); });
app.get("/api/orders/:id/download/:token", authenticated, async (request, response) => {
  const token = verifyDownloadToken(request.params.token);
  if (!token || token.orderId !== request.params.id) return response.status(404).send("Download link expired or invalid");
  const { rows } = await pool.query("SELECT payment_status,document_name,firebase_uid FROM orders WHERE id=$1", [token.orderId]);
  const order = rows[0];
  if (!order || order.firebase_uid !== request.user.uid || order.payment_status !== "Successful" || order.document_name !== token.documentName) return response.status(403).send("Payment verification required");
  const file = path.resolve(documentDirectory, order.document_name);
  if (path.dirname(file) !== documentDirectory || !fs.existsSync(file)) return response.status(404).send("Document not found");
  return response.download(file, path.basename(file));
});
app.listen(port, () => console.log(`MB BD backend listening on port ${port}`));
