-- Create message_artifacts table for modality-independent pipelines
CREATE TABLE IF NOT EXISTS public.message_artifacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id TEXT NOT NULL,
  correlation_id TEXT NOT NULL,
  ticket_id UUID,
  client_id UUID NOT NULL,
  instance_id TEXT NOT NULL,
  chat_id TEXT NOT NULL,
  type TEXT NOT NULL, -- e.g., clean_text | transcription | ocr | vision
  status TEXT NOT NULL DEFAULT 'done', -- queued | processing | done | failed
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  blob_ref TEXT,
  pipeline TEXT,
  idempotency_key TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_message_artifacts_ticket ON public.message_artifacts (ticket_id);
CREATE INDEX IF NOT EXISTS idx_message_artifacts_correlation ON public.message_artifacts (correlation_id);
CREATE INDEX IF NOT EXISTS idx_message_artifacts_message ON public.message_artifacts (message_id);
CREATE INDEX IF NOT EXISTS idx_message_artifacts_message_type ON public.message_artifacts (message_id, type);

-- Enable RLS with permissive policies similar to existing tables
ALTER TABLE public.message_artifacts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all operations on message_artifacts" ON public.message_artifacts;
CREATE POLICY "Allow all operations on message_artifacts"
ON public.message_artifacts
FOR ALL
USING (true)
WITH CHECK (true);

-- updated_at trigger
DROP TRIGGER IF EXISTS trg_message_artifacts_updated_at ON public.message_artifacts;
CREATE TRIGGER trg_message_artifacts_updated_at
BEFORE UPDATE ON public.message_artifacts
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();