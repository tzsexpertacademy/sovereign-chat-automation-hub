import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowRight, Users, Target, TrendingUp, Filter, Tag } from 'lucide-react';
import { Link } from 'react-router-dom';

interface FunnelSystemSlideProps {
  clientId: string;
}

export const FunnelSystemSlide: React.FC<FunnelSystemSlideProps> = ({ clientId }) => {
  const stages = [
    {
      name: 'Novos Leads',
      description: 'Primeiros contatos e leads qualificados',
      color: 'bg-blue-500',
      count: '24',
      tasks: ['Resposta automática', 'Qualificação inicial', 'Coleta de dados']
    },
    {
      name: 'Em Negociação',
      description: 'Leads interessados em processo de venda',
      color: 'bg-yellow-500',
      count: '12',
      tasks: ['Apresentação de proposta', 'Esclarecimento de dúvidas', 'Follow-up']
    },
    {
      name: 'Fechamento',
      description: 'Leads prontos para finalizar compra',
      color: 'bg-orange-500',
      count: '8',
      tasks: ['Negociação final', 'Assinatura de contrato', 'Processamento']
    },
    {
      name: 'Convertidos',
      description: 'Clientes que finalizaram a compra',
      color: 'bg-green-500',
      count: '45',
      tasks: ['Onboarding', 'Satisfação', 'Upsell']
    }
  ];

  const tags = [
    { name: 'VIP', color: 'bg-purple-500', count: 8 },
    { name: 'Urgente', color: 'bg-red-500', count: 15 },
    { name: 'Retorno', color: 'bg-blue-500', count: 7 },
    { name: 'Promoção', color: 'bg-green-500', count: 12 },
    { name: 'Frio', color: 'bg-gray-500', count: 23 }
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-3xl font-bold text-foreground mb-4">
          Sistema de Funil Visual
        </h1>
        <p className="text-lg text-muted-foreground max-w-3xl mx-auto">
          Gerencie seus leads de forma visual através do sistema Kanban com estágios personalizáveis e sistema de tags inteligente
        </p>
      </div>

      {/* Kanban Preview */}
      <div className="bg-gradient-to-br from-primary/5 to-secondary/5 rounded-lg p-6">
        <h3 className="text-lg font-semibold mb-4 text-foreground flex items-center">
          <Target className="h-5 w-5 mr-2" />
          Visualização do Funil Kanban
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {stages.map((stage, index) => (
            <div key={index} className="space-y-3">
              {/* Stage Header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <div className={`w-3 h-3 rounded-full ${stage.color}`} />
                  <h4 className="font-medium text-foreground">{stage.name}</h4>
                </div>
                <Badge variant="secondary" className="text-xs">
                  {stage.count}
                </Badge>
              </div>
              
              {/* Stage Description */}
              <p className="text-xs text-muted-foreground">
                {stage.description}
              </p>
              
              {/* Sample Cards */}
              <div className="space-y-2">
                {stage.tasks.map((task, taskIndex) => (
                  <div key={taskIndex} className="bg-card border border-border rounded-lg p-3 shadow-sm hover:shadow-md transition-shadow">
                    <div className="text-sm font-medium text-foreground mb-1">
                      Lead #{Math.floor(Math.random() * 1000)}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {task}
                    </div>
                    <div className="flex space-x-1 mt-2">
                      <Badge variant="outline" className="text-xs">
                        {tags[Math.floor(Math.random() * tags.length)].name}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Features */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Drag & Drop */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center text-lg">
              <ArrowRight className="h-5 w-5 mr-2 text-primary" />
              Drag & Drop Intuitivo
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-muted-foreground">
              <li>• Arraste leads entre estágios facilmente</li>
              <li>• Atualizações automáticas em tempo real</li>
              <li>• Histórico completo de movimentações</li>
              <li>• Notificações para toda a equipe</li>
            </ul>
          </CardContent>
        </Card>

        {/* Tags System */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center text-lg">
              <Tag className="h-5 w-5 mr-2 text-primary" />
              Sistema de Tags
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-muted-foreground">
              <li>• Categorize leads por prioridade</li>
              <li>• Filtros avançados por tags</li>
              <li>• Tags automáticas por comportamento</li>
              <li>• Cores personalizáveis</li>
            </ul>
          </CardContent>
        </Card>
      </div>

      {/* Tags Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Filter className="h-5 w-5 mr-2" />
            Sistema de Tags Disponíveis
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {tags.map((tag, index) => (
              <div key={index} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                <div className="flex items-center space-x-2">
                  <div className={`w-3 h-3 rounded-full ${tag.color}`} />
                  <span className="text-sm font-medium">{tag.name}</span>
                </div>
                <Badge variant="outline" className="text-xs">
                  {tag.count}
                </Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Metrics */}
      <div className="bg-gradient-to-r from-primary/10 to-secondary/10 rounded-lg p-6">
        <h3 className="text-lg font-semibold mb-6 text-center text-foreground flex items-center justify-center">
          <TrendingUp className="h-5 w-5 mr-2" />
          Métricas de Conversão
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-primary">32%</div>
            <div className="text-sm text-muted-foreground">Taxa de Conversão</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-primary">4.2d</div>
            <div className="text-sm text-muted-foreground">Tempo Médio no Funil</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-primary">89</div>
            <div className="text-sm text-muted-foreground">Leads Ativos</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-primary">15%</div>
            <div className="text-sm text-muted-foreground">Crescimento Mensal</div>
          </div>
        </div>
      </div>

      {/* CTA */}
      <div className="text-center">
        <Button asChild size="lg" className="group">
          <Link to={`/client/${clientId}/funnel`}>
            <Users className="h-5 w-5 mr-2" />
            Acessar Funil de Vendas
            <ArrowRight className="h-4 w-4 ml-2 group-hover:translate-x-1 transition-transform" />
          </Link>
        </Button>
      </div>

      {/* Tips */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20 rounded-lg p-6">
        <h3 className="text-lg font-semibold mb-3 text-foreground">💡 Dicas do Funil:</h3>
        <ul className="space-y-2 text-muted-foreground">
          <li>• Configure automações para mover leads automaticamente</li>
          <li>• Use tags para identificar leads de alta prioridade</li>
          <li>• Analise métricas regularmente para otimizar o processo</li>
          <li>• Treine sua equipe no uso do sistema drag & drop</li>
        </ul>
      </div>
    </div>
  );
};