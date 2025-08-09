-- 1) Remover duplicatas em assistant_debounce mantendo o registro mais recente por ticket
WITH ranked AS (
  SELECT 
    ctid,
    ticket_id,
    ROW_NUMBER() OVER (
      PARTITION BY ticket_id 
      ORDER BY COALESCE(last_updated, created_at) DESC, created_at DESC, ctid DESC
    ) AS rn
  FROM public.assistant_debounce
)
DELETE FROM public.assistant_debounce ad
USING ranked r
WHERE ad.ctid = r.ctid
  AND r.rn > 1;

-- 2) Garantir unicidade por ticket_id para impedir múltiplos agendamentos concorrentes
ALTER TABLE public.assistant_debounce
ADD CONSTRAINT assistant_debounce_ticket_id_unique UNIQUE (ticket_id);

-- 3) Índice auxiliar para consultas do processador imediato
CREATE INDEX IF NOT EXISTS idx_assistant_debounce_scheduled_until
  ON public.assistant_debounce (scheduled, debounce_until);
