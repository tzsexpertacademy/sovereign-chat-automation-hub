import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { MoreHorizontal, Plus, Search, Eye, Edit, Trash2, ArrowUpDown, Download, TrendingUp, Users, DollarSign } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';
import { plansService, type SubscriptionPlan, type PlanMetrics } from '@/services/plansService';
import PlanModal from './PlanModal';
import PlanMetricsModal from './PlanMetricsModal';
import { PlansStatsCardsModern } from './PlansStatsCardsModern';
import { useToast } from '@/hooks/use-toast';

export function PlansManagement() {
  const location = useLocation();
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [metrics, setMetrics] = useState<PlanMetrics[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilter, setActiveFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [sortBy, setSortBy] = useState<'name' | 'clients' | 'revenue' | 'display_order'>('display_order');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<SubscriptionPlan | null>(null);
  const [metricsModalOpen, setMetricsModalOpen] = useState(false);
  const [selectedMetrics, setSelectedMetrics] = useState<PlanMetrics | null>(null);
  const { toast } = useToast();

  const loadData = async () => {
    try {
      setLoading(true);
      const [plansData, metricsData] = await Promise.all([
        plansService.getAllPlans(),
        plansService.getPlansMetrics()
      ]);
      setPlans(plansData);
      setMetrics(metricsData);
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
      toast({
        title: 'Erro',
        description: 'Falha ao carregar dados dos planos',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

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

  const filterAndSortPlans = () => {
    let filtered = plans.filter(plan => {
      const matchesSearch = plan.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          plan.description?.toLowerCase().includes(searchTerm.toLowerCase());
      
      if (activeFilter === 'active') {
        return matchesSearch && plan.is_active;
      } else if (activeFilter === 'inactive') {
        return matchesSearch && !plan.is_active;
      }
      
      return matchesSearch;
    });

    // Sort plans
    filtered.sort((a, b) => {
      let aValue, bValue;
      
      switch (sortBy) {
        case 'name':
          aValue = a.name.toLowerCase();
          bValue = b.name.toLowerCase();
          break;
        case 'clients':
          const aMetric = metrics.find(m => m.plan_id === a.id);
          const bMetric = metrics.find(m => m.plan_id === b.id);
          aValue = aMetric?.total_clients || 0;
          bValue = bMetric?.total_clients || 0;
          break;
        case 'revenue':
          const aMetricRev = metrics.find(m => m.plan_id === a.id);
          const bMetricRev = metrics.find(m => m.plan_id === b.id);
          aValue = aMetricRev?.monthly_revenue || 0;
          bValue = bMetricRev?.monthly_revenue || 0;
          break;
        default:
          aValue = a.display_order;
          bValue = b.display_order;
      }

      if (sortOrder === 'asc') {
        return aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
      } else {
        return aValue > bValue ? -1 : aValue < bValue ? 1 : 0;
      }
    });

    return filtered;
  };

  const handleSort = (field: typeof sortBy) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('asc');
    }
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
        title: 'Sucesso',
        description: 'Plano excluído com sucesso'
      });
      await loadData();
    } catch (error: any) {
      toast({
        title: 'Erro',
        description: error.message || 'Falha ao excluir plano',
        variant: 'destructive'
      });
    }
  };

  const handleViewMetrics = (plan: SubscriptionPlan) => {
    const planMetrics = metrics.find(m => m.plan_id === plan.id);
    if (planMetrics) {
      setSelectedMetrics(planMetrics);
      setMetricsModalOpen(true);
    }
  };

  const handleModalClose = async (updated: boolean) => {
    setIsModalOpen(false);
    setEditingPlan(null);
    if (updated) {
      await loadData();
    }
  };

  const filteredPlans = filterAndSortPlans();

  if (loading) {
    return (
      <div className="p-4 md:p-6 space-y-6">
        <div className="space-y-4">
          <Skeleton className="h-8 w-64" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-32" />
            ))}
          </div>
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-4">
              <Skeleton className="h-10 flex-1" />
              <div className="flex gap-2">
                <Skeleton className="h-10 w-20" />
                <Skeleton className="h-10 w-20" />
                <Skeleton className="h-10 w-20" />
              </div>
            </div>
            <Skeleton className="h-96" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground">Gerenciamento de Planos</h1>
          <p className="text-muted-foreground mt-1">Configure e monitore os planos de assinatura</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm">
            <Download className="w-4 h-4 mr-2" />
            Exportar
          </Button>
          <Button onClick={handleCreatePlan}>
            <Plus className="w-4 h-4 mr-2" />
            Novo Plano
          </Button>
        </div>
      </div>
      
      {/* Stats Cards */}
      <PlansStatsCardsModern />

      {/* Filters and Search */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
            <div className="relative flex-1 max-w-md w-full">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <Input
                placeholder="Buscar planos..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            
            <div className="flex flex-wrap gap-2">
              <Button 
                variant={activeFilter === 'all' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setActiveFilter('all')}
              >
                Todos
              </Button>
              <Button 
                variant={activeFilter === 'active' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setActiveFilter('active')}
              >
                Ativos
              </Button>
              <Button 
                variant={activeFilter === 'inactive' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setActiveFilter('inactive')}
              >
                Inativos
              </Button>
            </div>
          </div>
        </CardHeader>
        
        <CardContent>
          {filteredPlans.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-12 h-12 mx-auto mb-4 text-muted-foreground">
                <TrendingUp className="w-full h-full" />
              </div>
              <p className="text-muted-foreground text-lg mb-2">Nenhum plano encontrado</p>
              <p className="text-sm text-muted-foreground">Crie um novo plano para começar</p>
            </div>
          ) : (
            <>
              {/* Desktop Table View */}
              <div className="hidden lg:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead 
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => handleSort('name')}
                      >
                        <div className="flex items-center gap-2">
                          Nome
                          <ArrowUpDown className="w-4 h-4" />
                        </div>
                      </TableHead>
                      <TableHead>Preço</TableHead>
                      <TableHead>Instâncias</TableHead>
                      <TableHead 
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => handleSort('clients')}
                      >
                        <div className="flex items-center gap-2">
                          Clientes
                          <ArrowUpDown className="w-4 h-4" />
                        </div>
                      </TableHead>
                      <TableHead 
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => handleSort('revenue')}
                      >
                        <div className="flex items-center gap-2">
                          Receita Mensal
                          <ArrowUpDown className="w-4 h-4" />
                        </div>
                      </TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredPlans.map((plan) => {
                      const planMetrics = metrics.find(m => m.plan_id === plan.id);
                      return (
                        <TableRow key={plan.id} className="hover:bg-muted/50">
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <div 
                                className="w-3 h-3 rounded-full"
                                style={{ backgroundColor: plan.color }}
                              />
                              <div>
                                <div className="font-medium">{plan.name}</div>
                                {plan.description && (
                                  <div className="text-sm text-muted-foreground line-clamp-1">
                                    {plan.description}
                                  </div>
                                )}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="space-y-1">
                              <div className="font-medium">R$ {plan.price_monthly.toFixed(2)}/mês</div>
                              <div className="text-sm text-muted-foreground">
                                R$ {plan.price_yearly.toFixed(2)}/ano
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{plan.max_instances} max</Badge>
                          </TableCell>
                          <TableCell>
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <Users className="w-4 h-4 text-muted-foreground" />
                                <span className="font-medium">{planMetrics?.total_clients || 0}</span>
                              </div>
                              <div className="text-sm text-muted-foreground">
                                {planMetrics?.active_clients || 0} ativos
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <DollarSign className="w-4 h-4 text-muted-foreground" />
                              <span className="font-medium">
                                R$ {(planMetrics?.monthly_revenue || 0).toFixed(2)}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant={plan.is_active ? 'default' : 'secondary'}>
                              {plan.is_active ? 'Ativo' : 'Inativo'}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => handleViewMetrics(plan)}>
                                  <Eye className="mr-2 h-4 w-4" />
                                  Ver Métricas
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleEditPlan(plan)}>
                                  <Edit className="mr-2 h-4 w-4" />
                                  Editar
                                </DropdownMenuItem>
                                <DropdownMenuItem 
                                  onClick={() => handleDeletePlan(plan)}
                                  className="text-destructive"
                                >
                                  <Trash2 className="mr-2 h-4 w-4" />
                                  Excluir
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile Cards View */}
              <div className="lg:hidden grid gap-4">
                {filteredPlans.map((plan) => {
                  const planMetrics = metrics.find(m => m.plan_id === plan.id);
                  return (
                    <Card key={plan.id} className="hover:shadow-md transition-shadow">
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center gap-3">
                            <div 
                              className="w-3 h-3 rounded-full"
                              style={{ backgroundColor: plan.color }}
                            />
                            <div>
                              <h3 className="font-medium">{plan.name}</h3>
                              <Badge 
                                variant={plan.is_active ? 'default' : 'secondary'}
                                className="mt-1"
                              >
                                {plan.is_active ? 'Ativo' : 'Inativo'}
                              </Badge>
                            </div>
                          </div>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => handleViewMetrics(plan)}>
                                <Eye className="mr-2 h-4 w-4" />
                                Ver Métricas
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleEditPlan(plan)}>
                                <Edit className="mr-2 h-4 w-4" />
                                Editar
                              </DropdownMenuItem>
                              <DropdownMenuItem 
                                onClick={() => handleDeletePlan(plan)}
                                className="text-destructive"
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Excluir
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>

                        {plan.description && (
                          <p className="text-sm text-muted-foreground mb-3">{plan.description}</p>
                        )}

                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <div className="text-muted-foreground">Preço Mensal</div>
                            <div className="font-medium">R$ {plan.price_monthly.toFixed(2)}</div>
                          </div>
                          <div>
                            <div className="text-muted-foreground">Preço Anual</div>
                            <div className="font-medium">R$ {plan.price_yearly.toFixed(2)}</div>
                          </div>
                          <div>
                            <div className="text-muted-foreground">Max. Instâncias</div>
                            <div className="font-medium">{plan.max_instances}</div>
                          </div>
                          <div>
                            <div className="text-muted-foreground">Clientes</div>
                            <div className="font-medium">
                              {planMetrics?.total_clients || 0} ({planMetrics?.active_clients || 0} ativos)
                            </div>
                          </div>
                        </div>

                        <div className="mt-3 pt-3 border-t">
                          <div className="flex items-center justify-between">
                            <div className="text-sm text-muted-foreground">Receita Mensal</div>
                            <div className="font-medium text-primary">
                              R$ {(planMetrics?.monthly_revenue || 0).toFixed(2)}
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </>
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
        isOpen={metricsModalOpen}
        onClose={() => setMetricsModalOpen(false)}
        metrics={selectedMetrics}
      />
    </div>
  );
}