# Procucev VoiceFlow — Real-Time Multilingual Speech-to-Text

A full-stack **Node.js + Express + WebSocket + PostgreSQL** web application built for the **Procucev AI Tech Hiring Assignment**. It supports real-time multilingual speech-to-text (including Hindi + English / Hinglish code-switching) and persists transcription history in PostgreSQL with a full CRUD dashboard.

## Features
- **Real-Time Multilingual Transcription:**
  - **Gemini Live 3.1 (WebSocket Audio Streaming):** Streams 16kHz PCM microphone audio from the browser over WebSocket (`/ws/transcribe`) to the Node.js backend, which proxies to the Gemini Multimodal Live API.
  - **Browser Live STT Fallback (Zero-Key Mode):** Uses the Web Speech API (`hi-IN` / `en-IN`) and relays interim/final chunks over WebSocket so the app works immediately even without an API key.
  - **Live Audio Waveform:** Real-time HTML5 Canvas waveform visualizer.
- **PostgreSQL Relational Storage & Full CRUD:**
  - Automatic schema initialization (`src/db/schema.sql`) on startup.
  - Create (live recording or manual note), Read/Search/Filter, Update (edit title, text, language, or star status), and Delete.
  - Live KPI summary bar (total count, total duration, starred count).

## Tech Stack
- **Backend:** Node.js 18+, Express, `ws` (WebSockets), `pg` (PostgreSQL)
- **Database:** PostgreSQL 16 (relational schema with indexes & `updated_at` trigger)
- **Frontend:** HTML5, CSS3, Vanilla ES6+ JavaScript (Canvas API, Web Audio API, Web Speech API)

## Local Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```
2. **Configure environment:**
   ```bash
   cp .env.example .env
   # Set DATABASE_URL to your PostgreSQL instance
   # Optionally set GEMINI_API_KEY for Gemini Live 3.1 WebSocket streaming
   ```
3. **Run the app:**
   ```bash
   npm start
   ```
   Open `http://localhost:5000`.

### Quick Start with Docker
```bash
docker compose up --build
```

### Run Automated Tests
```bash
npm test
```

## REST API Endpoints
- `GET /api/health` — Database & STT capability status
- `GET /api/transcriptions` — List transcriptions (`?q=`, `?provider=`, `?starred=true`)
- `GET /api/transcriptions/stats` — Aggregate KPIs
- `GET /api/transcriptions/:id` — Get single transcription
- `POST /api/transcriptions` — Create transcription
- `PUT /api/transcriptions/:id` — Update transcription
- `DELETE /api/transcriptions/:id` — Delete transcription
- `WS /ws/transcribe` — Real-time audio & transcript WebSocket stream
