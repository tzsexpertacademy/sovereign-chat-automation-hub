
import { supabase } from "@/integrations/supabase/client";
import { format, parseISO, addMinutes } from "date-fns";

export interface Appointment {
  id: string;
  client_id: string;
  customer_id: string;
  professional_id: string;
  service_id: string;
  appointment_date: string;
  start_time: string;
  end_time: string;
  status: 'scheduled' | 'confirmed' | 'cancelled' | 'completed' | 'no_show';
  notes?: string;
  google_event_id?: string;
  recurrence_type: 'none' | 'daily' | 'weekly' | 'monthly' | 'yearly';
  recurrence_end_date?: string;
  price?: number;
  created_by_assistant: boolean;
  created_at: string;
  updated_at: string;
}

export interface AppointmentWithDetails extends Appointment {
  customer: {
    id: string;
    name: string;
    phone: string;
    email?: string;
  };
  professional: {
    id: string;
    name: string;
    timezone: string;
  };
  service: {
    id: string;
    name: string;
    duration_minutes: number;
    color: string;
  };
}

export interface TimeSlot {
  start: string;
  end: string;
  available: boolean;
}

export const appointmentsService = {
  async getAppointments(clientId: string, filters?: {
    professionalId?: string;
    customerId?: string;
    startDate?: string;
    endDate?: string;
    status?: string;
  }): Promise<AppointmentWithDetails[]> {
    let query = supabase
      .from('appointments')
      .select(`
        *,
        customer:customers(id, name, phone, email),
        professional:professionals(id, name, timezone),
        service:services(id, name, duration_minutes, color)
      `)
      .eq('client_id', clientId);

    if (filters?.professionalId) {
      query = query.eq('professional_id', filters.professionalId);
    }
    if (filters?.customerId) {
      query = query.eq('customer_id', filters.customerId);
    }
    if (filters?.startDate) {
      query = query.gte('appointment_date', filters.startDate);
    }
    if (filters?.endDate) {
      query = query.lte('appointment_date', filters.endDate);
    }
    if (filters?.status) {
      query = query.eq('status', filters.status);
    }

    const { data, error } = await query.order('appointment_date').order('start_time');

    if (error) throw error;
    return data || [];
  },

  async createAppointment(appointment: Omit<Appointment, 'id' | 'created_at' | 'updated_at'>): Promise<Appointment> {
    const { data, error } = await supabase
      .from('appointments')
      .insert(appointment)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async updateAppointment(id: string, updates: Partial<Appointment>): Promise<Appointment> {
    const { data, error } = await supabase
      .from('appointments')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async cancelAppointment(id: string, reason?: string): Promise<void> {
    const { error } = await supabase
      .from('appointments')
      .update({ 
        status: 'cancelled',
        notes: reason ? `Cancelado: ${reason}` : 'Cancelado'
      })
      .eq('id', id);

    if (error) throw error;
  },

  async getAvailableTimeSlots(
    professionalId: string, 
    serviceId: string, 
    date: string
  ): Promise<TimeSlot[]> {
    const { data, error } = await supabase.functions.invoke('get-available-slots', {
      body: { professionalId, serviceId, date }
    });

    if (error) throw error;
    return data.slots || [];
  },

  async checkAvailability(
    professionalId: string,
    date: string,
    startTime: string,
    endTime: string,
    excludeAppointmentId?: string
  ): Promise<boolean> {
    let query = supabase
      .from('appointments')
      .select('id')
      .eq('professional_id', professionalId)
      .eq('appointment_date', date)
      .neq('status', 'cancelled')
      .or(`start_time.lt.${endTime},end_time.gt.${startTime}`);

    if (excludeAppointmentId) {
      query = query.neq('id', excludeAppointmentId);
    }

    const { data, error } = await query;
    if (error) throw error;

    return !data || data.length === 0;
  }
};
