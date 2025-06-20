
import { supabase } from "@/integrations/supabase/client";

export interface Professional {
  id: string;
  client_id: string;
  name: string;
  email?: string;
  phone?: string;
  specialty?: string;
  description?: string;
  avatar_url?: string;
  google_calendar_id?: string;
  timezone: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ProfessionalWithServices extends Professional {
  services: Array<{
    id: string;
    name: string;
    duration_minutes: number;
    price?: number;
    color: string;
  }>;
}

export const professionalsService = {
  async getClientProfessionals(clientId: string): Promise<ProfessionalWithServices[]> {
    const { data, error } = await supabase
      .from('professionals')
      .select(`
        *,
        professional_services!inner(
          service:services(
            id,
            name,
            duration_minutes,
            price,
            color
          )
        )
      `)
      .eq('client_id', clientId)
      .eq('is_active', true);

    if (error) throw error;

    return data?.map(prof => ({
      ...prof,
      services: prof.professional_services?.map((ps: any) => ps.service) || []
    })) || [];
  },

  async createProfessional(professional: Omit<Professional, 'id' | 'created_at' | 'updated_at'>): Promise<Professional> {
    const { data, error } = await supabase
      .from('professionals')
      .insert(professional)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async updateProfessional(id: string, updates: Partial<Professional>): Promise<Professional> {
    const { data, error } = await supabase
      .from('professionals')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async deleteProfessional(id: string): Promise<void> {
    const { error } = await supabase
      .from('professionals')
      .delete()
      .eq('id', id);

    if (error) throw error;
  },

  async addServiceToProfessional(professionalId: string, serviceId: string): Promise<void> {
    const { error } = await supabase
      .from('professional_services')
      .insert({ professional_id: professionalId, service_id: serviceId });

    if (error) throw error;
  },

  async removeServiceFromProfessional(professionalId: string, serviceId: string): Promise<void> {
    const { error } = await supabase
      .from('professional_services')
      .delete()
      .eq('professional_id', professionalId)
      .eq('service_id', serviceId);

    if (error) throw error;
  }
};
