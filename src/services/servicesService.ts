
import { supabase } from "@/integrations/supabase/client";

export interface Service {
  id: string;
  client_id: string;
  name: string;
  description?: string;
  duration_minutes: number;
  price?: number;
  color: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export const servicesService = {
  async getClientServices(clientId: string): Promise<Service[]> {
    const { data, error } = await supabase
      .from('services')
      .select('*')
      .eq('client_id', clientId)
      .eq('is_active', true)
      .order('name');

    if (error) throw error;
    return data || [];
  },

  async createService(service: Omit<Service, 'id' | 'created_at' | 'updated_at'>): Promise<Service> {
    const { data, error } = await supabase
      .from('services')
      .insert(service)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async updateService(id: string, updates: Partial<Service>): Promise<Service> {
    const { data, error } = await supabase
      .from('services')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async deleteService(id: string): Promise<void> {
    const { error } = await supabase
      .from('services')
      .delete()
      .eq('id', id);

    if (error) throw error;
  }
};
