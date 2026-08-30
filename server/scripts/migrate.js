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

  // Streak system columns
  await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_date DATE;");
  await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS login_streak INTEGER DEFAULT 0;");
  await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS longest_streak INTEGER DEFAULT 0;");

  // Bookmarks
  await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS bookmarked_quizzes INTEGER[] DEFAULT '{}';");

  // Email verification
  await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT false;");
  await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verification_token VARCHAR(255);");
  await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verification_expires TIMESTAMP;");

  // Password reset
  await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS password_reset_token VARCHAR(255);");
  await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS password_reset_expires TIMESTAMP;");

  // Create results table if not exists
  await pool.query(`
    CREATE TABLE IF NOT EXISTS results (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      quiz_id INTEGER NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
      score INTEGER NOT NULL,
      total_questions INTEGER NOT NULL DEFAULT 0,
      history JSONB NOT NULL,
      percentage INTEGER NOT NULL DEFAULT 0,
      completed_at TIMESTAMP DEFAULT NOW()
    );
  `);

  // Normalize a pre-existing results table that used an older schema
  // (total_items / created_at, no percentage / total_questions / completed_at).
  await pool.query(`
    DO $$ BEGIN
      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'results' AND column_name = 'total_items'
      ) AND NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'results' AND column_name = 'total_questions'
      ) THEN
        ALTER TABLE results RENAME COLUMN total_items TO total_questions;
      END IF;
    END $$;
  `);
  await pool.query("ALTER TABLE results ADD COLUMN IF NOT EXISTS total_questions INTEGER DEFAULT 0;");
  await pool.query("ALTER TABLE results ADD COLUMN IF NOT EXISTS percentage INTEGER DEFAULT 0;");
  await pool.query("ALTER TABLE results ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP;");
  await pool.query(`
    UPDATE results SET completed_at = created_at
    WHERE completed_at IS NULL AND created_at IS NOT NULL;
  `);

  // Share ID for public quiz sharing
  await pool.query("ALTER TABLE quizzes ADD COLUMN IF NOT EXISTS share_id VARCHAR(32) UNIQUE;");

  // Generate share_id for existing quizzes that don't have one
  await pool.query(`
    UPDATE quizzes 
    SET share_id = md5(random()::text || id::text) 
    WHERE share_id IS NULL;
  `);

  // Tags for granular categorization
  await pool.query("ALTER TABLE quizzes ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}';");

  // Friends list
  await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS friends INTEGER[] DEFAULT '{}';");

  // Index for faster history queries
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_results_user_id ON results(user_id);
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_results_completed_at ON results(completed_at DESC);
  `);

  console.log("Migration complete: added email, avatar_url, google_id, profile_complete, streak, bookmarks, email verification, password reset columns and results table.");
  await pool.end();
  process.exit(0);
} catch (err) {
  console.error("Migration failed:", err.message);
  await pool.end().catch(() => {});
  process.exit(1);
}
