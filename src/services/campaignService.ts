import { supabase } from "@/integrations/supabase/client";
import type { Tables, TablesInsert, TablesUpdate } from "@/integrations/supabase/types";

export type Campaign = Tables<"automated_campaigns">;
export type CampaignInsert = TablesInsert<"automated_campaigns">;
export type CampaignUpdate = TablesUpdate<"automated_campaigns">;

export interface CampaignTemplate {
  id: string;
  name: string;
  content: string;
  variables: string[];
  category: string;
}

export interface CampaignSegment {
  id: string;
  name: string;
  filters: {
    tags?: string[];
    lead_source?: string[];
    date_range?: {
      start: string;
      end: string;
    };
    funnel_stage?: string[];
    queue?: string[];
    status?: string[];
    custom_fields?: Record<string, any>;
  };
  contact_count: number;
}

export interface CampaignMetrics {
  campaign_id: string;
  total_sent: number;
  delivered: number;
  failed: number;
  opened: number;
  clicked: number;
  replied: number;
  delivery_rate: number;
  open_rate: number;
  click_rate: number;
  reply_rate: number;
  last_updated: string;
}

export interface CampaignStep {
  step: number;
  title: string;
  description: string;
  completed: boolean;
  data?: any;
}

export class CampaignService {
  async getCampaigns(clientId: string): Promise<Campaign[]> {
    console.log('📋 Buscando campanhas para cliente:', clientId);
    
    const { data, error } = await supabase
      .from("automated_campaigns")
      .select(`
        *,
        queues(name)
      `)
      .eq("client_id", clientId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error('❌ Erro ao buscar campanhas:', error);
      throw error;
    }
    
    console.log('✅ Campanhas carregadas:', data?.length || 0);
    return data || [];
  }

  async createCampaign(campaign: CampaignInsert): Promise<Campaign> {
    console.log('➕ Criando nova campanha:', campaign.name);
    
    const { data, error } = await supabase
      .from("automated_campaigns")
      .insert(campaign)
      .select()
      .single();

    if (error) {
      console.error('❌ Erro ao criar campanha:', error);
      throw error;
    }
    
    console.log('✅ Campanha criada:', data.id);
    return data;
  }

