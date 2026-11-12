const test = require('node:test');
const assert = require('node:assert/strict');
const { createTranscriptionRepo } = require('../src/db/transcriptionRepo');

function createMockDb() {
  const rows = [];
  let nextId = 1;

  return {
    rows,
    async query(sql, values = []) {
      const normalized = sql.replace(/\s+/g, ' ').trim();

      if (normalized.startsWith('INSERT INTO transcriptions')) {
        const record = {
          id: nextId++,
          session_id: values[0],
          title: values[1],
          transcript_text: values[2],
          primary_language: values[3],
          detected_languages: JSON.parse(values[4]),
          duration_seconds: values[5],
          stt_provider: values[6],
          confidence_score: values[7],
          is_starred: values[8],
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        rows.unshift(record);
        return { rows: [record] };
      }

      if (normalized.startsWith('SELECT COUNT(*)::int AS total_count')) {
        return {
          rows: [
            {
              total_count: rows.length,
              total_duration_seconds: rows.reduce((sum, r) => sum + r.duration_seconds, 0),
              starred_count: rows.filter((r) => r.is_starred).length,
            },
          ],
        };
      }

      if (normalized.startsWith('SELECT * FROM transcriptions WHERE id = $1')) {
        const found = rows.find((r) => r.id === values[0]);
        return { rows: found ? [found] : [] };
      }

      if (normalized.startsWith('SELECT * FROM transcriptions')) {
        return { rows: [...rows] };
      }

      if (normalized.startsWith('UPDATE transcriptions')) {
        const id = values[values.length - 1];
        const idx = rows.findIndex((r) => r.id === id);
        if (idx === -1) return { rows: [] };
        if (normalized.includes('is_starred = $1')) {
          rows[idx].is_starred = values[0];
        }
        if (normalized.includes('title = $1')) {
          rows[idx].title = values[0];
        }
        return { rows: [rows[idx]] };
      }

      if (normalized.startsWith('DELETE FROM transcriptions WHERE id = $1')) {
        const idx = rows.findIndex((r) => r.id === values[0]);
        if (idx === -1) return { rows: [] };
        const [removed] = rows.splice(idx, 1);
        return { rows: [{ id: removed.id }] };
      }

      throw new Error(`Unhandled mock SQL: ${normalized}`);
    },
  };
}

test('creates and retrieves a multilingual transcription', async () => {
  const repo = createTranscriptionRepo(createMockDb());
  const created = await repo.create({
    transcriptText: 'Namaste team, aaj hum deployment complete karenge.',
    primaryLanguage: 'hi-IN / en-IN',
    durationSeconds: 14,
    sttProvider: 'gemini-live-3.1',
  });

  assert.equal(created.id, 1);
  assert.equal(created.primary_language, 'hi-IN / en-IN');
  assert.equal(created.duration_seconds, 14);

  const fetched = await repo.findById(1);
  assert.equal(fetched.transcript_text, 'Namaste team, aaj hum deployment complete karenge.');
});

test('rejects empty transcript_text with 400 error', async () => {
  const repo = createTranscriptionRepo(createMockDb());
  await assert.rejects(
    () => repo.create({ transcriptText: '   ' }),
    (err) => err.statusCode === 400
  );
});

test('updates, computes stats, and deletes a transcription', async () => {
  const repo = createTranscriptionRepo(createMockDb());
  await repo.create({ transcriptText: 'First note', durationSeconds: 10 });

  const updated = await repo.update(1, { is_starred: true });
  assert.equal(updated.is_starred, true);

  const stats = await repo.getStats();
  assert.equal(stats.total_count, 1);
  assert.equal(stats.starred_count, 1);
  assert.equal(stats.total_duration_seconds, 10);

  const deleted = await repo.remove(1);
  assert.deepEqual(deleted, { id: 1 });
  assert.equal(await repo.findById(1), null);
});
