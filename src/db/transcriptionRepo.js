const crypto = require('crypto');

function createTranscriptionRepo(db) {
  const getDb = () => db || require('./pool').pool;

  return {
    async create({
      sessionId,
      title,
      transcriptText,
      primaryLanguage = 'hi-IN / en-IN',
      detectedLanguages = ['hi', 'en'],
      durationSeconds = 0,
      sttProvider = 'gemini-live-3.1',
      confidenceScore = null,
      isStarred = false,
    }) {
      const cleanText = String(transcriptText || '').trim();
      if (!cleanText) {
        const err = new Error('transcript_text is required and cannot be empty.');
        err.statusCode = 400;
        throw err;
      }

      const resolvedSessionId = sessionId || crypto.randomUUID();
      const resolvedTitle =
        (title && String(title).trim()) ||
        cleanText.slice(0, 60) + (cleanText.length > 60 ? '...' : '');
      const normalizedDuration = Math.max(0, Math.round(Number(durationSeconds) || 0));

      const sql = `
        INSERT INTO transcriptions (
          session_id,
          title,
          transcript_text,
          primary_language,
          detected_languages,
          duration_seconds,
          stt_provider,
          confidence_score,
          is_starred
        )
        VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7, $8, $9)
        RETURNING *;
      `;

      const values = [
        resolvedSessionId,
        resolvedTitle,
        cleanText,
        primaryLanguage,
        JSON.stringify(Array.isArray(detectedLanguages) ? detectedLanguages : ['hi', 'en']),
        normalizedDuration,
        sttProvider,
        confidenceScore !== null && confidenceScore !== undefined
          ? Number(confidenceScore)
          : null,
        Boolean(isStarred),
      ];

      const { rows } = await getDb().query(sql, values);
      return rows[0];
    },

    async findAll({ search = '', provider = '', starred = '', limit = 50, offset = 0 } = {}) {
      const conditions = [];
      const values = [];

      if (search && String(search).trim()) {
        values.push(`%${String(search).trim()}%`);
        conditions.push(
          `(title ILIKE $${values.length} OR transcript_text ILIKE $${values.length})`
        );
      }

      if (provider && String(provider).trim()) {
        values.push(String(provider).trim());
        conditions.push(`stt_provider = $${values.length}`);
      }

      if (starred === 'true' || starred === true) {
        conditions.push(`is_starred = TRUE`);
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
      const safeLimit = Math.min(Math.max(1, Number(limit) || 50), 200);
      const safeOffset = Math.max(0, Number(offset) || 0);

      values.push(safeLimit, safeOffset);

      const sql = `
        SELECT *
        FROM transcriptions
        ${whereClause}
        ORDER BY created_at DESC
        LIMIT $${values.length - 1} OFFSET $${values.length};
      `;

      const { rows } = await getDb().query(sql, values);
      return rows;
    },

    async findById(id) {
      const numericId = Number(id);
      if (!Number.isInteger(numericId) || numericId <= 0) {
        return null;
      }
      const { rows } = await getDb().query('SELECT * FROM transcriptions WHERE id = $1;', [
        numericId,
      ]);
      return rows[0] || null;
    },

    async update(id, updates = {}) {
      const numericId = Number(id);
      if (!Number.isInteger(numericId) || numericId <= 0) {
        const err = new Error('Invalid transcription ID.');
        err.statusCode = 400;
        throw err;
      }

      const allowedFields = {
        title: 'title',
        transcriptText: 'transcript_text',
        transcript_text: 'transcript_text',
        primaryLanguage: 'primary_language',
        primary_language: 'primary_language',
        isStarred: 'is_starred',
        is_starred: 'is_starred',
      };

      const setClauses = [];
      const values = [];

      for (const [key, column] of Object.entries(allowedFields)) {
        if (updates[key] !== undefined) {
          let val = updates[key];
          if (column === 'transcript_text') {
            val = String(val).trim();
            if (!val) {
              const err = new Error('transcript_text cannot be empty.');
              err.statusCode = 400;
              throw err;
            }
          }
          if (column === 'title') {
            val = String(val).trim() || 'Untitled Transcription';
          }
          if (column === 'is_starred') {
            val = Boolean(val);
          }
          values.push(val);
          setClauses.push(`${column} = $${values.length}`);
        }
      }

      if (setClauses.length === 0) {
        const err = new Error('No valid fields provided for update.');
        err.statusCode = 400;
        throw err;
      }

      values.push(numericId);
      const sql = `
        UPDATE transcriptions
        SET ${setClauses.join(', ')}, updated_at = NOW()
        WHERE id = $${values.length}
        RETURNING *;
      `;

      const { rows } = await getDb().query(sql, values);
      return rows[0] || null;
    },

    async remove(id) {
      const numericId = Number(id);
      if (!Number.isInteger(numericId) || numericId <= 0) {
        return null;
      }
      const { rows } = await getDb().query(
        'DELETE FROM transcriptions WHERE id = $1 RETURNING id;',
        [numericId]
      );
      return rows[0] || null;
    },

    async getStats() {
      const { rows } = await getDb().query(`
        SELECT
          COUNT(*)::int AS total_count,
          COALESCE(SUM(duration_seconds), 0)::int AS total_duration_seconds,
          COUNT(*) FILTER (WHERE is_starred = TRUE)::int AS starred_count
        FROM transcriptions;
      `);
      return rows[0];
    },
  };
}

module.exports = {
  createTranscriptionRepo,
  transcriptionRepo: createTranscriptionRepo(),
};
