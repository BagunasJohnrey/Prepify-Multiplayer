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
    const result = await pool.query(
      "SELECT id, username, email, avatar_url, hearts, xp, last_heart_update, login_streak, longest_streak, bookmarked_quizzes, role, password_hash, google_id, email_verified, profile_complete FROM users WHERE username = $1",
      [username]
    );
    return result.rows[0];
  },

  async findByGoogleId(googleId) {
    const result = await pool.query(
      "SELECT id, username, email, avatar_url, hearts, xp, last_heart_update, login_streak, longest_streak, bookmarked_quizzes, role, password_hash, google_id, email_verified, profile_complete FROM users WHERE google_id = $1",
      [googleId]
    );
    return result.rows[0];
  },

  async findByEmail(email) {
    const result = await pool.query(
      "SELECT id, username, email, avatar_url, hearts, xp, last_heart_update, login_streak, longest_streak, bookmarked_quizzes, role, password_hash, google_id, email_verified, profile_complete FROM users WHERE email = $1",
      [email]
    );
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
    const result = await pool.query(
      "SELECT id, username, email, avatar_url, hearts, xp, last_heart_update, login_streak, longest_streak, bookmarked_quizzes, role, password_hash, google_id, email_verified, profile_complete FROM users WHERE id = $1",
      [id]
    );
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

  async updateStreak(id) {
    // Do ALL date logic in SQL to avoid JS timezone issues
    const { rows } = await pool.query(
      `SELECT 
        last_login_date, 
        login_streak, 
        longest_streak, 
        xp,
        CURRENT_DATE as today,
        CASE 
          WHEN last_login_date = CURRENT_DATE THEN 'same_day'
          WHEN last_login_date = CURRENT_DATE - 1 THEN 'yesterday'
          ELSE 'older'
        END as streak_status
      FROM users WHERE id = $1`,
      [id]
    );
    const user = rows[0];
    if (!user) return null;

    const status = user.streak_status;

    if (status === 'same_day') {
      return { streak: user.login_streak, bonusXp: 0, longest: user.longest_streak };
    }

    let newStreak;
    if (status === 'yesterday') {
      newStreak = user.login_streak + 1;
    } else {
      newStreak = 1;
    }

    const bonusXp = Math.min(50, 10 + (newStreak - 1) * 5);
    const longest = Math.max(user.longest_streak, newStreak);

    await pool.query(
      "UPDATE users SET login_streak = $1, longest_streak = $2, last_login_date = CURRENT_DATE, xp = xp + $3 WHERE id = $4",
      [newStreak, longest, bonusXp, id]
    );

    return { streak: newStreak, bonusXp, longest };
  },

  async updateHearts(id, hearts, lastHeartUpdate) {
    await pool.query(
      "UPDATE users SET hearts = $1, last_heart_update = $2 WHERE id = $3",
      [hearts, lastHeartUpdate, id]
    );
  },

  // Returns the current heart state with `last_heart_update` expressed as an
  // absolute Unix epoch in milliseconds. Doing the conversion in SQL keeps the
  // regeneration math independent of any timezone mismatch between the database
  // session and the Node process (which previously caused hearts to instantly
  // "regenerate" right after being lost).
  async getRawHearts(id) {
    const { rows } = await pool.query(
      "SELECT hearts, EXTRACT(EPOCH FROM last_heart_update) * 1000 AS last_ms FROM users WHERE id = $1",
      [id]
    );
    return rows[0];
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
  },

  async toggleBookmark(id, quizId) {
    const { rows } = await pool.query("SELECT bookmarked_quizzes FROM users WHERE id = $1", [id]);
    const current = rows[0].bookmarked_quizzes || [];
    let updated;
    if (current.includes(quizId)) {
      updated = current.filter(q => q !== quizId);
    } else {
      updated = [...current, quizId];
    }
    await pool.query("UPDATE users SET bookmarked_quizzes = $1 WHERE id = $2", [updated, id]);
    return updated;
  },

  async getBookmarks(id) {
    const { rows } = await pool.query(
      `SELECT q.* FROM quizzes q
       JOIN users u ON u.id = $1
       WHERE q.id = ANY(u.bookmarked_quizzes)
       ORDER BY q.created_at DESC`,
      [id]
    );
    return rows;
  },

  async setVerificationToken(id, token, expires) {
    await pool.query(
      "UPDATE users SET email_verification_token = $1, email_verification_expires = $2 WHERE id = $3",
      [token, expires, id]
    );
  },

  async findByVerificationToken(token) {
    const { rows } = await pool.query(
      "SELECT * FROM users WHERE email_verification_token = $1 AND email_verification_expires > NOW()",
      [token]
    );
    return rows[0];
  },

  async markEmailVerified(id) {
    await pool.query(
      "UPDATE users SET email_verified = true, email_verification_token = NULL, email_verification_expires = NULL WHERE id = $1",
      [id]
    );
  },

  async isEmailVerifiedByToken(token) {
    const { rows } = await pool.query(
      "SELECT email_verified FROM users WHERE email_verification_token = $1",
      [token]
    );
    return rows[0]?.email_verified || false;
  },

  async setResetToken(id, token, expires) {
    await pool.query(
      "UPDATE users SET password_reset_token = $1, password_reset_expires = $2 WHERE id = $3",
      [token, expires, id]
    );
  },

  async findByResetToken(token) {
    const { rows } = await pool.query(
      "SELECT * FROM users WHERE password_reset_token = $1 AND password_reset_expires > NOW()",
      [token]
    );
    return rows[0];
  },

  async clearResetToken(id) {
    await pool.query(
      "UPDATE users SET password_reset_token = NULL, password_reset_expires = NULL WHERE id = $1",
      [id]
    );
  },

  async updatePassword(id, hash) {
    await pool.query("UPDATE users SET password_hash = $1 WHERE id = $2", [hash, id]);
  },

  async getLeaderboard(limit = 50, offset = 0, sortBy = 'xp') {
    const orderBy = sortBy === 'streak'
      ? 'ORDER BY longest_streak DESC, xp DESC'
      : 'ORDER BY xp DESC';
    const { rows } = await pool.query(
      `SELECT id, username, avatar_url, xp, login_streak, longest_streak
       FROM users
       ${orderBy}
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );
    return rows;
  },

  async getLeaderboardCount() {
    const { rows } = await pool.query('SELECT COUNT(*) FROM users');
    return parseInt(rows[0].count);
  },

  async getRank(id, sortBy = 'xp') {
    if (sortBy === 'streak') {
      const { rows } = await pool.query(
        `SELECT (COUNT(*) + 1) as rank
         FROM users WHERE longest_streak > (SELECT longest_streak FROM users WHERE id = $1)`,
        [id]
      );
      return parseInt(rows[0].rank);
    }
    const { rows } = await pool.query(
      `SELECT (COUNT(*) + 1) as rank
       FROM users WHERE xp > (SELECT xp FROM users WHERE id = $1)`,
      [id]
    );
    return parseInt(rows[0].rank);
  },

  async getQuizLeaderboard(quizId, limit = 20) {
    const { rows } = await pool.query(
      `SELECT u.username, u.avatar_url, r.percentage, r.score, r.total_questions, r.completed_at
       FROM results r
       JOIN users u ON r.user_id = u.id
       WHERE r.quiz_id = $1
       ORDER BY r.percentage DESC, r.score DESC
       LIMIT $2`,
      [quizId, limit]
    );
    return rows;
  },

  async getFriends(id) {
    const { rows } = await pool.query(
      `SELECT id, username, avatar_url, login_streak
       FROM users WHERE id = ANY(
         SELECT unnest(friends) FROM users WHERE id = $1
       )`,
      [id]
    );
    return rows;
  },

  async addFriend(id, friendId) {
    if (id === friendId) throw new Error("Cannot add yourself");
    const { rows } = await pool.query("SELECT friends FROM users WHERE id = $1", [id]);
    const current = rows[0].friends || [];
    if (current.includes(friendId)) return current;
    const updated = [...current, friendId];
    await pool.query("UPDATE users SET friends = $1 WHERE id = $2", [updated, id]);
    return updated;
  },

  async removeFriend(id, friendId) {
    const { rows } = await pool.query("SELECT friends FROM users WHERE id = $1", [id]);
    const current = rows[0].friends || [];
    const updated = current.filter(f => f !== friendId);
    await pool.query("UPDATE users SET friends = $1 WHERE id = $2", [updated, id]);
    return updated;
  },

  async findByUsernameExact(username) {
    const { rows } = await pool.query("SELECT id, username FROM users WHERE username = $1", [username]);
    return rows[0];
  },

  async searchUsers(query, currentUserId, limit = 10) {
    const { rows } = await pool.query(
      `SELECT id, username, avatar_url 
       FROM users 
       WHERE username ILIKE $1 
       AND id != $2
       ORDER BY username ASC
       LIMIT $3`,
      [`%${query}%`, currentUserId, limit]
    );
    return rows;
  },
};