  async updateCampaign(id: string, updates: CampaignUpdate): Promise<Campaign> {
    const { data, error } = await supabase
      .from("automated_campaigns")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async deleteCampaign(id: string): Promise<void> {
    const { error } = await supabase
      .from("automated_campaigns")
      .delete()
      .eq("id", id);

    if (error) throw error;
  }

  async getCampaignMetrics(campaignId: string): Promise<CampaignMetrics> {
    // Como não temos tabela específica para métricas de campanhas,
    // vamos simular com dados das campanhas existentes
    const { data: campaign } = await supabase
      .from("automated_campaigns")
      .select("*")
      .eq("id", campaignId)
      .single();

    if (!campaign) {
      throw new Error("Campanha não encontrada");
    }

    const totalSent = campaign.send_count || 0;
    const delivered = campaign.success_count || 0;
    const failed = totalSent - delivered;

    // Simular métricas baseadas nos dados existentes
    const deliveryRate = totalSent > 0 ? (delivered / totalSent) * 100 : 0;
    const openRate = deliveryRate * 0.6; // Simulação: 60% dos entregues são abertos
    const clickRate = openRate * 0.15; // Simulação: 15% dos abertos geram cliques
    const replyRate = clickRate * 0.25; // Simulação: 25% dos cliques geram respostas

    return {
      campaign_id: campaignId,
      total_sent: totalSent,
      delivered,
      failed,
      opened: Math.round((delivered * openRate) / 100),
      clicked: Math.round((delivered * clickRate) / 100),
      replied: Math.round((delivered * replyRate) / 100),
      delivery_rate: deliveryRate,
      open_rate: openRate,
      click_rate: clickRate,
      reply_rate: replyRate,
      last_updated: new Date().toISOString()
    };
  }

  async getTemplates(clientId: string): Promise<CampaignTemplate[]> {
    // Templates padrão para campanhas
    return [
      {
        id: "welcome",
        name: "Boas-vindas",
        content: "Olá {{nome}}! 👋\n\nSeja bem-vindo(a) à {{empresa}}!\n\nEstamos aqui para ajudar com qualquer dúvida. Como podemos te auxiliar hoje?",
        variables: ["nome", "empresa"],
        category: "welcome"
      },
      {
        id: "follow_up",
        name: "Follow-up",
        content: "Oi {{nome}}! 😊\n\nPassando aqui para saber se ainda tem interesse em {{produto}}.\n\nTemos uma oferta especial que pode te interessar!",
        variables: ["nome", "produto"],
        category: "follow_up"
      },
      {
        id: "promotional",
        name: "Promocional",
        content: "🎉 {{nome}}, temos uma super promoção!\n\n{{descricao_promocao}}\n\nVálida até {{data_limite}}. Não perca!",
        variables: ["nome", "descricao_promocao", "data_limite"],
        category: "promotional"
      },
      {
        id: "reminder",
        name: "Lembrete",
        content: "📅 Lembrete para {{nome}}:\n\n{{evento}} está agendado para {{data}} às {{hora}}.\n\nConfirma sua presença?",
        variables: ["nome", "evento", "data", "hora"],
        category: "reminder"
      }
    ];
  }

  async getSegments(clientId: string): Promise<CampaignSegment[]> {
    try {
      // Buscar dados para criar segmentos automaticamente
      const [leadsData, tagsData, stagesData, queuesData, ticketsData] = await Promise.all([
        supabase.from("funnel_leads").select("*").eq("client_id", clientId).eq("is_active", true),
        supabase.from("funnel_tags").select("*").eq("client_id", clientId).eq("is_active", true),
        supabase.from("funnel_stages").select("*").eq("client_id", clientId).eq("is_active", true),
        supabase.from("queues").select("*").eq("client_id", clientId).eq("is_active", true),
        supabase.from("conversation_tickets").select("current_stage_id, assigned_queue_id").eq("client_id", clientId)
      ]);

      const leads = leadsData.data || [];
      const tags = tagsData.data || [];
      const stages = stagesData.data || [];
      const queues = queuesData.data || [];
      const tickets = ticketsData.data || [];

      const segments: CampaignSegment[] = [];

      // Segmento: Todos os contatos
      const totalContacts = Math.max(leads.length, tickets.length);
      segments.push({
        id: "all_contacts",
        name: "Todos os Contatos",
        filters: {},
        contact_count: totalContacts
      });

      // Segmentos por fonte de leads
      const sources = [...new Set(leads.map(l => l.lead_source))];
      sources.forEach(source => {
        const count = leads.filter(l => l.lead_source === source).length;
        if (count > 0) {
          segments.push({
            id: `source_${source}`,
            name: `Origem: ${source}`,
            filters: { lead_source: [source] },
            contact_count: count
          });
        }
      });

      // Segmentos por estágio do funil
      stages.forEach(stage => {
        const leadCount = leads.filter(l => l.current_stage_id === stage.id).length;
        const ticketCount = tickets.filter(t => t.current_stage_id === stage.id).length;
        const totalCount = Math.max(leadCount, ticketCount);
        
        if (totalCount > 0) {
          segments.push({
            id: `stage_${stage.id}`,
            name: `Estágio: ${stage.name}`,
            filters: { funnel_stage: [stage.id] },
            contact_count: totalCount
          });
        }
      });

      // Segmentos por tags
      for (const tag of tags) {
        // Buscar leads com esta tag
        const { data: leadTagsData } = await supabase
          .from("funnel_lead_tags")
          .select("lead_id")
          .eq("tag_id", tag.id);

        const taggedLeadsCount = leadTagsData?.length || 0;
        
        if (taggedLeadsCount > 0) {
          segments.push({
            id: `tag_${tag.id}`,
            name: `Tag: ${tag.name}`,
            filters: { tags: [tag.id] },
            contact_count: taggedLeadsCount
          });
        }
      }

      // Segmentos por fila
      queues.forEach(queue => {
        const queueLeadsCount = leads.filter(l => l.current_queue_id === queue.id).length;
        const queueTicketsCount = tickets.filter(t => t.assigned_queue_id === queue.id).length;
        const totalCount = Math.max(queueLeadsCount, queueTicketsCount);
        
        if (totalCount > 0) {
          segments.push({
            id: `queue_${queue.id}`,
            name: `Fila: ${queue.name}`,
            filters: { queue: [queue.id] },
            contact_count: totalCount
          });
        }
      });

      // Segmentos por status de lead
      const leadStatuses = [
        { status: 'new', name: 'Novos Leads', count: leads.filter(l => !l.current_stage_id).length },
        { status: 'active', name: 'Leads Ativos', count: leads.filter(l => l.is_active).length },
        { status: 'high_value', name: 'Alto Valor', count: leads.filter(l => l.lead_value > 1000).length },
        { status: 'high_priority', name: 'Alta Prioridade', count: leads.filter(l => l.priority >= 3).length }
      ];

      leadStatuses.forEach(({ status, name, count }) => {
        if (count > 0) {
          segments.push({
            id: `status_${status}`,
            name: name,
            filters: { status: [status] },
            contact_count: count
          });
        }
      });

      return segments;
    } catch (error) {
      console.error('Erro ao buscar segmentos:', error);
      return [{
        id: "all_contacts",
        name: "Todos os Contatos",
        filters: {},
        contact_count: 0
      }];
    }
  }

  async validateCampaignStep(step: number, data: any): Promise<{ valid: boolean; errors: string[] }> {
    const errors: string[] = [];

    switch (step) {
      case 1: // Informações básicas
        if (!data.name?.trim()) errors.push("Nome da campanha é obrigatório");
        if (!data.description?.trim()) errors.push("Descrição é obrigatória");
        break;
        
      case 2: // Segmentação
        if (!data.segment_id) errors.push("Selecione um segmento");
        if (data.contact_count === 0) errors.push("Segmento selecionado não possui contatos");
        break;
        
      case 3: // Mensagem
        if (!data.template_id && !data.custom_message?.trim()) {
          errors.push("Selecione um template ou escreva uma mensagem personalizada");
        }
        break;
        
      case 4: // Agendamento
        if (data.schedule_type === 'scheduled' && !data.send_date) {
          errors.push("Data de envio é obrigatória para campanhas agendadas");
        }
        break;
        
      case 5: // Fila de destino
        if (!data.queue_id) errors.push("Selecione uma fila para respostas");
        break;
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  async previewCampaign(campaignData: any): Promise<{
    message_preview: string;
    estimated_contacts: number;
    estimated_cost: number;
    send_window: {
      start: string;
      end: string;
    };
  }> {
    // Processar template com variáveis de exemplo
    let messagePreview = campaignData.message || "";
    const variables = messagePreview.match(/\{\{(\w+)\}\}/g) || [];
    
    variables.forEach(variable => {
      const varName = variable.replace(/\{\{|\}\}/g, '');
      const exampleValue = this.getExampleValue(varName);
      messagePreview = messagePreview.replace(variable, exampleValue);
    });

    // Calcular contatos estimados baseado no segmento
    const segment = await this.getSegmentContactCount(campaignData.segment_id);
    
    return {
      message_preview: messagePreview,
      estimated_contacts: segment.contact_count,
      estimated_cost: segment.contact_count * 0.10, // R$ 0,10 por mensagem
      send_window: {
        start: campaignData.send_date || new Date().toISOString(),
        end: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() // +24h
      }
    };
  }

  private getExampleValue(varName: string): string {
    const examples: Record<string, string> = {
      'nome': 'João Silva',
      'empresa': 'Sua Empresa',
      'produto': 'Produto XYZ',
      'data': new Date().toLocaleDateString('pt-BR'),
      'hora': '14:30',
      'evento': 'Reunião',
      'descricao_promocao': '50% de desconto',
      'data_limite': new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toLocaleDateString('pt-BR')
    };
    
    return examples[varName] || `[${varName}]`;
  }

  private async getSegmentContactCount(segmentId: string): Promise<{ contact_count: number }> {
    // Aqui implementaríamos a lógica para contar contatos do segmento
    // Por agora, retornamos um valor simulado
    return { contact_count: Math.floor(Math.random() * 100) + 10 };
  }
}

export const campaignService = new CampaignService();