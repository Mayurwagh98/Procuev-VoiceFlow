const WebSocket = require('ws');
const crypto = require('crypto');
const { transcriptionRepo } = require('../db/transcriptionRepo');

const GEMINI_LIVE_MODEL = process.env.GEMINI_LIVE_MODEL || 'gemini-3.1-flash-live';

function getProviderCapabilities() {
  return {
    geminiLiveConfigured: Boolean(process.env.GEMINI_API_KEY),
    geminiLiveModel: GEMINI_LIVE_MODEL,
    whisperConfigured: Boolean(process.env.WHISPER_API_URL),
    browserWebSpeechSupported: true,
  };
}

function buildGeminiLiveUrl(apiKey) {
  return `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?key=${encodeURIComponent(
    apiKey
  )}`;
}

function attachSttWebSocketServer(httpServer, repo = transcriptionRepo) {
  const wss = new WebSocket.Server({ server: httpServer, path: '/ws/transcribe' });

  wss.on('connection', (clientWs) => {
    const sessionId = crypto.randomUUID();
    let activeProvider = 'browser-webspeech';
    let activeLanguage = 'hi-IN / en-IN';
    let geminiWs = null;
    let accumulatedTranscript = '';
    let sessionStartMs = Date.now();

    const sendJson = (payload) => {
      if (clientWs.readyState === WebSocket.OPEN) {
        clientWs.send(JSON.stringify(payload));
      }
    };

    sendJson({
      type: 'ready',
      sessionId,
      capabilities: getProviderCapabilities(),
    });

    const connectGeminiLive = () => {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        sendJson({
          type: 'warning',
          message:
            'GEMINI_API_KEY is not set on the server. Falling back to Browser Live STT relay.',
        });
        activeProvider = 'browser-webspeech';
        return;
      }

      const url = buildGeminiLiveUrl(apiKey);
      geminiWs = new WebSocket(url);

      geminiWs.on('open', () => {
        const setupPayload = {
          setup: {
            model: `models/${GEMINI_LIVE_MODEL}`,
            generationConfig: {
              responseModalities: ['TEXT'],
              temperature: 0.1,
            },
            systemInstruction: {
              parts: [
                {
                  text:
                    'You are a real-time multilingual speech-to-text transcriber. ' +
                    'Accurately transcribe spoken audio verbatim, including code-switched Hindi and English (Hinglish). ' +
                    'Preserve English words in Latin script and Hindi words naturally (Devanagari or Romanized as spoken). ' +
                    'Output ONLY the transcribed words without commentary.',
                },
              ],
            },
          },
        };
        geminiWs.send(JSON.stringify(setupPayload));
        sendJson({
          type: 'status',
          provider: 'gemini-live-3.1',
          message: `Connected to ${GEMINI_LIVE_MODEL} real-time stream.`,
        });
      });

      geminiWs.on('message', (raw) => {
        try {
          const msg = JSON.parse(raw.toString());
          const parts = msg?.serverContent?.modelTurn?.parts || [];
          const text = parts.map((p) => p.text || '').join('').trim();
          if (text) {
            accumulatedTranscript = accumulatedTranscript
              ? `${accumulatedTranscript} ${text}`
              : text;
            sendJson({
              type: 'final',
              provider: 'gemini-live-3.1',
              text,
              fullText: accumulatedTranscript,
            });
          }
        } catch (err) {
          console.error('Gemini Live message parse error:', err.message);
        }
      });

      geminiWs.on('error', (err) => {
        sendJson({
          type: 'error',
          message: `Gemini Live stream error: ${err.message}`,
        });
      });

      geminiWs.on('close', () => {
        geminiWs = null;
      });
    };

    clientWs.on('message', async (raw) => {
      try {
        const msg = JSON.parse(raw.toString());

        if (msg.type === 'start') {
          activeProvider = msg.provider || 'browser-webspeech';
          activeLanguage = msg.language || 'hi-IN / en-IN';
          accumulatedTranscript = '';
          sessionStartMs = Date.now();

          if (activeProvider === 'gemini-live-3.1') {
            connectGeminiLive();
          } else {
            sendJson({
              type: 'status',
              provider: activeProvider,
              message: `Session started (${activeLanguage}) via ${activeProvider}.`,
            });
          }
          return;
        }

        if (msg.type === 'audio' && msg.data) {
          if (geminiWs && geminiWs.readyState === WebSocket.OPEN) {
            geminiWs.send(
              JSON.stringify({
                realtimeInput: {
                  mediaChunks: [
                    {
                      mimeType: msg.mimeType || 'audio/pcm;rate=16000',
                      data: msg.data,
                    },
                  ],
                },
              })
            );
          }
          return;
        }

        if (msg.type === 'transcript_chunk') {
          if (msg.isFinal && msg.text) {
            const cleanChunk = String(msg.text).trim();
            if (cleanChunk) {
              accumulatedTranscript = accumulatedTranscript
                ? `${accumulatedTranscript} ${cleanChunk}`
                : cleanChunk;
            }
          }
          sendJson({
            type: msg.isFinal ? 'final' : 'interim',
            provider: activeProvider,
            text: msg.text || '',
            fullText: accumulatedTranscript,
          });
          return;
        }

        if (msg.type === 'stop') {
          if (geminiWs) {
            geminiWs.close();
            geminiWs = null;
          }

          const finalText = (msg.finalText || accumulatedTranscript || '').trim();
          const durationSeconds =
            msg.durationSeconds !== undefined
              ? Math.max(0, Math.round(Number(msg.durationSeconds)))
              : Math.max(1, Math.round((Date.now() - sessionStartMs) / 1000));

          if (msg.autoSave && finalText) {
            const saved = await repo.create({
              sessionId,
              title: msg.title,
              transcriptText: finalText,
              primaryLanguage: activeLanguage,
              detectedLanguages: activeLanguage.includes('hi') ? ['hi', 'en'] : ['en'],
              durationSeconds,
              sttProvider: activeProvider,
            });
            sendJson({ type: 'saved', record: saved });
          } else {
            sendJson({ type: 'stopped', fullText: finalText, durationSeconds });
          }
        }
      } catch (err) {
        sendJson({ type: 'error', message: err.message });
      }
    });

    clientWs.on('close', () => {
      if (geminiWs) {
        geminiWs.close();
        geminiWs = null;
      }
    });
  });

  return wss;
}

module.exports = {
  attachSttWebSocketServer,
  getProviderCapabilities,
};
