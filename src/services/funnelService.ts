
import { supabase } from "@/integrations/supabase/client";

export interface FunnelTag {
  id: string;
  client_id: string;
  name: string;
  color: string;
  description?: string;
  position: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface FunnelStage {
  id: string;
  client_id: string;
  name: string;
  description?: string;
  color: string;
  position: number;
  is_active: boolean;
  auto_move_conditions: any;
  created_at: string;
  updated_at: string;
}

export interface FunnelLead {
  id: string;
  client_id: string;
  chat_id: string;
  instance_id: string;
  current_stage_id?: string;
  current_queue_id?: string;
  customer_name?: string;
  customer_phone?: string;
  customer_email?: string;
  lead_source: string;
  lead_value: number;
  priority: number;
  last_interaction: string;
  stage_entered_at: string;
  conversion_probability: number;
  notes: any[];
  custom_fields: any;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  current_stage?: FunnelStage;
  tags?: FunnelTag[];
}

export interface CreateFunnelStageData {
  name: string;
  description?: string;
  color?: string;
  position?: number;
}

export interface CreateFunnelTagData {
  name: string;
  color?: string;
  description?: string;
}

export interface UpdateFunnelLeadData {
  current_stage_id?: string;
  current_queue_id?: string;
  customer_name?: string;
  customer_phone?: string;
  customer_email?: string;
  lead_value?: number;
  priority?: number;
  conversion_probability?: number;
  notes?: any[];
  custom_fields?: any;
}

export const funnelService = {
  // Stages
  async getStages(clientId: string): Promise<FunnelStage[]> {
    try {
      const { data, error } = await supabase
        .rpc('get_funnel_stages', { client_id_param: clientId });

      if (error) {
        // Fallback direto se RPC não existir
        const { data: directData, error: directError } = await supabase
          .from('funnel_stages' as any)
          .select('*')
          .eq('client_id', clientId)
          .eq('is_active', true)
          .order('position', { ascending: true });
        
        if (directError) throw directError;
        return (directData || []) as FunnelStage[];
      }
      
      return (data || []) as FunnelStage[];
    } catch (error) {
      console.error('Error fetching funnel stages:', error);
      return [];
    }
  },

  async createStage(clientId: string, stageData: CreateFunnelStageData): Promise<FunnelStage> {
    try {
      const { data, error } = await supabase
        .from('funnel_stages' as any)
        .insert([{
          client_id: clientId,
          ...stageData,
          color: stageData.color || '#10B981'
        }])
        .select()
        .single();

      if (error) throw error;
      return data as FunnelStage;
    } catch (error) {
      console.error('Error creating funnel stage:', error);
      throw error;
    }
  },

  async updateStage(stageId: string, updates: Partial<FunnelStage>): Promise<FunnelStage> {
    try {
      const { data, error } = await supabase
        .from('funnel_stages' as any)
        .update(updates)
        .eq('id', stageId)
        .select()
        .single();

      if (error) throw error;
      return data as FunnelStage;
    } catch (error) {
      console.error('Error updating funnel stage:', error);
      throw error;
    }
  },

  async deleteStage(stageId: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('funnel_stages' as any)
        .update({ is_active: false })
        .eq('id', stageId);

      if (error) throw error;
    } catch (error) {
      console.error('Error deleting funnel stage:', error);
      throw error;
    }
  },

  // Tags
  async getTags(clientId: string): Promise<FunnelTag[]> {
    try {
      const { data, error } = await supabase
        .from('funnel_tags' as any)
        .select('*')
        .eq('client_id', clientId)
        .eq('is_active', true)
        .order('position', { ascending: true });

      if (error) throw error;
      return (data || []) as FunnelTag[];
    } catch (error) {
      console.error('Error fetching funnel tags:', error);
      return [];
    }
  },

  async createTag(clientId: string, tagData: CreateFunnelTagData): Promise<FunnelTag> {
    try {
      const { data, error } = await supabase
        .from('funnel_tags' as any)
        .insert([{
          client_id: clientId,
          ...tagData,
          color: tagData.color || '#3B82F6'
        }])
        .select()
        .single();

      if (error) throw error;
      return data as FunnelTag;
    } catch (error) {
      console.error('Error creating funnel tag:', error);
      throw error;
    }
  },

