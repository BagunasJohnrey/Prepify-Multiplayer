import pool from "../config/db.js";

export default {
  async getAll(course) {
    let query = "SELECT id, title, course, difficulty, description, items_count, created_at FROM quizzes";
    let params = [];

    if (course && course !== "null" && course !== "" && course !== "All") {
      query += " WHERE course = $1";
      params.push(course);
    }
    
    query += " ORDER BY created_at DESC";
    const { rows } = await pool.query(query, params);
    return rows;
  },

  async getAllPaginated(course, page = 1, limit = 12) {
    let baseQuery = "FROM quizzes";
    let params = [];
    let paramIndex = 1;

    if (course && course !== "null" && course !== "" && course !== "All") {
      baseQuery += ` WHERE course = $${paramIndex}`;
      params.push(course);
      paramIndex++;
    }

    const countResult = await pool.query(`SELECT COUNT(*) ${baseQuery}`, params);
    const total = parseInt(countResult.rows[0].count);

    const dataQuery = `SELECT id, title, course, difficulty, description, items_count, created_at ${baseQuery} ORDER BY created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    const offset = (page - 1) * limit;
    const { rows } = await pool.query(dataQuery, [...params, limit, offset]);

    return {
      quizzes: rows,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  },

  async findById(id) {
    const { rows } = await pool.query("SELECT * FROM quizzes WHERE id = $1", [id]);
    return rows[0];
  },

  async create(title, course, difficulty, description, questions, itemsCount) {
    const result = await pool.query(
      "INSERT INTO quizzes (title, course, difficulty, description, questions, items_count) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *",
      [title, course, difficulty, description, questions, itemsCount]
    );
    return result.rows[0];
  },

  async delete(id) {
    await pool.query("DELETE FROM results WHERE quiz_id = $1", [id]); // Delete dependent results first
    await pool.query("DELETE FROM quizzes WHERE id = $1", [id]);
  }
};