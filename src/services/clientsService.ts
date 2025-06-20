
import { supabase } from "@/integrations/supabase/client";

export interface ClientData {
  id: string;
  name: string;
  email: string;
  phone?: string;
  company?: string;
  instance_id?: string;
  instance_status?: string;
  created_at: string;
  updated_at: string;
  last_activity: string;
}

export interface CreateClientData {
  name: string;
  email: string;
  phone?: string;
  company?: string;
}

export const clientsService = {
  // Get all clients
  async getAllClients(): Promise<ClientData[]> {
    try {
      const { data, error } = await supabase
        .from('clients')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      return data || [];
    } catch (error) {
      console.error('Error fetching clients:', error);
      throw error;
    }
  },

  // Create new client
  async createClient(clientData: CreateClientData): Promise<ClientData> {
    try {
      const { data, error } = await supabase
        .from('clients')
        .insert([clientData])
        .select()
        .single();

      if (error) throw error;
      
      return data;
    } catch (error) {
      console.error('Error creating client:', error);
      throw error;
    }
  },

  // Update client
  async updateClient(id: string, updates: Partial<ClientData>): Promise<ClientData> {
    try {
      const { data, error } = await supabase
        .from('clients')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      
      return data;
    } catch (error) {
      console.error('Error updating client:', error);
      throw error;
    }
  },

  // Delete client
  async deleteClient(id: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('clients')
        .delete()
        .eq('id', id);

      if (error) throw error;
    } catch (error) {
      console.error('Error deleting client:', error);
      throw error;
    }
  },

  // Update client instance info
  async updateClientInstance(id: string, instanceId: string, status: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('clients')
        .update({
          instance_id: instanceId,
          instance_status: status,
          last_activity: new Date().toISOString()
        })
        .eq('id', id);

      if (error) throw error;
    } catch (error) {
      console.error('Error updating client instance:', error);
      throw error;
    }
  },

  // Get client by instance ID
  async getClientByInstanceId(instanceId: string): Promise<ClientData | null> {
    try {
      const { data, error } = await supabase
        .from('clients')
        .select('*')
        .eq('instance_id', instanceId)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      
      return data || null;
    } catch (error) {
      console.error('Error fetching client by instance ID:', error);
      return null;
    }
  }
};
