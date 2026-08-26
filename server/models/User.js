import pool from "../config/db.js";

export default {
  async create(username, passwordHash) {
    const result = await pool.query(
      "INSERT INTO users (username, password_hash, role, xp) VALUES ($1, $2, 'user', 0) RETURNING id, username",
      [username, passwordHash]
    );
    return result.rows[0];
  },

  async createGoogleUser(username, email, avatarUrl, googleId) {
    const result = await pool.query(
      "INSERT INTO users (username, email, avatar_url, google_id, role, xp) VALUES ($1, $2, $3, $4, 'user', 0) RETURNING *",
      [username, email, avatarUrl, googleId]
    );
    return result.rows[0];
  },

  async findByUsername(username) {
    const result = await pool.query("SELECT * FROM users WHERE username = $1", [username]);
    return result.rows[0];
  },

  async findByGoogleId(googleId) {
    const result = await pool.query("SELECT * FROM users WHERE google_id = $1", [googleId]);
    return result.rows[0];
  },

  async findByEmail(email) {
    const result = await pool.query("SELECT * FROM users WHERE email = $1", [email]);
    return result.rows[0];
  },

  async createAdmin(username, passwordHash) {
    const result = await pool.query(
      "INSERT INTO users (username, password_hash, role, xp) VALUES ($1, $2, 'admin', 0) RETURNING id, username, role",
      [username, passwordHash]
    );
    return result.rows[0];
  },

  async setAdmin(username) {
    await pool.query("UPDATE users SET role = 'admin' WHERE username = $1", [username]);
  },

  async findById(id) {
    const result = await pool.query("SELECT * FROM users WHERE id = $1", [id]);
    return result.rows[0];
  },

  async updateProfile(id, fields) {
    const allowed = ["username", "email", "avatar_url"];
    const updates = [];
    const values = [];
    let idx = 1;

    for (const key of allowed) {
      if (fields[key] !== undefined) {
        updates.push(`${key} = $${idx}`);
        values.push(fields[key]);
        idx++;
      }
    }

    if (updates.length === 0) return;

    values.push(id);
    await pool.query(`UPDATE users SET ${updates.join(", ")} WHERE id = $${idx}`, values);
  },

  async linkGoogleAccount(id, googleId, avatarUrl) {
    await pool.query(
      "UPDATE users SET google_id = $1, avatar_url = COALESCE($2, avatar_url) WHERE id = $3",
      [googleId, avatarUrl, id]
    );
  },

  async markProfileComplete(id) {
    await pool.query("UPDATE users SET profile_complete = true WHERE id = $1", [id]);
  },

  async updateHearts(id, hearts, lastHeartUpdate) {
    await pool.query(
      "UPDATE users SET hearts = $1, last_heart_update = $2 WHERE id = $3",
      [hearts, lastHeartUpdate, id]
    );
  },

  async decrementHeart(id) {
    await pool.query(
      "UPDATE users SET hearts = GREATEST(0, hearts - 1), last_heart_update = NOW() WHERE id = $1",
      [id]
    );
  },

  async addXp(id, amount) {
    await pool.query(
      "UPDATE users SET xp = xp + $1 WHERE id = $2",
      [amount, id]
    );
  },

  async buyHeart(id, cost) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      
      const { rows } = await client.query("SELECT xp, hearts FROM users WHERE id = $1", [id]);
      const user = rows[0];

      if (user.xp < cost) throw new Error("Not enough XP");
      
      await client.query("UPDATE users SET xp = xp - $1, hearts = hearts + 1 WHERE id = $2", [cost, id]);
      
      await client.query('COMMIT');
      return true;
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  }
};