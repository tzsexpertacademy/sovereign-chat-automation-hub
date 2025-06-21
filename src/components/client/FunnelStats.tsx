
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { type FunnelLead, type FunnelStage } from "@/services/funnelService";
import { 
  Users, 
  DollarSign, 
  TrendingUp, 
  Target,
  Calendar,
  Filter
} from 'lucide-react';

interface FunnelStatsProps {
  leads: FunnelLead[];
  stages: FunnelStage[];
}

const FunnelStats: React.FC<FunnelStatsProps> = ({ leads, stages }) => {
  // Calcular estatísticas gerais
  const totalLeads = leads.length;
  const totalValue = leads.reduce((sum, lead) => sum + (lead.lead_value || 0), 0);
  const averageValue = totalLeads > 0 ? totalValue / totalLeads : 0;
  const avgConversionProbability = totalLeads > 0 
    ? leads.reduce((sum, lead) => sum + (lead.conversion_probability || 0), 0) / totalLeads 
    : 0;

  // Leads por prioridade
  const priorityStats = {
    urgent: leads.filter(l => l.priority === 4).length,
    high: leads.filter(l => l.priority === 3).length,
    medium: leads.filter(l => l.priority === 2).length,
    low: leads.filter(l => l.priority === 1).length
  };

  // Leads por estágio com valores
  const stageStats = stages.map(stage => {
    const stageLeads = leads.filter(lead => lead.current_stage_id === stage.id);
    const stageValue = stageLeads.reduce((sum, lead) => sum + (lead.lead_value || 0), 0);
    
    return {
      stage,
      count: stageLeads.length,
      value: stageValue,
      percentage: totalLeads > 0 ? (stageLeads.length / totalLeads) * 100 : 0
    };
  });

  // Leads recentes (últimas 24h)
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const recentLeads = leads.filter(lead => 
    new Date(lead.last_interaction) > yesterday
  ).length;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      {/* Total de Leads */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total de Leads</CardTitle>
          <Users className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{totalLeads}</div>
          <p className="text-xs text-muted-foreground">
            {recentLeads} novos nas últimas 24h
          </p>
        </CardContent>
      </Card>

      {/* Valor Total */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Valor Total</CardTitle>
          <DollarSign className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            R$ {totalValue.toLocaleString('pt-BR')}
          </div>
          <p className="text-xs text-muted-foreground">
            Média: R$ {averageValue.toLocaleString('pt-BR')}
          </p>
        </CardContent>
      </Card>

      {/* Taxa de Conversão Média */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Conversão Média</CardTitle>
          <TrendingUp className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {avgConversionProbability.toFixed(1)}%
          </div>
          <Progress 
            value={avgConversionProbability} 
            className="mt-2"
          />
        </CardContent>
      </Card>

      {/* Leads Prioritários */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Alta Prioridade</CardTitle>
          <Target className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-red-600">
            {priorityStats.urgent + priorityStats.high}
          </div>
          <p className="text-xs text-muted-foreground">
            {priorityStats.urgent} urgentes, {priorityStats.high} altos
          </p>
        </CardContent>
      </Card>

      {/* Distribuição por Estágios */}
      <Card className="md:col-span-2 lg:col-span-4">
        <CardHeader>
          <CardTitle className="text-lg">Distribuição por Estágios</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {stageStats.map(({ stage, count, value, percentage }) => (
              <div key={stage.id} className="space-y-2">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <div 
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: stage.color }}
                    />
                    <span className="font-medium">{stage.name}</span>
                    <span className="text-sm text-muted-foreground">
                      ({count} leads)
                    </span>
                  </div>
                  <div className="text-sm font-medium">
                    R$ {value.toLocaleString('pt-BR')}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Progress 
                    value={percentage} 
                    className="flex-1"
                    style={{ 
                      '--progress-foreground': stage.color 
                    } as React.CSSProperties}
                  />
                  <span className="text-sm text-muted-foreground w-12">
                    {percentage.toFixed(1)}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default FunnelStats;
