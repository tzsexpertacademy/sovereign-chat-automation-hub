import { supabase } from "@/integrations/supabase/client";

export interface PersonalizationRequest {
  id?: string;
  client_id: string;
  title: string;
  category: string;
  priority: string;
  description: string;
  business_impact?: string;
  deadline?: string;
  budget_estimate?: string;
  technical_requirements?: any;
  attachments?: any;
  status?: string;
  admin_notes?: string;
  created_at?: string;
  updated_at?: string;
  completed_at?: string;
  clients?: {
    name: string;
    email: string;
    company?: string;
  };
}

export interface PersonalizationComment {
  id?: string;
  request_id: string;
  user_type: 'client' | 'admin';
  user_id: string;
  comment: string;
  attachments?: any;
  created_at?: string;
}

export const clientPersonalizationService = {
  async createRequest(clientId: string, request: Omit<Partial<PersonalizationRequest>, 'id' | 'client_id' | 'clients'>) {
    const { data, error } = await supabase
      .from('personalization_requests')
      .insert({
        client_id: clientId,
        title: request.title || '',
        category: request.category || 'funcionalidade', 
        priority: request.priority || 'media',
        description: request.description || '',
        business_impact: request.business_impact,
        deadline: request.deadline,
        budget_estimate: request.budget_estimate,
        technical_requirements: request.technical_requirements,
        attachments: request.attachments || []
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async getClientRequests(clientId: string) {
    const { data, error } = await supabase
      .from('personalization_requests')
      .select('*')
      .eq('client_id', clientId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data;
  },

  async updateRequest(requestId: string, updates: Partial<PersonalizationRequest>) {
    const { data, error } = await supabase
      .from('personalization_requests')
      .update(updates)
      .eq('id', requestId)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async addComment(requestId: string, userId: string, comment: string, userType: 'client' | 'admin' = 'client') {
    const { data, error } = await supabase
      .from('personalization_comments')
      .insert({
        request_id: requestId,
        user_id: userId,
        user_type: userType,
        comment
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async getRequestComments(requestId: string) {
    const { data, error } = await supabase
      .from('personalization_comments')
      .select('*')
      .eq('request_id', requestId)
      .order('created_at', { ascending: true });

    if (error) throw error;
    return data;
  },

  async uploadAttachment(file: File, requestId: string) {
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${requestId}/${Date.now()}.${fileExt}`;

      const { data, error } = await supabase.storage
        .from('client-assets')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (error) throw error;

      const { data: { publicUrl } } = supabase.storage
        .from('client-assets')
        .getPublicUrl(fileName);

      return publicUrl;
    } catch (error) {
      console.error('Erro no upload do anexo:', error);
      throw error;
    }
  }
};