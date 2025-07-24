import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { 
  Rocket, 
  Target, 
  TrendingUp, 
  Zap, 
  Palette, 
  Brain,
  CheckCircle2,
  Clock,
  AlertCircle,
  Star,
  Calendar,
  Users,
  Settings,
  BarChart3,
  Shield,
  Lightbulb
} from "lucide-react";

interface ImprovementItem {
  id: string;
  title: string;
  description: string;
  category: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  status: 'planned' | 'in-progress' | 'completed' | 'testing';
  effort: number; // 1-5 scale
  impact: number; // 1-5 scale
  estimatedWeeks: string;
  dependencies?: string[];
}

const DevelopmentPlan = () => {
  const [selectedCategory, setSelectedCategory] = useState('all');

  const improvements: ImprovementItem[] = [
    // Fundação do Sistema (Semanas 1-4)
    {
      id: 'design-system',
      title: 'Design System Unificado',
      description: 'Criar biblioteca unificada de componentes reutilizáveis com tokens de design consistentes',
      category: 'foundation',
      priority: 'critical',
      status: 'planned',
      effort: 5,
      impact: 5,
      estimatedWeeks: '2-3'
    },
    {
      id: 'cache-intelligent',
      title: 'Cache Inteligente Global',
      description: 'Implementar React Query em todas as páginas com invalidação automática e cache otimizado',
      category: 'foundation',
      priority: 'high',
      status: 'planned',
      effort: 4,
      impact: 5,
      estimatedWeeks: '1-2'
    },
    {
      id: 'real-time-monitoring',
      title: 'Monitoramento Tempo Real',
      description: 'Dashboard de saúde do sistema com WebSockets e alertas proativos',
      category: 'foundation',
      priority: 'high',
      status: 'planned',
      effort: 4,
      impact: 4,
      estimatedWeeks: '2-3'
    },
    {
      id: 'mobile-responsiveness',
      title: 'Responsividade Total',
      description: 'Garantir 100% compatibilidade mobile com layouts adaptativos',
      category: 'foundation',
      priority: 'high',
      status: 'in-progress',
      effort: 3,
      impact: 4,
      estimatedWeeks: '1-2'
    },

    // Otimização de Performance (Semanas 5-8)
    {
      id: 'lazy-loading',
      title: 'Lazy Loading Avançado',
      description: 'Implementar carregamento sob demanda em componentes pesados e rotas',
      category: 'performance',
      priority: 'high',
      status: 'planned',
      effort: 3,
      impact: 4,
      estimatedWeeks: '1-2'
    },
    {
      id: 'pagination-smart',
      title: 'Paginação Inteligente',
      description: 'Sistema de paginação com scroll infinito e busca otimizada',
      category: 'performance',
      priority: 'medium',
      status: 'planned',
      effort: 3,
      impact: 3,
      estimatedWeeks: '1'
    },
    {
      id: 'virtual-scrolling',
      title: 'Virtual Scrolling',
      description: 'Renderização virtualizada para listas com milhares de itens',
      category: 'performance',
      priority: 'medium',
      status: 'planned',
      effort: 4,
      impact: 3,
      estimatedWeeks: '2'
    },
    {
      id: 'service-workers',
      title: 'Cache Offline Inteligente',
      description: 'Service Workers para funcionamento offline e performance melhorada',
      category: 'performance',
      priority: 'low',
      status: 'planned',
      effort: 4,
      impact: 3,
      estimatedWeeks: '2-3'
    },

    // Melhorias de UX/UI (Semanas 9-12)
    {
      id: 'micro-interactions',
      title: 'Micro-interações',
      description: 'Feedback visual consistente com animações suaves e transições',
      category: 'ux-ui',
      priority: 'medium',
      status: 'planned',
      effort: 3,
      impact: 4,
      estimatedWeeks: '2'
    },
    {
      id: 'accessibility',
      title: 'Acessibilidade Completa',
      description: 'Suporte total a leitores de tela e navegação por teclado',
      category: 'ux-ui',
      priority: 'high',
      status: 'planned',
      effort: 4,
      impact: 4,
      estimatedWeeks: '2-3'
    },
    {
      id: 'dark-mode',
      title: 'Modo Escuro Nativo',
      description: 'Tema escuro com alternância automática e preferências do usuário',
      category: 'ux-ui',
      priority: 'medium',
      status: 'planned',
      effort: 3,
      impact: 3,
      estimatedWeeks: '1-2'
    },
    {
      id: 'contextual-navigation',
      title: 'Navegação Contextual',
      description: 'Breadcrumbs inteligentes e navegação baseada no contexto',
      category: 'ux-ui',
      priority: 'medium',
      status: 'planned',
      effort: 2,
      impact: 3,
      estimatedWeeks: '1'
    },

    // Funcionalidades Avançadas (Semanas 13-16)
    {
      id: 'business-intelligence',
      title: 'Business Intelligence',
      description: 'Relatórios avançados com gráficos interativos e exportação personalizada',
      category: 'advanced',
      priority: 'high',
      status: 'planned',
      effort: 5,
      impact: 5,
      estimatedWeeks: '3-4'
    },
    {
      id: 'workflow-automation',
      title: 'Automação de Workflows',
      description: 'Criador visual de workflows com triggers automáticos',
      category: 'advanced',
      priority: 'high',
      status: 'planned',
      effort: 5,
      impact: 4,
      estimatedWeeks: '4-5'
    },
    {
      id: 'public-api',
      title: 'API Pública e Webhooks',
      description: 'API RESTful documentada com webhooks e rate limiting',
      category: 'advanced',
      priority: 'medium',
      status: 'planned',
      effort: 4,
      impact: 4,
      estimatedWeeks: '3-4'
    },
    {
      id: 'granular-permissions',
      title: 'Permissões Granulares',
      description: 'Sistema de roles e permissões com controle fino de acesso',
      category: 'advanced',
      priority: 'high',
      status: 'planned',
      effort: 4,
      impact: 4,
      estimatedWeeks: '2-3'
    },

    // Inovação e IA (Semanas 17-20)
    {
      id: 'ai-chatbot',
      title: 'Assistente IA Administrativo',
      description: 'Chatbot inteligente para auxiliar na administração do sistema',
      category: 'innovation',
      priority: 'medium',
      status: 'planned',
      effort: 5,
      impact: 4,
      estimatedWeeks: '4-5'
    },
    {
      id: 'anomaly-detection',
      title: 'Detecção de Anomalias',
      description: 'ML para detectar padrões anômalos e alertas preditivos',
      category: 'innovation',
      priority: 'medium',
      status: 'planned',
      effort: 5,
      impact: 4,
      estimatedWeeks: '3-4'
    },
    {
      id: 'smart-recommendations',
      title: 'Recomendações Inteligentes',
      description: 'Sistema de sugestões automáticas baseado em IA',
      category: 'innovation',
      priority: 'low',
      status: 'planned',
      effort: 4,
      impact: 3,
      estimatedWeeks: '3'
    },
    {
      id: 'predictive-optimization',
      title: 'Otimização Preditiva',
      description: 'Machine Learning para otimização automática de performance',
      category: 'innovation',
      priority: 'low',
      status: 'planned',
      effort: 5,
      impact: 3,
      estimatedWeeks: '4-5'
    }
  ];

  const categories = {
    all: { name: 'Todas', icon: Target, color: 'default' },
    foundation: { name: 'Fundação', icon: Rocket, color: 'destructive' },
    performance: { name: 'Performance', icon: Zap, color: 'warning' },
    'ux-ui': { name: 'UX/UI', icon: Palette, color: 'secondary' },
    advanced: { name: 'Avançado', icon: Settings, color: 'primary' },
    innovation: { name: 'Inovação', icon: Brain, color: 'accent' }
  };

  const statusConfig = {
    planned: { label: 'Planejado', color: 'secondary', icon: Clock },
    'in-progress': { label: 'Em Progresso', color: 'warning', icon: TrendingUp },
    testing: { label: 'Testando', color: 'primary', icon: AlertCircle },
    completed: { label: 'Concluído', color: 'success', icon: CheckCircle2 }
  };

  const priorityConfig = {
    critical: { label: 'Crítico', color: 'destructive' },
    high: { label: 'Alto', color: 'warning' },
    medium: { label: 'Médio', color: 'secondary' },
    low: { label: 'Baixo', color: 'default' }
  };

  const filteredImprovements = selectedCategory === 'all' 
    ? improvements 
    : improvements.filter(item => item.category === selectedCategory);

  const getOverallProgress = () => {
    const completed = improvements.filter(item => item.status === 'completed').length;
    const inProgress = improvements.filter(item => item.status === 'in-progress').length;
    return ((completed + inProgress * 0.5) / improvements.length) * 100;
  };

  const getCategoryStats = (category: string) => {
    const items = category === 'all' ? improvements : improvements.filter(item => item.category === category);
    const completed = items.filter(item => item.status === 'completed').length;
    const total = items.length;
    return { completed, total, percentage: total > 0 ? (completed / total) * 100 : 0 };
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Em Desenvolvimento</h1>
            <p className="text-muted-foreground mt-2">
              Roadmap completo de melhorias e inovações do YumerFlow
            </p>
          </div>
          <Badge variant="secondary" className="text-sm">
            v2.0 - Próxima Geração
          </Badge>
        </div>
        
        {/* Progress Overview */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="w-5 h-5" />
              Progresso Geral
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Conclusão do Roadmap</span>
                <span className="text-sm text-muted-foreground">
                  {Math.round(getOverallProgress())}%
                </span>
              </div>
              <Progress value={getOverallProgress()} className="h-2" />
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                <div className="space-y-1">
                  <div className="text-2xl font-bold text-primary">
                    {improvements.filter(i => i.status === 'completed').length}
                  </div>
                  <div className="text-xs text-muted-foreground">Concluídos</div>
                </div>
                <div className="space-y-1">
                  <div className="text-2xl font-bold text-warning">
                    {improvements.filter(i => i.status === 'in-progress').length}
                  </div>
                  <div className="text-xs text-muted-foreground">Em Progresso</div>
                </div>
                <div className="space-y-1">
                  <div className="text-2xl font-bold text-secondary">
                    {improvements.filter(i => i.status === 'planned').length}
                  </div>
                  <div className="text-xs text-muted-foreground">Planejados</div>
                </div>
                <div className="space-y-1">
                  <div className="text-2xl font-bold text-accent">
                    {improvements.length}
                  </div>
                  <div className="text-xs text-muted-foreground">Total</div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Category Tabs */}
      <Tabs value={selectedCategory} onValueChange={setSelectedCategory}>
        <TabsList className="grid w-full grid-cols-6">
          {Object.entries(categories).map(([key, category]) => (
            <TabsTrigger key={key} value={key} className="flex items-center gap-2">
              <category.icon className="w-4 h-4" />
              <span className="hidden sm:inline">{category.name}</span>
            </TabsTrigger>
          ))}
        </TabsList>

        {/* Category Overview */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mt-6">
          {Object.entries(categories).slice(1).map(([key, category]) => {
            const stats = getCategoryStats(key);
            return (
              <Card key={key} className="text-center">
                <CardContent className="pt-6">
                  <category.icon className="w-8 h-8 mx-auto mb-2 text-primary" />
                  <h3 className="font-medium">{category.name}</h3>
                  <div className="mt-2">
                    <div className="text-2xl font-bold">{stats.completed}/{stats.total}</div>
                    <Progress value={stats.percentage} className="h-1 mt-2" />
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Improvements List */}
        <TabsContent value={selectedCategory} className="space-y-4">
          <div className="grid gap-4">
            {filteredImprovements.map((improvement) => {
              const StatusIcon = statusConfig[improvement.status].icon;
              return (
                <Card key={improvement.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="pt-6">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 space-y-3">
                        <div className="flex items-center gap-3">
                          <h3 className="font-semibold text-lg">{improvement.title}</h3>
                          <Badge variant={statusConfig[improvement.status].color as any}>
                            <StatusIcon className="w-3 h-3 mr-1" />
                            {statusConfig[improvement.status].label}
                          </Badge>
                          <Badge variant={priorityConfig[improvement.priority].color as any}>
                            {priorityConfig[improvement.priority].label}
                          </Badge>
                        </div>
                        
                        <p className="text-muted-foreground">{improvement.description}</p>
                        
                        <div className="flex flex-wrap gap-4 text-sm">
                          <div className="flex items-center gap-1">
                            <Calendar className="w-4 h-4" />
                            <span>{improvement.estimatedWeeks} semanas</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <BarChart3 className="w-4 h-4" />
                            <span>Esforço: {improvement.effort}/5</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Star className="w-4 h-4" />
                            <span>Impacto: {improvement.impact}/5</span>
                          </div>
                        </div>
                      </div>
                      
                      <div className="ml-4">
                        <Button variant="outline" size="sm">
                          <Lightbulb className="w-4 h-4 mr-2" />
                          Detalhes
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default DevelopmentPlan;