import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowRight, Clock, Users, Settings, BarChart3, Zap, Shield } from 'lucide-react';
import { Link } from 'react-router-dom';

interface QueuesSystemSlideProps {
  clientId: string;
}

export const QueuesSystemSlide: React.FC<QueuesSystemSlideProps> = ({ clientId }) => {
  const queues = [
    {
      name: 'Suporte Técnico',
      status: 'ativa',
      agents: 4,
      waiting: 12,
      priority: 'alta',
      workHours: '24/7',
      color: 'bg-blue-500'
    },
    {
      name: 'Vendas',
      status: 'ativa',
      agents: 6,
      waiting: 8,
      priority: 'média',
      workHours: '08:00-18:00',
      color: 'bg-green-500'
    },
    {
      name: 'Financeiro',
      status: 'pausada',
      agents: 2,
      waiting: 3,
      priority: 'baixa',
      workHours: '09:00-17:00',
      color: 'bg-orange-500'
    }
  ];

  const features = [
    {
      icon: Zap,
      title: 'Distribuição Automática',
      description: 'Tickets são distribuídos automaticamente para o agente disponível mais adequado',
      benefits: ['Round-robin inteligente', 'Balanceamento de carga', 'Priorização automática']
    },
    {
      icon: Clock,
      title: 'Horários de Funcionamento',
      description: 'Configure horários específicos para cada fila e redirecione fora do expediente',
      benefits: ['Horários personalizados', 'Fuso horário automático', 'Mensagens de ausência']
    },
    {
      icon: Shield,
      title: 'SLA e Escalation',
      description: 'Defina tempos limite e escalation automático para garantir qualidade no atendimento',
      benefits: ['Alertas de SLA', 'Escalation automático', 'Métricas de performance']
    }
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-3xl font-bold text-foreground mb-4">
          Sistema de Filas Inteligente
        </h1>
        <p className="text-lg text-muted-foreground max-w-3xl mx-auto">
          Organize seu atendimento com distribuição automática de tickets, configuração de horários e métricas de performance em tempo real
        </p>
      </div>

      {/* Queue Status Dashboard */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <BarChart3 className="h-5 w-5 mr-2" />
            Status das Filas em Tempo Real
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {queues.map((queue, index) => (
              <div key={index} className="flex items-center justify-between p-4 bg-muted rounded-lg">
                <div className="flex items-center space-x-4">
                  <div className={`w-4 h-4 rounded-full ${queue.color}`} />
                  <div>
                    <h4 className="font-medium text-foreground">{queue.name}</h4>
                    <p className="text-sm text-muted-foreground">{queue.workHours}</p>
                  </div>
                </div>
                
                <div className="flex items-center space-x-6">
                  <div className="text-center">
                    <div className="text-lg font-bold text-foreground">{queue.agents}</div>
                    <div className="text-xs text-muted-foreground">Agentes</div>
                  </div>
                  <div className="text-center">
                    <div className="text-lg font-bold text-foreground">{queue.waiting}</div>
                    <div className="text-xs text-muted-foreground">Na Fila</div>
                  </div>
                  <Badge 
                    variant={queue.status === 'ativa' ? 'default' : 'secondary'}
                    className="capitalize"
                  >
                    {queue.status}
                  </Badge>
                  <Badge 
                    variant="outline"
                    className={
                      queue.priority === 'alta' ? 'border-red-500 text-red-500' :
                      queue.priority === 'média' ? 'border-yellow-500 text-yellow-500' :
                      'border-gray-500 text-gray-500'
                    }
                  >
                    {queue.priority}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Features */}
      <div className="grid md:grid-cols-3 gap-6">
        {features.map((feature, index) => (
          <Card key={index} className="h-full hover:shadow-lg transition-shadow">
            <CardHeader className="text-center pb-4">
              <div className="w-16 h-16 mx-auto rounded-full bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center mb-4">
                <feature.icon className="h-8 w-8 text-primary" />
              </div>
              <CardTitle className="text-lg font-semibold">
                {feature.title}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-muted-foreground text-sm">
                {feature.description}
              </p>
              <div className="space-y-2">
                {feature.benefits.map((benefit, benefitIndex) => (
                  <div key={benefitIndex} className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-primary rounded-full" />
                    <span className="text-xs text-muted-foreground">{benefit}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Flow Diagram */}
      <Card>
        <CardHeader>
          <CardTitle>Fluxo de Distribuição de Tickets</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center space-x-4 flex-wrap gap-4">
            <div className="flex items-center space-x-2 bg-blue-500/10 px-4 py-2 rounded-lg">
              <Users className="h-5 w-5 text-blue-500" />
              <span className="font-medium">Cliente</span>
            </div>
            <ArrowRight className="h-5 w-5 text-muted-foreground" />
            <div className="flex items-center space-x-2 bg-purple-500/10 px-4 py-2 rounded-lg">
              <Zap className="h-5 w-5 text-purple-500" />
              <span className="font-medium">IA Analisa</span>
            </div>
            <ArrowRight className="h-5 w-5 text-muted-foreground" />
            <div className="flex items-center space-x-2 bg-orange-500/10 px-4 py-2 rounded-lg">
              <Settings className="h-5 w-5 text-orange-500" />
              <span className="font-medium">Fila Adequada</span>
            </div>
            <ArrowRight className="h-5 w-5 text-muted-foreground" />
            <div className="flex items-center space-x-2 bg-green-500/10 px-4 py-2 rounded-lg">
              <Users className="h-5 w-5 text-green-500" />
              <span className="font-medium">Agente Disponível</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Metrics */}
      <div className="bg-gradient-to-r from-primary/10 to-secondary/10 rounded-lg p-6">
        <h3 className="text-lg font-semibold mb-6 text-center text-foreground">
          Métricas de Performance
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-primary">1.2min</div>
            <div className="text-sm text-muted-foreground">Tempo Médio de Espera</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-primary">96%</div>
            <div className="text-sm text-muted-foreground">SLA Atendido</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-primary">12</div>
            <div className="text-sm text-muted-foreground">Agentes Online</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-primary">248</div>
            <div className="text-sm text-muted-foreground">Tickets Hoje</div>
          </div>
        </div>
      </div>

      {/* Configuration Example */}
      <Card>
        <CardHeader>
          <CardTitle>Exemplo de Configuração de Fila</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <h4 className="font-medium text-foreground">Configurações Básicas:</h4>
              <ul className="space-y-1 text-sm text-muted-foreground">
                <li>• Nome: "Suporte Técnico"</li>
                <li>• Tipo: Round-robin inteligente</li>
                <li>• Prioridade: Alta</li>
                <li>• Max agentes: 10</li>
              </ul>
            </div>
            <div className="space-y-2">
              <h4 className="font-medium text-foreground">Horários:</h4>
              <ul className="space-y-1 text-sm text-muted-foreground">
                <li>• Segunda-Sexta: 08:00-18:00</li>
                <li>• Sábado: 09:00-14:00</li>
                <li>• Domingo: Fechado</li>
                <li>• Fuso: America/Sao_Paulo</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* CTA */}
      <div className="text-center">
        <Button asChild size="lg" className="group">
          <Link to={`/client/${clientId}/queues`}>
            <Settings className="h-5 w-5 mr-2" />
            Configurar Filas
            <ArrowRight className="h-4 w-4 ml-2 group-hover:translate-x-1 transition-transform" />
          </Link>
        </Button>
      </div>

      {/* Tips */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20 rounded-lg p-6">
        <h3 className="text-lg font-semibold mb-3 text-foreground">⚡ Dicas de Configuração:</h3>
        <ul className="space-y-2 text-muted-foreground">
          <li>• Configure diferentes filas para tipos específicos de atendimento</li>
          <li>• Use prioridades para garantir que casos urgentes sejam atendidos primeiro</li>
          <li>• Monitore métricas regularmente para ajustar configurações</li>
          <li>• Treine agentes em múltiplas filas para maior flexibilidade</li>
        </ul>
      </div>
    </div>
  );
};