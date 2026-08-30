import pool from "../config/db.js";

export default {
  async create(userId, quizId, score, total, history, percentage) {
    const result = await pool.query(
      `INSERT INTO results (user_id, quiz_id, score, total_questions, history, percentage, completed_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW()) RETURNING *`,
      [userId, quizId, score, total, JSON.stringify(history), percentage]
    );
    return result.rows[0];
  },

  async getUserHistory(userId, page = 1, limit = 10, search = '', course = '', difficulty = '') {
    const offset = (page - 1) * limit;
    
    let whereClause = 'WHERE r.user_id = $1';
    let params = [userId];
    let paramIndex = 2;

    if (search) {
      whereClause += ` AND q.title ILIKE $${paramIndex}`;
      params.push(`%${search}%`);
      paramIndex++;
    }
    if (course && course !== 'all') {
      whereClause += ` AND q.course = $${paramIndex}`;
      params.push(course);
      paramIndex++;
    }
    if (difficulty && difficulty !== 'all') {
      whereClause += ` AND q.difficulty = $${paramIndex}`;
      params.push(difficulty);
      paramIndex++;
    }

    // Collapse exact duplicate attempts (same quiz/score/total saved within the
    // same minute, e.g. from a double-save) so they appear only once.
    const inner = `
      SELECT r.*, q.title, q.course, q.difficulty,
             ROW_NUMBER() OVER (
               PARTITION BY r.quiz_id, r.score, r.total_questions,
                            DATE_TRUNC('minute', r.completed_at)
               ORDER BY r.id
             ) AS rn
      FROM results r
      JOIN quizzes q ON r.quiz_id = q.id
      ${whereClause}
    `;

    const countResult = await pool.query(
      `SELECT COUNT(*) FROM (${inner}) t WHERE t.rn = 1`,
      params
    );
    const total = parseInt(countResult.rows[0].count);

    const { rows } = await pool.query(
      `SELECT * FROM (${inner}) t WHERE t.rn = 1
       ORDER BY t.completed_at DESC
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...params, limit, offset]
    );

    return {
      results: rows,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  },

  async getById(resultId, userId) {
    const { rows } = await pool.query(
      `SELECT r.*, q.title, q.course, q.difficulty, q.questions
       FROM results r
       JOIN quizzes q ON r.quiz_id = q.id
       WHERE r.id = $1 AND r.user_id = $2`,
      [resultId, userId]
    );
    return rows[0];
  },

  async getWrongAnswers(userId, page = 1, limit = 20, search = '', course = '', quizId = null) {
    const offset = (page - 1) * limit;

    let whereClause = 'WHERE r.user_id = $1';
    let params = [userId];
    let paramIndex = 2;

    if (course && course !== 'all') {
      whereClause += ` AND q.course = $${paramIndex}`;
      params.push(course);
      paramIndex++;
    }

    if (quizId) {
      whereClause += ` AND r.quiz_id = $${paramIndex}`;
      params.push(quizId);
      paramIndex++;
    }

    const { rows } = await pool.query(
      `SELECT r.id, r.history, r.quiz_id, q.title, q.course, r.completed_at
       FROM results r
       JOIN quizzes q ON r.quiz_id = q.id
       ${whereClause}
       ORDER BY r.completed_at DESC`,
      params
    );

    // Collapse exact duplicate attempts (same quiz saved within the same minute)
    // so their wrong answers aren't listed twice.
    const seen = new Set();
    const deduped = [];
    for (const r of rows) {
      const key = `${r.quiz_id}|${Math.floor(new Date(r.completed_at).getTime() / 60000)}|${r.history?.length}`;
      if (seen.has(key)) continue;
      seen.add(key);
      deduped.push(r);
    }

    // Flatten wrong answers
    let wrong = [];
    for (const r of deduped) {
      const history = Array.isArray(r.history) ? r.history : [];
      for (const h of history) {
        if (!h.isCorrect) {
          if (search && !h.question.toLowerCase().includes(search.toLowerCase())) continue;
          wrong.push({
            id: r.id,
            quiz_id: r.quiz_id,
            title: r.title,
            course: r.course,
            completed_at: r.completed_at,
            question: h.question,
            selected: h.selected,
            correct: h.correct,
            explanation: h.explanation,
          });
        }
      }
    }

    const total = wrong.length;
    const paginated = wrong.slice(offset, offset + limit);

    return {
      wrongAnswers: paginated,
      total,
      page,
      totalPages: Math.ceil(total / limit) || 1,
    };
  },

  async getQuizzesWithWrongAnswers(userId) {
    const { rows } = await pool.query(
      `SELECT DISTINCT r.quiz_id as id, q.title, q.course, q.difficulty,
              COUNT(*) OVER (PARTITION BY r.quiz_id) as attempt_count
       FROM results r
       JOIN quizzes q ON r.quiz_id = q.id
       WHERE r.user_id = $1
       ORDER BY q.title ASC`,
      [userId]
    );

    // For each quiz, count total wrong answers
    const quizIds = rows.map(r => r.id);
    if (quizIds.length === 0) return [];

    const { rows: counts } = await pool.query(
      `SELECT r.quiz_id,
              SUM(CASE WHEN NOT (r.history->i)::jsonb->>'isCorrect' = 'true' THEN 1 ELSE 0 END) as wrong_count
       FROM results r,
            generate_series(0, jsonb_array_length(r.history) - 1) AS i
       WHERE r.user_id = $1 AND r.quiz_id = ANY($2)
       GROUP BY r.quiz_id`,
      [userId, quizIds]
    );

    const countMap = {};
    for (const c of counts) {
      countMap[c.quiz_id] = parseInt(c.wrong_count) || 0;
    }

    return rows.map(r => ({
      id: r.id,
      title: r.title,
      course: r.course,
      difficulty: r.difficulty,
      attempt_count: r.attempt_count,
      wrong_count: countMap[r.id] || 0,
    })).filter(q => q.wrong_count > 0);
  },

  async getStats(userId) {
    const { rows } = await pool.query(
      `SELECT 
         COUNT(*) as total_quizzes,
         SUM(score) as total_correct,
         SUM(total_questions) as total_questions,
         AVG(percentage) as avg_percentage,
         MAX(percentage) as best_percentage
       FROM (
         SELECT r.*, ROW_NUMBER() OVER (
           PARTITION BY r.quiz_id, r.score, r.total_questions,
                        DATE_TRUNC('minute', r.completed_at)
           ORDER BY r.id
         ) AS rn
         FROM results r
         WHERE r.user_id = $1
       ) t
       WHERE t.rn = 1`,
      [userId]
    );
    return rows[0];
  }
};