import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(supabaseUrl, supabaseKey);

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const {
      limit = 10,
      debounceWindowSec = 10,
      onlyOrphaned = false,
      trigger = "manual",
    } = body || {};

    console.log(`🧵 [BATCH] Iniciando processamento em blocos: trigger=${trigger}, limit=${limit}, orphaned=${onlyOrphaned}`);

    const nowIso = new Date().toISOString();

    // Seleciona batches pendentes
    let query = supabase
      .from("message_batches")
      .select("id, chat_id, client_id, instance_id, messages, created_at, last_updated, processing_started_at, processing_by")
      .is("processed_at", null)
      .order("created_at", { ascending: true })
      .limit(limit);

    if (onlyOrphaned) {
      // Considera órfão se criado há mais de 5 min e nunca processado
      query = query.lt("created_at", new Date(Date.now() - 5 * 60 * 1000).toISOString());
    }

    const { data: pending, error: pendErr } = await query;
    if (pendErr) throw pendErr;

    if (!pending || pending.length === 0) {
      console.log("🟢 [BATCH] Nenhum batch pendente encontrado");
      return new Response(JSON.stringify({ success: true, processed: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let scheduled = 0;
    let locked = 0;

    for (const batch of pending) {
      // Tentar adquirir lock (processing_started_at ainda null)
      const { data: lockRow, error: lockErr } = await supabase
        .from("message_batches")
        .update({ processing_started_at: nowIso, processing_by: "scheduler" })
        .eq("id", batch.id)
        .is("processing_started_at", null)
        .select("id")
        .maybeSingle();

      if (lockErr) {
        console.error("❌ [BATCH] Erro ao adquirir lock do batch:", batch.id, lockErr);
        continue;
      }
      if (!lockRow) {
        // Outro worker assumiu
        continue;
      }

      locked++;

      // Encontrar ticket para este chat + cliente
      const normalizedChat = (batch.chat_id || "").replace(/@(s\.whatsapp\.net|s\.whats|c\.us)$/i, "");

      const { data: ticket } = await supabase
        .from("conversation_tickets")
        .select("id, chat_id, instance_id, client_id")
        .eq("client_id", batch.client_id)
        .filter("chat_id", "ilike", `%${normalizedChat}%`) // tolerante a sufixos
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!ticket) {
        console.log("⚠️ [BATCH] Ticket não encontrado para chat:", batch.chat_id, "client:", batch.client_id);
        // Ainda assim marcar como processado para evitar loop infinito
        await supabase
          .from("message_batches")
          .update({ processed_at: nowIso, last_updated: nowIso })
          .eq("id", batch.id);
        continue;
      }

      // Upsert-like manual em assistant_debounce (sem unique, então fazemos check+update)
      const untilIso = new Date(Date.now() + debounceWindowSec * 1000).toISOString();
      const { data: existing } = await supabase
        .from("assistant_debounce")
        .select("ticket_id, scheduled, debounce_until")
        .eq("ticket_id", ticket.id)
        .maybeSingle();

      if (existing) {
        await supabase
          .from("assistant_debounce")
          .update({ scheduled: true, debounce_until: untilIso, last_updated: nowIso })
          .eq("ticket_id", ticket.id);
      } else {
        await supabase
          .from("assistant_debounce")
          .insert({
            ticket_id: ticket.id,
            scheduled: true,
            debounce_until: untilIso,
            last_updated: nowIso,
          });
      }

      // Marcar batch como processado e atualizado
      await supabase
        .from("message_batches")
        .update({ processed_at: nowIso, last_updated: nowIso })
        .eq("id", batch.id);

      // Disparar worker de execução imediata para este ticket (ele respeitará a janela e lock)
      const invoke = await supabase.functions.invoke("immediate-batch-processor", {
        body: { ticketId: ticket.id },
      });
      if (invoke.error) {
        console.error("❌ [BATCH] Falha ao acionar immediate-batch-processor:", invoke.error);
      } else {
        console.log("🚀 [BATCH] immediate-batch-processor acionado para ticket:", ticket.id);
      }
      scheduled++;
    }

    return new Response(
      JSON.stringify({ success: true, scheduled, locked }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("❌ [BATCH] Erro geral:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
