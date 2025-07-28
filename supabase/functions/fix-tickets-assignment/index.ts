import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0';

// Initialize Supabase client
const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(supabaseUrl, supabaseKey);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

serve(async (req) => {
  console.log('🔧 [FIX-TICKETS] Iniciando correção de tickets sem assignment');
  
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method === 'POST') {
    try {
      const { clientId } = await req.json();
      
      if (!clientId) {
        return new Response(
          JSON.stringify({ error: 'clientId é obrigatório' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const result = await fixTicketsAssignment(clientId);
      
      return new Response(
        JSON.stringify(result),
        { 
          status: 200, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );

    } catch (error) {
      console.error('❌ [FIX-TICKETS] Erro:', error);
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
  }

  // GET para status
  return new Response(
    JSON.stringify({ 
      message: 'Fix Tickets Assignment Service',
      usage: 'POST with { "clientId": "uuid" }'
    }),
    { 
      status: 200, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    }
  );
});

async function fixTicketsAssignment(clientId: string) {
  console.log(`🔧 [FIX-TICKETS] Corrigindo tickets para cliente: ${clientId}`);
  
  // 1. Buscar todos os tickets do cliente sem fila ou assistente
  const { data: ticketsWithoutAssignment, error: ticketsError } = await supabase
    .from('conversation_tickets')
    .select('id, chat_id, instance_id, title, last_message_preview')
    .eq('client_id', clientId)
    .or('assigned_queue_id.is.null,assigned_assistant_id.is.null');

  if (ticketsError) {
    console.error('❌ [FIX-TICKETS] Erro ao buscar tickets:', ticketsError);
    throw new Error(`Erro ao buscar tickets: ${ticketsError.message}`);
  }

  if (!ticketsWithoutAssignment || ticketsWithoutAssignment.length === 0) {
    console.log('✅ [FIX-TICKETS] Todos os tickets já têm assignment correto');
    return {
      success: true,
      message: 'Todos os tickets já têm assignment correto',
      ticketsProcessed: 0,
      ticketsFixed: 0
    };
  }

  console.log(`🎯 [FIX-TICKETS] Encontrados ${ticketsWithoutAssignment.length} tickets para corrigir`);

  let ticketsFixed = 0;
  const errors: string[] = [];

  // 2. Para cada ticket, aplicar auto-assignment
  for (const ticket of ticketsWithoutAssignment) {
    try {
      console.log(`🔧 [FIX-TICKETS] Processando ticket: ${ticket.id}`);

      // Chamar função de auto-assignment
      const { data: assignedQueueId, error: assignmentError } = await supabase
        .rpc('auto_assign_queue', {
          p_client_id: clientId,
          p_instance_id: ticket.instance_id,
          p_message_content: ticket.last_message_preview || ''
        });

      if (assignmentError) {
        console.error(`❌ [FIX-TICKETS] Erro na função auto_assign_queue para ticket ${ticket.id}:`, assignmentError);
        errors.push(`Ticket ${ticket.id}: ${assignmentError.message}`);
        continue;
      }

      if (!assignedQueueId) {
        console.log(`⚠️ [FIX-TICKETS] Nenhuma fila disponível para o ticket ${ticket.id}`);
        errors.push(`Ticket ${ticket.id}: Nenhuma fila disponível`);
        continue;
      }

      // Buscar assistente da fila
      const { data: queueData, error: queueError } = await supabase
        .from('queues')
        .select('assistant_id, name')
        .eq('id', assignedQueueId)
        .single();

      if (queueError || !queueData?.assistant_id) {
        console.error(`❌ [FIX-TICKETS] Erro ao buscar assistente da fila para ticket ${ticket.id}:`, queueError);
        
        // Mesmo assim atualizar com a fila
        const { error: updateQueueError } = await supabase
          .from('conversation_tickets')
          .update({
            assigned_queue_id: assignedQueueId,
            updated_at: new Date().toISOString()
          })
          .eq('id', ticket.id);

        if (updateQueueError) {
          console.error(`❌ [FIX-TICKETS] Erro ao atualizar ticket ${ticket.id} com fila:`, updateQueueError);
          errors.push(`Ticket ${ticket.id}: Erro ao atualizar com fila`);
        } else {
          console.log(`✅ [FIX-TICKETS] Ticket ${ticket.id} atualizado apenas com fila`);
          ticketsFixed++;
        }
        continue;
      }

      // Atualizar ticket com fila e assistente
      const { error: updateTicketError } = await supabase
        .from('conversation_tickets')
        .update({
          assigned_queue_id: assignedQueueId,
          assigned_assistant_id: queueData.assistant_id,
          updated_at: new Date().toISOString()
        })
        .eq('id', ticket.id);

      if (updateTicketError) {
        console.error(`❌ [FIX-TICKETS] Erro ao atualizar ticket ${ticket.id} com assignment:`, updateTicketError);
        errors.push(`Ticket ${ticket.id}: Erro ao atualizar com assignment`);
        continue;
      }

      console.log(`✅ [FIX-TICKETS] Ticket ${ticket.id} corrigido com sucesso:`, {
        queueId: assignedQueueId,
        queueName: queueData.name,
        assistantId: queueData.assistant_id
      });

      ticketsFixed++;

    } catch (error) {
      console.error(`❌ [FIX-TICKETS] Erro crítico ao processar ticket ${ticket.id}:`, error);
      errors.push(`Ticket ${ticket.id}: ${error.message}`);
    }
  }

  console.log(`✅ [FIX-TICKETS] Processo concluído: ${ticketsFixed}/${ticketsWithoutAssignment.length} tickets corrigidos`);

  return {
    success: true,
    message: `Processo de correção concluído`,
    ticketsProcessed: ticketsWithoutAssignment.length,
    ticketsFixed: ticketsFixed,
    errors: errors.length > 0 ? errors : undefined
  };
}