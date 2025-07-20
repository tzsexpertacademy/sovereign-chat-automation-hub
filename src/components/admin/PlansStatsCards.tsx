import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, CreditCard, TrendingUp, Target } from "lucide-react";
import { plansService } from "@/services/plansService";

const PlansStatsCards = () => {
  const [stats, setStats] = useState({
    totalPlans: 0,
    totalClients: 0,
    activeClients: 0,
    totalMRR: 0,
    totalARR: 0,
    averageConversionRate: 0
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      const metrics = await plansService.getTotalMetrics();
      setStats(metrics);
    } catch (error) {
      console.error('Erro ao carregar estatísticas:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const formatPercentage = (value: number) => {
    return `${value.toFixed(1)}%`;
  };

  const cards = [
    {
      title: "Total de Planos",
      value: stats.totalPlans.toString(),
      description: "Planos ativos disponíveis",
      icon: Target,
      color: "text-blue-600"
    },
    {
      title: "Clientes Ativos",
      value: `${stats.activeClients}/${stats.totalClients}`,
      description: "Clientes com assinatura ativa",
      icon: Users,
      color: "text-green-600"
    },
    {
      title: "MRR Total",
      value: formatCurrency(stats.totalMRR),
      description: "Receita recorrente mensal",
      icon: CreditCard,
      color: "text-yellow-600"
    },
    {
      title: "Taxa de Conversão",
      value: formatPercentage(stats.averageConversionRate),
      description: "Média entre todos os planos",
      icon: TrendingUp,
      color: "text-purple-600"
    }
  ];

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardContent className="p-6">
              <div className="h-4 bg-muted rounded w-3/4 mb-2"></div>
              <div className="h-8 bg-muted rounded w-1/2 mb-1"></div>
              <div className="h-3 bg-muted rounded w-full"></div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((card, index) => {
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
  );
};

export default PlansStatsCards;