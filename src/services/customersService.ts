
import { supabase } from "@/integrations/supabase/client";

export interface Customer {
  id: string;
  client_id: string;
  name: string;
  email?: string;
  phone: string;
  whatsapp_chat_id?: string;
  birth_date?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export const customersService = {
  async getClientCustomers(clientId: string): Promise<Customer[]> {
    const { data, error } = await supabase
      .from('customers')
      .select('*')
      .eq('client_id', clientId)
      .order('name');

    if (error) throw error;
    return data || [];
  },

  async createCustomer(customer: Omit<Customer, 'id' | 'created_at' | 'updated_at'>): Promise<Customer> {
    const { data, error } = await supabase
      .from('customers')
      .insert(customer)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async findOrCreateByPhone(clientId: string, phone: string, name?: string): Promise<Customer> {
    // Primeiro tenta encontrar cliente existente
    const { data: existing } = await supabase
      .from('customers')
      .select('*')
      .eq('client_id', clientId)
      .eq('phone', phone)
      .maybeSingle();

    if (existing) {
      return existing;
    }

    // Se não encontrou, cria novo
    return this.createCustomer({
      client_id: clientId,
      name: name || phone,
      phone
    });
  },

  async updateCustomer(id: string, updates: Partial<Customer>): Promise<Customer> {
    const { data, error } = await supabase
      .from('customers')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async deleteCustomer(id: string): Promise<void> {
    const { error } = await supabase
      .from('customers')
      .delete()
      .eq('id', id);

    if (error) throw error;
  }
};
