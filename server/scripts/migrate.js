import dotenv from "dotenv";
dotenv.config();

import pool from "../config/db.js";

try {
  // Existing columns
  await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS xp INTEGER DEFAULT 0;");

  // Google OAuth + profile columns
  await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS email VARCHAR(255);");
  await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url TEXT;");
  await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS google_id VARCHAR(255);");

  // Add unique constraint on google_id (only if not already constrained)
  await pool.query(`
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'users_google_id_key') THEN
        ALTER TABLE users ADD CONSTRAINT users_google_id_key UNIQUE (google_id);
      END IF;
    END $$;
  `);

  // Make password_hash optional for Google OAuth users
  await pool.query("ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL;");

  // Track whether user has completed onboarding (picked a username)
  await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_complete BOOLEAN DEFAULT false;");

  console.log("Migration complete: added email, avatar_url, google_id, profile_complete columns.");
  await pool.end();
  process.exit(0);
} catch (err) {
  console.error("Migration failed:", err.message);
  await pool.end().catch(() => {});
  process.exit(1);
}
