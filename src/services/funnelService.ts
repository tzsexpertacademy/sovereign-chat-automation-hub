
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
        .from('funnel_stages')
        .select('*')
        .eq('client_id', clientId)
        .eq('is_active', true)
        .order('position', { ascending: true });
      
      if (error) throw error;
      return (data || []) as FunnelStage[];
    } catch (error) {
      console.error('Error fetching funnel stages:', error);
      return [];
    }
  },

  async createStage(clientId: string, stageData: CreateFunnelStageData): Promise<FunnelStage> {
    try {
      const { data, error } = await supabase
        .from('funnel_stages')
        .insert({
          client_id: clientId,
          ...stageData,
          color: stageData.color || '#10B981'
        })
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
        .from('funnel_stages')
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
        .from('funnel_stages')
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
        .from('funnel_tags')
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
        .from('funnel_tags')
        .insert({
          client_id: clientId,
          ...tagData,
          color: tagData.color || '#3B82F6'
        })
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
      // Buscar leads básicos
      const { data: leadsData, error: leadsError } = await supabase
        .from('funnel_leads')
        .select('*')
        .eq('client_id', clientId)
        .eq('is_active', true)
        .order('last_interaction', { ascending: false });

      if (leadsError) throw leadsError;
      
      if (!leadsData || leadsData.length === 0) {
        return [];
      }

      // Buscar stages relacionados
      const { data: stagesData } = await supabase
        .from('funnel_stages')
        .select('*')
        .eq('client_id', clientId);

      // Buscar tags para cada lead
      const { data: leadTagsData } = await supabase
        .from('funnel_lead_tags')
        .select(`
          lead_id,
          funnel_tags (*)
        `)
        .in('lead_id', leadsData.map(lead => lead.id));

      // Montar os leads com as relações
      return leadsData.map((lead: any) => {
        const currentStage = stagesData?.find(stage => stage.id === lead.current_stage_id);
        const leadTags = leadTagsData?.filter(lt => lt.lead_id === lead.id)
          .map(lt => lt.funnel_tags).filter(Boolean) || [];

        return {
          ...lead,
          current_stage: currentStage,
          tags: leadTags
        } as FunnelLead;
      });
    } catch (error) {
      console.error('Error fetching funnel leads:', error);
      return [];
    }
  },

  async getLeadsByStage(clientId: string, stageId: string): Promise<FunnelLead[]> {
    try {
      const { data, error } = await supabase
        .from('funnel_leads')
        .select('*')
        .eq('client_id', clientId)
        .eq('current_stage_id', stageId)
        .eq('is_active', true)
        .order('priority', { ascending: false })
        .order('last_interaction', { ascending: false });

      if (error) throw error;
      return (data || []) as FunnelLead[];
    } catch (error) {
      console.error('Error fetching leads by stage:', error);
      return [];
    }
  },

  async createLead(clientId: string, leadData: Partial<FunnelLead>): Promise<FunnelLead> {
    try {
      // Remover propriedades que não existem na tabela
      const { current_stage, tags, ...cleanLeadData } = leadData;
      
      const { data, error } = await supabase
        .from('funnel_leads')
        .insert({
          client_id: clientId,
          chat_id: cleanLeadData.chat_id || '',
          instance_id: cleanLeadData.instance_id || '',
          ...cleanLeadData
        })
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
        .from('funnel_leads')
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
        .from('funnel_leads')
        .select('current_stage_id, current_queue_id')
        .eq('id', leadId)
        .single();

      if (fetchError) throw fetchError;

      // Atualizar o lead
      const { error: updateError } = await supabase
        .from('funnel_leads')
        .update({
          current_stage_id: newStageId,
          stage_entered_at: new Date().toISOString()
        })
        .eq('id', leadId);

      if (updateError) throw updateError;

      // Criar histórico
      const { error: historyError } = await supabase
        .from('funnel_lead_history')
        .insert({
          lead_id: leadId,
          from_stage_id: currentLead?.current_stage_id,
          to_stage_id: newStageId,
          moved_by: 'user',
          reason: reason || 'Movido manualmente'
        });

      if (historyError) throw historyError;
    } catch (error) {
      console.error('Error moving lead to stage:', error);
      throw error;
    }
  },

  async assignTagToLead(leadId: string, tagId: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('funnel_lead_tags')
        .insert({
          lead_id: leadId,
          tag_id: tagId,
          assigned_by: 'user'
        });

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
        .from('funnel_lead_tags')
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
          .from('funnel_stages')
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