  // Leads
  async getLeads(clientId: string): Promise<FunnelLead[]> {
    try {
      const { data, error } = await supabase
        .from('funnel_leads' as any)
        .select(`
          *,
          current_stage:funnel_stages(*),
          tags:funnel_lead_tags(
            funnel_tags(*)
          )
        `)
        .eq('client_id', clientId)
        .eq('is_active', true)
        .order('last_interaction', { ascending: false });

      if (error) throw error;
      
      return ((data || []) as any[]).map((lead: any) => ({
        ...lead,
        tags: lead.tags?.map((tagRel: any) => tagRel.funnel_tags).filter(Boolean) || []
      })) as FunnelLead[];
    } catch (error) {
      console.error('Error fetching funnel leads:', error);
      return [];
    }
  },

  async getLeadsByStage(clientId: string, stageId: string): Promise<FunnelLead[]> {
    try {
      const { data, error } = await supabase
        .from('funnel_leads' as any)
        .select(`
          *,
          current_stage:funnel_stages(*),
          tags:funnel_lead_tags(
            funnel_tags(*)
          )
        `)
        .eq('client_id', clientId)
        .eq('current_stage_id', stageId)
        .eq('is_active', true)
        .order('priority', { ascending: false })
        .order('last_interaction', { ascending: false });

      if (error) throw error;
      
      return ((data || []) as any[]).map((lead: any) => ({
        ...lead,
        tags: lead.tags?.map((tagRel: any) => tagRel.funnel_tags).filter(Boolean) || []
      })) as FunnelLead[];
    } catch (error) {
      console.error('Error fetching leads by stage:', error);
      return [];
    }
  },

  async createLead(clientId: string, leadData: Partial<FunnelLead>): Promise<FunnelLead> {
    try {
      const { data, error } = await supabase
        .from('funnel_leads' as any)
        .insert([{
          client_id: clientId,
          ...leadData
        }])
        .select()
        .single();

      if (error) throw error;
      return data as FunnelLead;
    } catch (error) {
      console.error('Error creating funnel lead:', error);
      throw error;
    }
  },

  async updateLead(leadId: string, updates: UpdateFunnelLeadData): Promise<FunnelLead> {
    try {
      const { data, error } = await supabase
        .from('funnel_leads' as any)
        .update(updates)
        .eq('id', leadId)
        .select()
        .single();

      if (error) throw error;
      return data as FunnelLead;
    } catch (error) {
      console.error('Error updating funnel lead:', error);
      throw error;
    }
  },

  async moveLeadToStage(leadId: string, newStageId: string, reason?: string): Promise<void> {
    try {
      // Buscar estado atual do lead
      const { data: currentLead, error: fetchError } = await supabase
        .from('funnel_leads' as any)
        .select('current_stage_id, current_queue_id')
        .eq('id', leadId)
        .single();

      if (fetchError) throw fetchError;

      // Atualizar o lead
      const { error: updateError } = await supabase
        .from('funnel_leads' as any)
        .update({
          current_stage_id: newStageId,
          stage_entered_at: new Date().toISOString()
        })
        .eq('id', leadId);

      if (updateError) throw updateError;

      // Criar histórico
      const { error: historyError } = await supabase
        .from('funnel_lead_history' as any)
        .insert([{
          lead_id: leadId,
          from_stage_id: currentLead.current_stage_id,
          to_stage_id: newStageId,
          moved_by: 'user',
          reason: reason || 'Movido manualmente'
        }]);

      if (historyError) throw historyError;
    } catch (error) {
      console.error('Error moving lead to stage:', error);
      throw error;
    }
  },

  async assignTagToLead(leadId: string, tagId: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('funnel_lead_tags' as any)
        .insert([{
          lead_id: leadId,
          tag_id: tagId,
          assigned_by: 'user'
        }]);

      if (error && error.code !== '23505') { // Ignore duplicate key errors
        throw error;
      }
    } catch (error) {
      console.error('Error assigning tag to lead:', error);
      throw error;
    }
  },

  async removeTagFromLead(leadId: string, tagId: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('funnel_lead_tags' as any)
        .delete()
        .eq('lead_id', leadId)
        .eq('tag_id', tagId);

      if (error) throw error;
    } catch (error) {
      console.error('Error removing tag from lead:', error);
      throw error;
    }
  },

  // Reordenar stages
  async reorderStages(clientId: string, stageIds: string[]): Promise<void> {
    try {
      const updates = stageIds.map((id, index) => ({
        id,
        position: index
      }));

      for (const update of updates) {
        await supabase
          .from('funnel_stages' as any)
          .update({ position: update.position })
          .eq('id', update.id)
          .eq('client_id', clientId);
      }
    } catch (error) {
      console.error('Error reordering stages:', error);
      throw error;
    }
  }
};
