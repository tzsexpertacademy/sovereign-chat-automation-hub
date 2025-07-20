import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import type { Json } from "@/integrations/supabase/types";

type SubscriptionPlanRow = Database['public']['Tables']['subscription_plans']['Row'];

export interface SubscriptionPlan {
  id: string;
  name: string;
  slug: string;
  description?: string;
  max_instances: number;
  price_monthly: number;
  price_yearly: number;
  features: string[];
  is_active: boolean;
  display_order: number;
  color: string;
  created_at: string;
  updated_at: string;
}

export interface CreatePlanData {
  name: string;
  slug: string;
  description?: string;
  max_instances: number;
  price_monthly: number;
  price_yearly: number;
  features: string[];
  is_active?: boolean;
  display_order?: number;
  color?: string;
}

export interface PlanMetrics {
  plan_id: string;
  plan_name: string;
  plan_slug: string;
  total_clients: number;
  active_clients: number;
  monthly_revenue: number;
  yearly_revenue: number;
  conversion_rate: number;
}

// Helper function to convert database row to SubscriptionPlan
function convertRowToPlan(row: SubscriptionPlanRow): SubscriptionPlan {
  return {
    ...row,
    features: Array.isArray(row.features) 
      ? row.features as string[]
      : typeof row.features === 'string' 
        ? JSON.parse(row.features) 
        : [],
    description: row.description || undefined
  };
}

export const plansService = {
  async getAllPlans(): Promise<SubscriptionPlan[]> {
    const { data, error } = await supabase
      .from('subscription_plans')
      .select('*')
      .order('display_order', { ascending: true });

    if (error) {
      console.error('Erro ao buscar planos:', error);
      throw new Error('Falha ao carregar planos');
    }

    return (data || []).map(convertRowToPlan);
  },

  async getActivePlans(): Promise<SubscriptionPlan[]> {
    const { data, error } = await supabase
      .from('subscription_plans')
      .select('*')
      .eq('is_active', true)
      .order('display_order', { ascending: true });

    if (error) {
      console.error('Erro ao buscar planos ativos:', error);
      throw new Error('Falha ao carregar planos ativos');
    }

    return (data || []).map(convertRowToPlan);
  },

  async createPlan(planData: CreatePlanData): Promise<SubscriptionPlan> {
    const { data, error } = await supabase
      .from('subscription_plans')
      .insert([{
        ...planData,
        is_active: planData.is_active ?? true,
        display_order: planData.display_order ?? 0,
        color: planData.color ?? '#3B82F6'
      }])
      .select()
      .single();

    if (error) {
      console.error('Erro ao criar plano:', error);
      throw new Error('Falha ao criar plano');
    }

    return convertRowToPlan(data);
  },

  async updatePlan(id: string, updates: Partial<CreatePlanData>): Promise<SubscriptionPlan> {
    const { data, error } = await supabase
      .from('subscription_plans')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Erro ao atualizar plano:', error);
      throw new Error('Falha ao atualizar plano');
    }

    return convertRowToPlan(data);
  },

  async deletePlan(id: string): Promise<void> {
    // Primeiro verificar se há clientes usando este plano
    const { data: clients, error: clientsError } = await supabase
      .from('clients')
      .select('id, plan')
      .limit(100);

    if (clientsError) {
      console.error('Erro ao verificar clientes:', clientsError);
      throw new Error('Falha ao verificar dependências do plano');
    }

    // Buscar o plano para verificar o slug
    const { data: plan } = await supabase
      .from('subscription_plans')
      .select('slug')
      .eq('id', id)
      .single();

    if (plan && clients) {
      const hasClients = clients.some(client => client.plan === plan.slug);
      if (hasClients) {
        throw new Error('Não é possível excluir um plano que possui clientes ativos');
      }
    }

    // Soft delete - marcar como inativo
    const { error } = await supabase
      .from('subscription_plans')
      .update({ is_active: false })
      .eq('id', id);

    if (error) {
      console.error('Erro ao excluir plano:', error);
      throw new Error('Falha ao excluir plano');
    }
  },

  async calculatePlansMetricsManual(): Promise<PlanMetrics[]> {
    try {
      // Buscar planos
      const { data: plans } = await supabase
        .from('subscription_plans')
        .select('*')
        .eq('is_active', true);

      if (!plans) return [];

      // Buscar clientes por plano
      const { data: allClients } = await supabase
        .from('clients')
        .select('plan, subscription_status');

      if (!allClients) return [];

      const metrics: PlanMetrics[] = [];

      for (const plan of plans) {
        const planClients = allClients.filter(client => client.plan === plan.slug);
        const totalClients = planClients.length;
        const activeClients = planClients.filter(c => c.subscription_status === 'active').length;

        metrics.push({
          plan_id: plan.id,
          plan_name: plan.name,
          plan_slug: plan.slug,
          total_clients: totalClients,
          active_clients: activeClients,
          monthly_revenue: activeClients * Number(plan.price_monthly),
          yearly_revenue: activeClients * Number(plan.price_yearly),
          conversion_rate: totalClients > 0 ? (activeClients / totalClients) * 100 : 0
        });
      }

      return metrics;
    } catch (error) {
      console.error('Erro ao calcular métricas manualmente:', error);
      return [];
    }
  },

  async getPlansMetrics(): Promise<PlanMetrics[]> {
    return this.calculatePlansMetricsManual();
  },

  async getTotalMetrics() {
    const metrics = await this.getPlansMetrics();
    
    return {
      totalPlans: metrics.length,
      totalClients: metrics.reduce((sum, m) => sum + m.total_clients, 0),
      activeClients: metrics.reduce((sum, m) => sum + m.active_clients, 0),
      totalMRR: metrics.reduce((sum, m) => sum + m.monthly_revenue, 0),
      totalARR: metrics.reduce((sum, m) => sum + m.yearly_revenue, 0),
      averageConversionRate: metrics.length > 0 
        ? metrics.reduce((sum, m) => sum + m.conversion_rate, 0) / metrics.length 
        : 0
    };
  }
};