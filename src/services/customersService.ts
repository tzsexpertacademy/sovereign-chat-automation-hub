
import { supabase } from "@/integrations/supabase/client";

export interface Customer {
  id: string;
  client_id: string;
  name: string;
  phone: string;
  email?: string;
  whatsapp_chat_id?: string;
  notes?: string;
  birth_date?: string;
  created_at: string;
  updated_at: string;
}

export const customersService = {
  async getClientCustomers(clientId: string): Promise<Customer[]> {
    const { data, error } = await supabase
      .from('customers')
      .select('*')
      .eq('client_id', clientId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  async getCustomerById(customerId: string): Promise<Customer | null> {
    const { data, error } = await supabase
      .from('customers')
      .select('*')
      .eq('id', customerId)
      .single();

    if (error) throw error;
    return data;
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

  async updateCustomer(customerId: string, updates: Partial<Customer>): Promise<Customer> {
    const { data, error } = await supabase
      .from('customers')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', customerId)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async deleteCustomer(customerId: string): Promise<void> {
    const { error } = await supabase
      .from('customers')
      .delete()
      .eq('id', customerId);

    if (error) throw error;
  },

  async findByPhone(clientId: string, phone: string): Promise<Customer | null> {
    const { data, error } = await supabase
      .from('customers')
      .select('*')
      .eq('client_id', clientId)
      .eq('phone', phone)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return data;
  },

  async findByWhatsAppChatId(clientId: string, chatId: string): Promise<Customer | null> {
    const { data, error } = await supabase
      .from('customers')
      .select('*')
      .eq('client_id', clientId)
      .eq('whatsapp_chat_id', chatId)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return data;
  }
};
