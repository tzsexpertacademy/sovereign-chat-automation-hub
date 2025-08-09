import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(supabaseUrl, supabaseKey);

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const { ticketId, cronScan } = body || {};

    if (cronScan) {
      console.log('🕒 [DEBOUNCE-CRON] Varredura de pendências iniciada');
      const { data: due } = await supabase
        .from('assistant_debounce')
        .select('ticket_id')
        .eq('scheduled', true)
        .lte('debounce_until', new Date().toISOString())
        .limit(20);

      if (!due || due.length === 0) {
        return new Response(JSON.stringify({ success: true, scanned: 0 }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      for (const row of due) {
        await processOne(row.ticket_id);
      }

      return new Response(JSON.stringify({ success: true, scanned: due.length }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (!ticketId) {
      return new Response(JSON.stringify({ error: 'ticketId é obrigatório' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const result = await processOne(ticketId);
    return new Response(JSON.stringify(result), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error) {
    console.error('❌ [DEBOUNCE] Erro crítico:', error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});

async function processOne(ticketId: string) {
  // Buscar linha de debounce
  const { data: row } = await supabase
    .from('assistant_debounce')
    .select('ticket_id, debounce_until, scheduled')
    .eq('ticket_id', ticketId)
    .maybeSingle();

  if (!row) {
    console.log('ℹ️ [DEBOUNCE] Sem estado de debounce para ticket:', ticketId);
    return { success: true, skipped: true, reason: 'NO_DEBOUNCE_STATE' };
  }

  // Esperar janela vencer com checagens periódicas (até 30s)
  let waited = 0;
  const maxWait = 30000;
  while (true) {
    const now = Date.now();
    const until = new Date(row.debounce_until).getTime();
    const remaining = until - now;
    if (remaining <= 0) break;

    const sleep = Math.min(remaining, 1500);
    await new Promise((r) => setTimeout(r, sleep));
    waited += sleep;
    if (waited >= maxWait) {
      console.log('⏳ [DEBOUNCE] Max wait atingido, seguindo assim mesmo');
      break;
    }

    // Recarregar debounce pois pode ter sido adiado
    const { data: fresh } = await supabase
      .from('assistant_debounce')
      .select('debounce_until, scheduled')
      .eq('ticket_id', ticketId)
      .maybeSingle();
    if (!fresh) break;
    row.debounce_until = fresh.debounce_until;
    row.scheduled = fresh.scheduled;
  }

  // Tentar adquirir lock trocando scheduled=true -> false atomically
  const { data: locked, error: lockErr } = await supabase
    .from('assistant_debounce')
    .update({ scheduled: false, last_updated: new Date().toISOString() })
    .eq('ticket_id', ticketId)
    .eq('scheduled', true)
    .lte('debounce_until', new Date().toISOString())
    .select('ticket_id')
    .maybeSingle();

  if (lockErr) {
    console.error('❌ [DEBOUNCE] Erro ao adquirir lock:', lockErr);
    return { success: false, error: 'LOCK_ERROR' };
  }

  if (!locked) {
    console.log('🔒 [DEBOUNCE] Outro worker assumiu ou janela não venceu:', ticketId);
    return { success: true, skipped: true, reason: 'LOCK_NOT_ACQUIRED' };
  }

  // Disparar IA para este ticket; a própria IA agrega mensagens pendentes
  console.log('🚀 [DEBOUNCE] Disparando IA para ticket:', ticketId);
  const ai = await supabase.functions.invoke('ai-assistant-process', {
    body: { ticketId }
  });

  if (ai.error) {
    console.error('❌ [DEBOUNCE] Erro ao invocar IA:', ai.error);
    // Reagendar
    await supabase
      .from('assistant_debounce')
      .update({ scheduled: true, debounce_until: new Date(Date.now() + 4000).toISOString(), last_updated: new Date().toISOString() })
      .eq('ticket_id', ticketId);
    return { success: false, error: 'AI_INVOKE_ERROR' };
  }

  console.log('✅ [DEBOUNCE] IA invocada com sucesso para ticket:', ticketId);
  return { success: true, processed: true };
}
