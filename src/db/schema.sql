-- Procucev AI Tech Hiring Assignment: Relational Schema (PostgreSQL)

CREATE TABLE IF NOT EXISTS transcriptions (
    id SERIAL PRIMARY KEY,
    session_id VARCHAR(64) NOT NULL,
    title VARCHAR(255) NOT NULL DEFAULT 'Untitled Transcription',
    transcript_text TEXT NOT NULL,
    primary_language VARCHAR(32) NOT NULL DEFAULT 'hi-IN / en-IN',
    detected_languages JSONB NOT NULL DEFAULT '["hi", "en"]'::jsonb,
    duration_seconds INTEGER NOT NULL DEFAULT 0 CHECK (duration_seconds >= 0),
    stt_provider VARCHAR(64) NOT NULL DEFAULT 'gemini-live-3.1',
    confidence_score NUMERIC(4, 3),
    is_starred BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_transcriptions_created_at
    ON transcriptions (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_transcriptions_provider
    ON transcriptions (stt_provider);

CREATE INDEX IF NOT EXISTS idx_transcriptions_starred
    ON transcriptions (is_starred)
    WHERE is_starred = TRUE;

CREATE OR REPLACE FUNCTION update_transcriptions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_transcriptions_updated_at ON transcriptions;
CREATE TRIGGER trg_transcriptions_updated_at
    BEFORE UPDATE ON transcriptions
    FOR EACH ROW
    EXECUTE FUNCTION update_transcriptions_updated_at();
