const express = require('express');
const { transcriptionRepo } = require('../db/transcriptionRepo');

function createTranscriptionsRouter(repo = transcriptionRepo) {
  const router = express.Router();

  router.get('/stats', async (req, res, next) => {
    try {
      const stats = await repo.getStats();
      res.json({ success: true, data: stats });
    } catch (err) {
      next(err);
    }
  });

  router.get('/', async (req, res, next) => {
    try {
      const { q = '', provider = '', starred = '', limit = 50, offset = 0 } = req.query;
      const items = await repo.findAll({
        search: q,
        provider,
        starred,
        limit,
        offset,
      });
      res.json({ success: true, count: items.length, data: items });
    } catch (err) {
      next(err);
    }
  });

  router.get('/:id', async (req, res, next) => {
    try {
      const item = await repo.findById(req.params.id);
      if (!item) {
        return res.status(404).json({ success: false, error: 'Transcription not found.' });
      }
      res.json({ success: true, data: item });
    } catch (err) {
      next(err);
    }
  });

  router.post('/', async (req, res, next) => {
    try {
      const created = await repo.create({
        sessionId: req.body.sessionId || req.body.session_id,
        title: req.body.title,
        transcriptText: req.body.transcriptText ?? req.body.transcript_text,
        primaryLanguage: req.body.primaryLanguage || req.body.primary_language,
        detectedLanguages: req.body.detectedLanguages || req.body.detected_languages,
        durationSeconds: req.body.durationSeconds ?? req.body.duration_seconds,
        sttProvider: req.body.sttProvider || req.body.stt_provider,
        confidenceScore: req.body.confidenceScore ?? req.body.confidence_score,
        isStarred: req.body.isStarred ?? req.body.is_starred,
      });
      res.status(201).json({ success: true, data: created });
    } catch (err) {
      next(err);
    }
  });

  router.put('/:id', async (req, res, next) => {
    try {
      const updated = await repo.update(req.params.id, req.body);
      if (!updated) {
        return res.status(404).json({ success: false, error: 'Transcription not found.' });
      }
      res.json({ success: true, data: updated });
    } catch (err) {
      next(err);
    }
  });

  router.delete('/:id', async (req, res, next) => {
    try {
      const deleted = await repo.remove(req.params.id);
      if (!deleted) {
        return res.status(404).json({ success: false, error: 'Transcription not found.' });
      }
      res.json({ success: true, data: deleted });
    } catch (err) {
      next(err);
    }
  });

  return router;
}

module.exports = {
  createTranscriptionsRouter,
};
