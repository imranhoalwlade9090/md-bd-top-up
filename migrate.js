import fs from "node:fs/promises";
import "dotenv/config";
import pg from "pg";

const required = ["DATABASE_URL"];
for (const name of required) {
  if (!process.env[name]) throw new Error(`Missing required environment variable: ${name}`);
}

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false });
try {
  await pool.query(await fs.readFile(new URL("./db/schema.sql", import.meta.url), "utf8"));
  console.log("Cloud SQL schema applied.");
} finally {
  await pool.end();
}
