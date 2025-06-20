
import { supabase } from "@/integrations/supabase/client";

export interface ClientData {
  id: string;
  name: string;
  email: string;
  phone?: string;
  company?: string;
  plan: 'basic' | 'standard' | 'premium' | 'enterprise';
  max_instances: number;
  current_instances: number;
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
  plan?: 'basic' | 'standard' | 'premium' | 'enterprise';
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
        .insert([{
          ...clientData,
          plan: clientData.plan || 'basic'
        }])
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
  },

  // Get all instances for a client
  async getClientInstances(clientId: string) {
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

  // Check if client can create more instances
  async canCreateInstance(clientId: string): Promise<boolean> {
    try {
      const { data: client, error } = await supabase
        .from('clients')
        .select('current_instances, max_instances')
        .eq('id', clientId)
        .single();

      if (error) throw error;
      
      return client.current_instances < client.max_instances;
    } catch (error) {
      console.error('Error checking instance limit:', error);
      return false;
    }
  }
};
