
import { supabase } from "@/integrations/supabase/client";

export interface WorkSchedule {
  id: string;
  professional_id: string;
  day_of_week: 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';
  start_time: string;
  end_time: string;
  break_start_time?: string | null;
  break_end_time?: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export const workScheduleService = {
  async getProfessionalSchedules(professionalId: string): Promise<WorkSchedule[]> {
    const { data, error } = await supabase
      .from('professional_schedules')
      .select('*')
      .eq('professional_id', professionalId)
      .order('day_of_week');

    if (error) throw error;
    return data || [];
  },

  async createSchedule(schedule: Omit<WorkSchedule, 'id' | 'created_at' | 'updated_at'>): Promise<WorkSchedule> {
    const { data, error } = await supabase
      .from('professional_schedules')
      .insert(schedule)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async updateSchedule(id: string, updates: Partial<WorkSchedule>): Promise<WorkSchedule> {
    const { data, error } = await supabase
      .from('professional_schedules')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async deleteSchedule(id: string): Promise<void> {
    const { error } = await supabase
      .from('professional_schedules')
      .delete()
      .eq('id', id);

    if (error) throw error;
  },

  async copyScheduleToOtherDays(
    professionalId: string, 
    sourceDayOfWeek: string, 
    targetDays: string[]
  ): Promise<void> {
    // Buscar o horário de origem
    const { data: sourceSchedule, error: fetchError } = await supabase
      .from('professional_schedules')
      .select('*')
      .eq('professional_id', professionalId)
      .eq('day_of_week', sourceDayOfWeek)
      .single();

    if (fetchError) throw fetchError;

    // Criar horários para os dias alvo
    const schedulesToCreate = targetDays.map(day => ({
      professional_id: professionalId,
      day_of_week: day,
      start_time: sourceSchedule.start_time,
      end_time: sourceSchedule.end_time,
      break_start_time: sourceSchedule.break_start_time,
      break_end_time: sourceSchedule.break_end_time,
      is_active: sourceSchedule.is_active
    }));

    const { error: insertError } = await supabase
      .from('professional_schedules')
      .upsert(schedulesToCreate, {
        onConflict: 'professional_id,day_of_week'
      });

    if (insertError) throw insertError;
  }
};
