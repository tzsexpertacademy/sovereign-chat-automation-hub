-- 1) Create message_batches table used by yumer-webhook and health checks
CREATE TABLE IF NOT EXISTS public.message_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id text NOT NULL,
  client_id uuid NOT NULL,
  instance_id text NOT NULL,
  messages jsonb NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  processing_started_at timestamptz NULL,
  processed_at timestamptz NULL,
  error_message text NULL
);

-- 2) Enable RLS and permissive policy (consistent with other tables in this project)
ALTER TABLE public.message_batches ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all operations on message_batches" ON public.message_batches;
CREATE POLICY "Allow all operations on message_batches"
ON public.message_batches
FOR ALL
USING (true)
WITH CHECK (true);

-- 3) Helpful indexes for processing/monitoring
CREATE INDEX IF NOT EXISTS idx_message_batches_client_created ON public.message_batches (client_id, created_at);
CREATE INDEX IF NOT EXISTS idx_message_batches_status ON public.message_batches (status, created_at);
CREATE INDEX IF NOT EXISTS idx_message_batches_processing_started ON public.message_batches (processing_started_at);
