import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Users, CreditCard, TrendingUp, DollarSign } from "lucide-react";
import type { PlanMetrics } from "@/services/plansService";

interface PlanMetricsModalProps {
  isOpen: boolean;
  onClose: () => void;
  metrics: PlanMetrics | null;
}

const PlanMetricsModal = ({ isOpen, onClose, metrics }: PlanMetricsModalProps) => {
  if (!metrics) return null;

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const formatPercentage = (value: number) => {
    return `${value.toFixed(1)}%`;
  };

  const metricsCards = [
    {
      title: "Total de Clientes",
      value: metrics.total_clients.toString(),
      description: "Clientes que já usaram este plano",
      icon: Users,
      color: "text-blue-600"
    },
    {
      title: "Clientes Ativos",
      value: metrics.active_clients.toString(),
      description: "Clientes com assinatura ativa",
      icon: Users,
      color: "text-green-600"
    },
    {
      title: "Receita Mensal",
      value: formatCurrency(metrics.monthly_revenue),
      description: "MRR gerado por este plano",
      icon: CreditCard,
      color: "text-yellow-600"
    },
    {
      title: "Receita Anual",
      value: formatCurrency(metrics.yearly_revenue),
      description: "ARR potencial do plano",
      icon: DollarSign,
      color: "text-purple-600"
    },
    {
      title: "Taxa de Conversão",
      value: formatPercentage(metrics.conversion_rate),
      description: "Clientes ativos / Total de clientes",
      icon: TrendingUp,
      color: "text-orange-600"
    }
  ];

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Métricas do Plano
            <Badge variant="outline">{metrics.plan_name}</Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Cards de Métricas */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {metricsCards.map((card, index) => {
              const Icon = card.icon;
              return (
                <Card key={index}>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">
                      {card.title}
                    </CardTitle>
                    <Icon className={`h-4 w-4 ${card.color}`} />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{card.value}</div>
                    <p className="text-xs text-muted-foreground">
                      {card.description}
                    </p>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Detalhes Adicionais */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Performance */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Performance do Plano</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Taxa de Retenção</span>
                  <Badge variant="secondary">
                    {formatPercentage(metrics.conversion_rate)}
                  </Badge>
                </div>
                
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Receita por Cliente</span>
                  <span className="font-medium">
                    {metrics.active_clients > 0 
                      ? formatCurrency(metrics.monthly_revenue / metrics.active_clients)
                      : formatCurrency(0)
                    }
                  </span>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">LTV Estimado (12 meses)</span>
                  <span className="font-medium text-green-600">
                    {formatCurrency(metrics.yearly_revenue)}
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* Status dos Clientes */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Status dos Clientes</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Clientes Ativos</span>
                    <div className="flex items-center gap-2">
                      <div className="w-12 bg-muted rounded-full h-2">
                        <div 
                          className="bg-green-500 h-2 rounded-full"
                          style={{ 
                            width: metrics.total_clients > 0 
                              ? `${(metrics.active_clients / metrics.total_clients) * 100}%` 
                              : '0%' 
                          }}
                        />
                      </div>
                      <span className="text-sm font-medium">
                        {metrics.active_clients}
                      </span>
                    </div>
                  </div>

                  <div className="flex justify-between items-center">
                    <span className="text-sm">Clientes Inativos</span>
                    <div className="flex items-center gap-2">
                      <div className="w-12 bg-muted rounded-full h-2">
                        <div 
                          className="bg-red-500 h-2 rounded-full"
                          style={{ 
                            width: metrics.total_clients > 0 
                              ? `${((metrics.total_clients - metrics.active_clients) / metrics.total_clients) * 100}%` 
                              : '0%' 
                          }}
                        />
                      </div>
                      <span className="text-sm font-medium">
                        {metrics.total_clients - metrics.active_clients}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="pt-2 border-t">
                  <div className="text-sm text-muted-foreground">
                    Total de clientes que já utilizaram este plano
                  </div>
                  <div className="text-lg font-bold">
                    {metrics.total_clients}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Insights */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Insights e Recomendações</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 text-sm">
                {metrics.conversion_rate >= 80 && (
                  <div className="flex items-start gap-2 p-3 bg-green-50 rounded-lg border border-green-200">
                    <div className="w-2 h-2 bg-green-500 rounded-full mt-1.5"></div>
                    <div>
                      <div className="font-medium text-green-800">Excelente Performance</div>
                      <div className="text-green-700">
                        Este plano possui uma taxa de conversão muito alta ({formatPercentage(metrics.conversion_rate)}). 
                        Consider aumentar o preço ou criar planos superiores.
                      </div>
                    </div>
                  </div>
                )}

                {metrics.conversion_rate < 50 && (
                  <div className="flex items-start gap-2 p-3 bg-yellow-50 rounded-lg border border-yellow-200">
                    <div className="w-2 h-2 bg-yellow-500 rounded-full mt-1.5"></div>
                    <div>
                      <div className="font-medium text-yellow-800">Atenção Necessária</div>
                      <div className="text-yellow-700">
                        Taxa de conversão baixa ({formatPercentage(metrics.conversion_rate)}). 
                        Revise o valor oferecido ou considere ajustes no preço.
                      </div>
                    </div>
                  </div>
                )}

                {metrics.active_clients === 0 && (
                  <div className="flex items-start gap-2 p-3 bg-red-50 rounded-lg border border-red-200">
                    <div className="w-2 h-2 bg-red-500 rounded-full mt-1.5"></div>
                    <div>
                      <div className="font-medium text-red-800">Sem Clientes Ativos</div>
                      <div className="text-red-700">
                        Este plano não possui clientes ativos. Considere revisar a proposta de valor 
                        ou estratégia de marketing.
                      </div>
                    </div>
                  </div>
                )}

                {metrics.monthly_revenue > 1000 && (
                  <div className="flex items-start gap-2 p-3 bg-blue-50 rounded-lg border border-blue-200">
                    <div className="w-2 h-2 bg-blue-500 rounded-full mt-1.5"></div>
                    <div>
                      <div className="font-medium text-blue-800">Alto Valor</div>
                      <div className="text-blue-700">
                        Plano de alta receita ({formatCurrency(metrics.monthly_revenue)}/mês). 
                        Foque em reter estes clientes e expandir similares.
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default PlanMetricsModal;