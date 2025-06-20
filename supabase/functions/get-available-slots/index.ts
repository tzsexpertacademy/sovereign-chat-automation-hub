
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
    const { professionalId, serviceId, date } = await req.json();

    // Buscar dados do profissional e serviço
    const [professionalRes, serviceRes] = await Promise.all([
      supabase.from('professionals').select('timezone').eq('id', professionalId).single(),
      supabase.from('services').select('duration_minutes').eq('id', serviceId).single()
    ]);

    if (professionalRes.error || serviceRes.error) {
      throw new Error('Profissional ou serviço não encontrado');
    }

    const professional = professionalRes.data;
    const service = serviceRes.data;

    // Buscar horário de trabalho do profissional para o dia da semana
    const dayOfWeek = new Date(date).toLocaleDateString('en-US', { weekday: 'lowercase' });
    const { data: schedule } = await supabase
      .from('professional_schedules')
      .select('*')
      .eq('professional_id', professionalId)
      .eq('day_of_week', dayOfWeek)
      .eq('is_active', true)
      .maybeSingle();

    if (!schedule) {
      return new Response(JSON.stringify({ slots: [] }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Buscar agendamentos existentes
    const { data: appointments } = await supabase
      .from('appointments')
      .select('start_time, end_time')
      .eq('professional_id', professionalId)
      .eq('appointment_date', date)
      .neq('status', 'cancelled');

    // Buscar bloqueios de agenda
    const startOfDay = `${date}T00:00:00`;
    const endOfDay = `${date}T23:59:59`;
    const { data: blocks } = await supabase
      .from('schedule_blocks')
      .select('start_datetime, end_datetime')
      .eq('professional_id', professionalId)
      .gte('start_datetime', startOfDay)
      .lte('end_datetime', endOfDay);

    // Gerar slots disponíveis
    const slots = [];
    const startTime = new Date(`${date}T${schedule.start_time}`);
    const endTime = new Date(`${date}T${schedule.end_time}`);
    const slotDuration = service.duration_minutes;
    const slotInterval = 30; // Intervalo de 30 minutos entre slots

    let currentTime = new Date(startTime);

    while (currentTime.getTime() + (slotDuration * 60000) <= endTime.getTime()) {
      const slotStart = new Date(currentTime);
      const slotEnd = new Date(currentTime.getTime() + (slotDuration * 60000));

      // Verificar se está no horário de almoço
      let isDuringBreak = false;
      if (schedule.break_start_time && schedule.break_end_time) {
        const breakStart = new Date(`${date}T${schedule.break_start_time}`);
        const breakEnd = new Date(`${date}T${schedule.break_end_time}`);
        isDuringBreak = slotStart < breakEnd && slotEnd > breakStart;
      }

      // Verificar conflito com agendamentos
      const hasAppointmentConflict = appointments?.some(apt => {
        const aptStart = new Date(`${date}T${apt.start_time}`);
        const aptEnd = new Date(`${date}T${apt.end_time}`);
        return slotStart < aptEnd && slotEnd > aptStart;
      });

      // Verificar conflito com bloqueios
      const hasBlockConflict = blocks?.some(block => {
        const blockStart = new Date(block.start_datetime);
        const blockEnd = new Date(block.end_datetime);
        return slotStart < blockEnd && slotEnd > blockStart;
      });

      const isAvailable = !isDuringBreak && !hasAppointmentConflict && !hasBlockConflict;

      slots.push({
        start: slotStart.toTimeString().slice(0, 5),
        end: slotEnd.toTimeString().slice(0, 5),
        available: isAvailable
      });

      currentTime = new Date(currentTime.getTime() + (slotInterval * 60000));
    }

    return new Response(JSON.stringify({ slots }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in get-available-slots function:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
