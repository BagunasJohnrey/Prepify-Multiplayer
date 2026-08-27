import pool from "../config/db.js";
import crypto from "crypto";

export default {
  async getAll(course) {
    let query = "SELECT id, title, course, difficulty, description, items_count, tags, share_id, created_at FROM quizzes";
    let params = [];

    if (course && course !== "null" && course !== "" && course !== "All") {
      query += " WHERE course = $1";
      params.push(course);
    }
    
    query += " ORDER BY created_at DESC";
    const { rows } = await pool.query(query, params);
    return rows;
  },

  async getAllPaginated(course, page = 1, limit = 12, search = '', difficulty = '', tag = '') {
    let baseQuery = "FROM quizzes";
    let params = [];
    let paramIndex = 1;

    const conditions = [];
    if (course && course !== "null" && course !== "" && course !== "All") {
      conditions.push(`course = $${paramIndex}`);
      params.push(course);
      paramIndex++;
    }
    if (difficulty && difficulty !== "null" && difficulty !== "" && difficulty !== "All") {
      conditions.push(`difficulty = $${paramIndex}`);
      params.push(difficulty);
      paramIndex++;
    }
    if (search) {
      conditions.push(`(title ILIKE $${paramIndex} OR description ILIKE $${paramIndex})`);
      params.push(`%${search}%`);
      paramIndex++;
    }
    if (tag) {
      conditions.push(`$${paramIndex} = ANY(tags)`);
      params.push(tag);
      paramIndex++;
    }

    if (conditions.length > 0) {
      baseQuery += " WHERE " + conditions.join(" AND ");
    }

    const countResult = await pool.query(`SELECT COUNT(*) ${baseQuery}`, params);
    const total = parseInt(countResult.rows[0].count);

    const dataQuery = `SELECT id, title, course, difficulty, description, items_count, tags, share_id, created_at ${baseQuery} ORDER BY created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    const offset = (page - 1) * limit;
    const { rows } = await pool.query(dataQuery, [...params, limit, offset]);

    return {
      quizzes: rows,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  },

  async getAllTags() {
    const { rows } = await pool.query(
      "SELECT DISTINCT unnest(tags) as tag, COUNT(*) as count FROM quizzes WHERE array_length(tags, 1) > 0 GROUP BY tag ORDER BY count DESC LIMIT 30"
    );
    return rows;
  },

  async findById(id) {
    const { rows } = await pool.query("SELECT * FROM quizzes WHERE id = $1", [id]);
    return rows[0];
  },

  async create(title, course, difficulty, description, questions, itemsCount, tags = []) {
    const shareId = crypto.randomBytes(12).toString("hex");
    const result = await pool.query(
      "INSERT INTO quizzes (title, course, difficulty, description, questions, items_count, share_id, tags) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *",
      [title, course, difficulty, description, questions, itemsCount, shareId, tags]
    );
    return result.rows[0];
  },

  async findByShareId(shareId) {
    const { rows } = await pool.query("SELECT * FROM quizzes WHERE share_id = $1", [shareId]);
    return rows[0];
  },

  async delete(id) {
    await pool.query("DELETE FROM results WHERE quiz_id = $1", [id]); // Delete dependent results first
    await pool.query("DELETE FROM quizzes WHERE id = $1", [id]);
  }
};