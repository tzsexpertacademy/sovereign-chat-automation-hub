
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
  business_id?: string;
  business_token?: string;
  created_at: string;
  updated_at: string;
  last_activity: string;
  avatar_url?: string | null;
  company_logo_url?: string | null;
  brand_colors?: any;
  custom_theme?: any;
}

export interface CreateClientData {
  name: string;
  email: string;
  phone?: string;
  company?: string;
  plan?: 'basic' | 'standard' | 'premium' | 'enterprise';
}

// Função para obter o limite correto de instâncias por plano
export const getMaxInstancesForPlan = (plan: string): number => {
  switch (plan) {
    case 'basic': return 1;
    case 'standard': return 3;
    case 'premium': return 10;
    case 'enterprise': return 50;
    default: return 1;
  }
};

export const clientsService = {
  // Get all clients
  async getAllClients(): Promise<ClientData[]> {
    try {
      const { data, error } = await supabase
        .from('clients')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      // Garantir que o max_instances está correto baseado no plano
      const clientsWithCorrectLimits = (data || []).map(client => ({
        ...client,
        max_instances: getMaxInstancesForPlan(client.plan)
      })) as ClientData[];
      
      return clientsWithCorrectLimits;
    } catch (error) {
      console.error('Error fetching clients:', error);
      throw error;
    }
  },

  // Create new client
  async createClient(clientData: CreateClientData): Promise<ClientData> {
    try {
      console.log('🏢 Criando cliente e business no servidor Yumer...');
      
      // 1. Criar business no servidor Yumer
      const yumerResponse = await fetch('https://api.yumer.com.br/v2/business', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: clientData.name,
          email: clientData.email,
          phone: clientData.phone || '',
          country: 'BR',
          language: 'pt-BR',
          timezone: 'America/Sao_Paulo'
        })
      });

      if (!yumerResponse.ok) {
        const errorText = await yumerResponse.text();
        console.error('Erro na API Yumer:', errorText);
        throw new Error('Failed to create business in Yumer API');
      }

      const businessData = await yumerResponse.json();
      console.log('✅ Business criado no Yumer:', businessData.business_id);
      
      // 2. Criar cliente com business_id
      const plan = clientData.plan || 'basic';
      const maxInstances = getMaxInstancesForPlan(plan);

      const { data, error } = await supabase
        .from('clients')
        .insert([{
          ...clientData,
          plan,
          max_instances: maxInstances,
          business_id: businessData.business_id,
          business_token: businessData.business_token
        }])
        .select()
        .single();

      if (error) throw error;
      
      console.log('✅ Cliente criado com business_id:', businessData.business_id);
      return data as ClientData;
    } catch (error) {
      console.error('Error creating client:', error);
      throw error;
    }
  },

  // Update client
  async updateClient(id: string, updates: Partial<ClientData>): Promise<ClientData> {
    try {
      // Se o plano está sendo atualizado, calcular o novo max_instances
      if (updates.plan) {
        updates.max_instances = getMaxInstancesForPlan(updates.plan);
      }

      const { data, error } = await supabase
        .from('clients')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      
      return data as ClientData;
    } catch (error) {
      console.error('Error updating client:', error);
      throw error;
    }
  },

  // Delete client
  async deleteClient(id: string): Promise<void> {
    try {
      console.log('🗑️ Deletando cliente e business associado...');
      
      // 1. Buscar client para obter business_id
      const { data: client } = await supabase
        .from('clients')
        .select('business_id')
        .eq('id', id)
        .single();

      // 2. Deletar business do servidor Yumer se existir
      if (client?.business_id) {
        try {
          console.log('🗑️ Deletando business do Yumer:', client.business_id);
          const response = await fetch(`https://api.yumer.com.br/v2/business/${client.business_id}`, {
            method: 'DELETE',
            headers: {
              'Content-Type': 'application/json',
            }
          });
          
          if (response.ok) {
            console.log('✅ Business deletado do Yumer');
          } else {
            console.warn('⚠️ Falha ao deletar business do Yumer:', await response.text());
          }
        } catch (error) {
          console.warn('⚠️ Erro ao deletar business do Yumer:', error);
        }
      }

      // 3. Deletar cliente do banco local
      const { error } = await supabase
        .from('clients')
        .delete()
        .eq('id', id);

      if (error) throw error;
      
      console.log('✅ Cliente deletado com sucesso');
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
      
      return (data as ClientData) || null;
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
        .select('plan')
        .eq('id', clientId)
        .single();

      if (error) throw error;

      // Contar instâncias atuais
      const { data: instances, error: instancesError } = await supabase
        .from('whatsapp_instances')
        .select('id')
        .eq('client_id', clientId);

      if (instancesError) throw instancesError;

      const currentInstances = instances?.length || 0;
      const maxInstances = getMaxInstancesForPlan(client.plan);
      
      console.log(`🔍 Verificação de limite: Cliente ${clientId}, Plano ${client.plan}, Atual: ${currentInstances}/${maxInstances}`);
      
      return currentInstances < maxInstances;
    } catch (error) {
      console.error('Error checking instance limit:', error);
      return false;
    }
  }
};
