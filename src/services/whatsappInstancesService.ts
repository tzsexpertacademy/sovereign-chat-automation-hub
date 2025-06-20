
import { supabase } from "@/integrations/supabase/client";

export interface WhatsAppInstanceData {
  id: string;
  client_id: string;
  instance_id: string;
  status: string;
  phone_number?: string;
  qr_code?: string;
  has_qr_code: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateInstanceData {
  client_id: string;
  instance_id: string;
  status?: string;
}

export const whatsappInstancesService = {
  // Get all instances
  async getAllInstances(): Promise<WhatsAppInstanceData[]> {
    try {
      const { data, error } = await supabase
        .from('whatsapp_instances')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      return data || [];
    } catch (error) {
      console.error('Error fetching instances:', error);
      throw error;
    }
  },

  // Get instances by client ID
  async getInstancesByClientId(clientId: string): Promise<WhatsAppInstanceData[]> {
    try {
      const { data, error } = await supabase
        .from('whatsapp_instances')
        .select('*')
        .eq('client_id', clientId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      return data || [];
    } catch (error) {
      console.error('Error fetching client instances:', error);
      throw error;
    }
  },

  // Create new instance
  async createInstance(instanceData: CreateInstanceData): Promise<WhatsAppInstanceData> {
    try {
      const { data, error } = await supabase
        .from('whatsapp_instances')
        .insert([{
          ...instanceData,
          status: instanceData.status || 'connecting'
        }])
        .select()
        .single();

      if (error) throw error;
      
      return data;
    } catch (error) {
      console.error('Error creating instance:', error);
      throw error;
    }
  },

  // Update instance
  async updateInstance(instanceId: string, updates: Partial<WhatsAppInstanceData>): Promise<WhatsAppInstanceData> {
    try {
      const { data, error } = await supabase
        .from('whatsapp_instances')
        .update(updates)
        .eq('instance_id', instanceId)
        .select()
        .single();

      if (error) throw error;
      
      return data;
    } catch (error) {
      console.error('Error updating instance:', error);
      throw error;
    }
  },

  // Delete instance
  async deleteInstance(instanceId: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('whatsapp_instances')
        .delete()
        .eq('instance_id', instanceId);

      if (error) throw error;
    } catch (error) {
      console.error('Error deleting instance:', error);
      throw error;
    }
  },

  // Get instance by instance ID
  async getInstanceByInstanceId(instanceId: string): Promise<WhatsAppInstanceData | null> {
    try {
      const { data, error } = await supabase
        .from('whatsapp_instances')
        .select('*')
        .eq('instance_id', instanceId)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      
      return data || null;
    } catch (error) {
      console.error('Error fetching instance:', error);
      return null;
    }
  }
};
