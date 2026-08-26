import dotenv from "dotenv";
dotenv.config();

import pool from "../config/db.js";

// Idempotent migration: ensures the users.xp column exists (the app requires it).
try {
  await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS xp INTEGER DEFAULT 0;");
  console.log("Migration complete: ensured users.xp column exists.");
  await pool.end();
  process.exit(0);
} catch (err) {
  console.error("Migration failed:", err.message);
  await pool.end().catch(() => {});
  process.exit(1);
}
