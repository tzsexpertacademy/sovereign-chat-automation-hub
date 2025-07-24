import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, Edit, Trash2, BarChart3 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { plansService, type SubscriptionPlan, type PlanMetrics } from "@/services/plansService";
import PlansStatsCards from "./PlansStatsCards";
import PlanModal from "./PlanModal";
import PlanMetricsModal from "./PlanMetricsModal";

const PlansManagement = () => {
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [metrics, setMetrics] = useState<PlanMetrics[]>([]);
  const [filteredPlans, setFilteredPlans] = useState<SubscriptionPlan[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [filter, setFilter] = useState<"all" | "active" | "inactive">("all");
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isMetricsModalOpen, setIsMetricsModalOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<SubscriptionPlan | null>(null);
  const [selectedPlanMetrics, setSelectedPlanMetrics] = useState<PlanMetrics | null>(null);
  const { toast } = useToast();

  // Auto-refresh when accessing the page
  useEffect(() => {
    loadData();
  }, []);

  // Refresh when route changes to plans
  useEffect(() => {
    if (location.pathname === '/admin/plans') {
      loadData();
    }
  }, [location.pathname]);

  useEffect(() => {
    filterPlans();
  }, [plans, searchTerm, filter]);

  const loadData = async () => {
    try {
      setIsLoading(true);
      const [plansData, metricsData] = await Promise.all([
        plansService.getAllPlans(),
        plansService.getPlansMetrics()
      ]);
      setPlans(plansData);
      setMetrics(metricsData);
    } catch (error) {
      toast({
        title: "Erro",
        description: "Falha ao carregar dados dos planos",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const filterPlans = () => {
    let filtered = plans;

    // Filtro por status
    if (filter === "active") {
      filtered = filtered.filter(plan => plan.is_active);
    } else if (filter === "inactive") {
      filtered = filtered.filter(plan => !plan.is_active);
    }

    // Filtro por termo de busca
    if (searchTerm) {
      filtered = filtered.filter(plan =>
        plan.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        plan.description?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    setFilteredPlans(filtered);
  };

  const handleCreatePlan = () => {
    setEditingPlan(null);
    setIsModalOpen(true);
  };

  const handleEditPlan = (plan: SubscriptionPlan) => {
    setEditingPlan(plan);
    setIsModalOpen(true);
  };

  const handleDeletePlan = async (plan: SubscriptionPlan) => {
    if (!confirm(`Tem certeza que deseja excluir o plano "${plan.name}"?`)) {
      return;
    }

    try {
      await plansService.deletePlan(plan.id);
      toast({
        title: "Sucesso",
        description: "Plano excluído com sucesso"
      });
      await loadData();
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message || "Falha ao excluir plano",
        variant: "destructive"
      });
    }
  };

  const handleViewMetrics = (plan: SubscriptionPlan) => {
    const planMetrics = metrics.find(m => m.plan_id === plan.id);
    if (planMetrics) {
      setSelectedPlanMetrics(planMetrics);
      setIsMetricsModalOpen(true);
    }
  };

  const handleModalClose = async (updated: boolean) => {
    setIsModalOpen(false);
    setEditingPlan(null);
    if (updated) {
      await loadData();
    }
  };

  const getPlanMetrics = (planId: string) => {
    return metrics.find(m => m.plan_id === planId);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="h-8 bg-muted rounded w-1/4 mb-6"></div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-24 bg-muted rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Gerenciamento de Planos</h1>
          <p className="text-muted-foreground">Gerencie planos de assinatura e visualize métricas</p>
        </div>
        <Button onClick={handleCreatePlan} className="shrink-0">
          <Plus className="h-4 w-4 mr-2" />
          Novo Plano
        </Button>
      </div>

      {/* Métricas */}
      <PlansStatsCards />

      {/* Filtros */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input
                placeholder="Buscar planos..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex gap-2">
              <Button
                variant={filter === "all" ? "default" : "outline"}
                onClick={() => setFilter("all")}
                size="sm"
              >
                Todos
              </Button>
              <Button
                variant={filter === "active" ? "default" : "outline"}
                onClick={() => setFilter("active")}
                size="sm"
              >
                Ativos
              </Button>
              <Button
                variant={filter === "inactive" ? "default" : "outline"}
                onClick={() => setFilter("inactive")}
                size="sm"
              >
                Inativos
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabela de Planos */}
      <Card>
        <CardHeader>
          <CardTitle>Planos ({filteredPlans.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-2 font-medium">Plano</th>
                  <th className="text-left p-2 font-medium">Instâncias</th>
                  <th className="text-left p-2 font-medium">Preço Mensal</th>
                  <th className="text-left p-2 font-medium">Clientes</th>
                  <th className="text-left p-2 font-medium">Receita/Mês</th>
                  <th className="text-left p-2 font-medium">Status</th>
                  <th className="text-left p-2 font-medium">Ações</th>
                </tr>
              </thead>
              <tbody>
                {filteredPlans.map((plan) => {
                  const planMetrics = getPlanMetrics(plan.id);
                  return (
                    <tr key={plan.id} className="border-b hover:bg-muted/50">
                      <td className="p-2">
                        <div className="flex items-center gap-2">
                          <div 
                            className="w-3 h-3 rounded-full" 
                            style={{ backgroundColor: plan.color }}
                          />
                          <div>
                            <div className="font-medium">{plan.name}</div>
                            <div className="text-sm text-muted-foreground">{plan.description}</div>
                          </div>
                        </div>
                      </td>
                      <td className="p-2">
                        <Badge variant="secondary">{plan.max_instances}</Badge>
                      </td>
                      <td className="p-2 font-medium">
                        {formatCurrency(plan.price_monthly)}
                      </td>
                      <td className="p-2">
                        <div className="text-sm">
                          <div>{planMetrics?.active_clients || 0} ativos</div>
                          <div className="text-muted-foreground">
                            {planMetrics?.total_clients || 0} total
                          </div>
                        </div>
                      </td>
                      <td className="p-2 font-medium text-green-600">
                        {formatCurrency(planMetrics?.monthly_revenue || 0)}
                      </td>
                      <td className="p-2">
                        <Badge variant={plan.is_active ? "default" : "secondary"}>
                          {plan.is_active ? "Ativo" : "Inativo"}
                        </Badge>
                      </td>
                      <td className="p-2">
                        <div className="flex gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleViewMetrics(plan)}
                          >
                            <BarChart3 className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleEditPlan(plan)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleDeletePlan(plan)}
                            disabled={plan.is_active && (planMetrics?.total_clients || 0) > 0}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          
          {filteredPlans.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              Nenhum plano encontrado
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modals */}
      <PlanModal
        isOpen={isModalOpen}
        onClose={handleModalClose}
        plan={editingPlan}
      />

      <PlanMetricsModal
        isOpen={isMetricsModalOpen}
        onClose={() => setIsMetricsModalOpen(false)}
        metrics={selectedPlanMetrics}
      />
    </div>
  );
};

export default PlansManagement;