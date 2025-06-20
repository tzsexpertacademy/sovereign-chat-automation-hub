
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { 
      messageText, 
      clientId, 
      chatId, 
      customerPhone 
    } = await req.json();

    // Buscar configuração de AI do cliente
    const { data: aiConfig } = await supabase
      .from('client_ai_configs')
      .select('openai_api_key')
      .eq('client_id', clientId)
      .single();

    if (!aiConfig) {
      throw new Error('Configuração de IA não encontrada');
    }

    // Buscar dados do cliente para contexto
    const [professionalsRes, servicesRes, customersRes] = await Promise.all([
      supabase.from('professionals').select('id, name, specialty').eq('client_id', clientId).eq('is_active', true),
      supabase.from('services').select('id, name, duration_minutes, price').eq('client_id', clientId).eq('is_active', true),
      supabase.from('customers').select('id, name, phone').eq('client_id', clientId).eq('phone', customerPhone).maybeSingle()
    ]);

    const professionals = professionalsRes.data || [];
    const services = servicesRes.data || [];
    const customer = customersRes.data;

    // Criar prompt especializado para agendamento
    const systemPrompt = `Você é um assistente de agendamento inteligente. Sua função é ajudar clientes a agendar serviços.

PROFISSIONAIS DISPONÍVEIS:
${professionals.map(p => `- ${p.name} (ID: ${p.id}) - ${p.specialty || 'Sem especialidade'}`).join('\n')}

SERVIÇOS DISPONÍVEIS:
${services.map(s => `- ${s.name} (ID: ${s.id}) - ${s.duration_minutes}min - R$ ${s.price || 'Consulte'}`).join('\n')}

INSTRUÇÕES:
1. Seja amigável e prestativo
2. Quando o cliente quiser agendar, pergunte: serviço desejado, profissional preferido (se tiver), data e horário preferido
3. Sempre confirme os dados antes de finalizar
4. Se precisar agendar, responda EXATAMENTE no formato:
   AGENDAR: {"service_id": "ID_DO_SERVICO", "professional_id": "ID_DO_PROFISSIONAL", "date": "YYYY-MM-DD", "time": "HH:MM", "customer_name": "NOME_DO_CLIENTE"}

5. Para consultar disponibilidade, responda:
   CONSULTAR: {"professional_id": "ID_DO_PROFISSIONAL", "service_id": "ID_DO_SERVICO", "date": "YYYY-MM-DD"}

Data atual: ${new Date().toLocaleDateString('pt-BR')}
Cliente atual: ${customer?.name || 'Novo cliente'}`;

    // Chamar OpenAI
    const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${aiConfig.openai_api_key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: messageText }
        ],
        max_tokens: 500,
        temperature: 0.7
      }),
    });

    const aiResult = await openaiResponse.json();
    const responseText = aiResult.choices[0].message.content;

    // Verificar se é uma ação de agendamento
    if (responseText.includes('AGENDAR:')) {
      try {
        const bookingData = JSON.parse(responseText.split('AGENDAR:')[1].trim());
        
        // Criar ou encontrar cliente
        let customerId = customer?.id;
        if (!customerId) {
          const { data: newCustomer } = await supabase
            .from('customers')
            .insert({
              client_id: clientId,
              name: bookingData.customer_name,
              phone: customerPhone,
              whatsapp_chat_id: chatId
            })
            .select()
            .single();
          customerId = newCustomer.id;
        }

        // Verificar disponibilidade
        const { data: slotsRes } = await supabase.functions.invoke('get-available-slots', {
          body: { 
            professionalId: bookingData.professional_id, 
            serviceId: bookingData.service_id, 
            date: bookingData.date 
          }
        });

        const requestedSlot = slotsRes?.slots?.find((slot: any) => 
          slot.start === bookingData.time && slot.available
        );

        if (!requestedSlot) {
          return new Response(JSON.stringify({ 
            response: "Desculpe, o horário solicitado não está disponível. Vou verificar outros horários disponíveis para você.",
            action: 'show_alternatives'
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        // Calcular horário de fim baseado na duração do serviço
        const service = services.find(s => s.id === bookingData.service_id);
        const startTime = new Date(`${bookingData.date}T${bookingData.time}`);
        const endTime = new Date(startTime.getTime() + (service.duration_minutes * 60000));

        // Criar agendamento
        const { data: appointment } = await supabase
          .from('appointments')
          .insert({
            client_id: clientId,
            customer_id: customerId,
            professional_id: bookingData.professional_id,
            service_id: bookingData.service_id,
            appointment_date: bookingData.date,
            start_time: bookingData.time,
            end_time: endTime.toTimeString().slice(0, 5),
            status: 'scheduled',
            created_by_assistant: true
          })
          .select(`
            *,
            professional:professionals(name),
            service:services(name)
          `)
          .single();

        return new Response(JSON.stringify({ 
          response: `✅ Agendamento realizado com sucesso!\n\n📅 Data: ${new Date(bookingData.date).toLocaleDateString('pt-BR')}\n⏰ Horário: ${bookingData.time}\n👨‍⚕️ Profissional: ${appointment.professional.name}\n🏥 Serviço: ${appointment.service.name}\n\nSeu agendamento foi confirmado!`,
          action: 'appointment_created',
          appointmentId: appointment.id
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });

      } catch (error) {
        console.error('Erro ao processar agendamento:', error);
        return new Response(JSON.stringify({ 
          response: "Ocorreu um erro ao processar seu agendamento. Pode repetir os dados novamente?"
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // Verificar se é consulta de disponibilidade
    if (responseText.includes('CONSULTAR:')) {
      try {
        const consultData = JSON.parse(responseText.split('CONSULTAR:')[1].trim());
        
        const { data: slotsRes } = await supabase.functions.invoke('get-available-slots', {
          body: consultData
        });

        const availableSlots = slotsRes?.slots?.filter((slot: any) => slot.available) || [];
        
        if (availableSlots.length === 0) {
          return new Response(JSON.stringify({ 
            response: "Não há horários disponíveis para esta data. Gostaria de verificar outra data?"
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        const slotsText = availableSlots.slice(0, 6).map((slot: any) => 
          `⏰ ${slot.start}`
        ).join('\n');

        return new Response(JSON.stringify({ 
          response: `Horários disponíveis para ${new Date(consultData.date).toLocaleDateString('pt-BR')}:\n\n${slotsText}\n\nQual horário você prefere?`
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });

      } catch (error) {
        console.error('Erro ao consultar disponibilidade:', error);
      }
    }

    // Resposta normal do assistente
    return new Response(JSON.stringify({ 
      response: responseText
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in ai-booking-assistant function:', error);
    return new Response(JSON.stringify({ 
      response: "Desculpe, ocorreu um erro. Pode tentar novamente?" 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
