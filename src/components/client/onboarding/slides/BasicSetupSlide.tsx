import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowRight, Bot, Layers, Zap } from 'lucide-react';
import { Link } from 'react-router-dom';

interface BasicSetupSlideProps {
  clientId: string;
}

export const BasicSetupSlide: React.FC<BasicSetupSlideProps> = ({ clientId }) => {
  const steps = [
    {
      number: 1,
      title: 'Criar um Assistente IA',
      description: 'Configure seu assistente virtual com personalidade e conhecimento específico',
      icon: Bot,
      action: 'Criar Assistente',
      link: `/client/${clientId}/assistants`,
      color: 'text-blue-500'
    },
    {
      number: 2,
      title: 'Conectar a uma Fila',
      description: 'Vincule o assistente a uma fila de atendimento para organizar os tickets',
      icon: Layers,
      action: 'Configurar Filas',
      link: `/client/${clientId}/queues`,
      color: 'text-purple-500'
    },
    {
      number: 3,
      title: 'Conectar uma Instância',
      description: 'Conecte ao WhatsApp através de uma instância para começar a receber mensagens',
      icon: Zap,
      action: 'Conectar WhatsApp',
      link: `/client/${clientId}/connect`,
      color: 'text-green-500'
    }
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-3xl font-bold text-foreground mb-4">
          Configure Seu Primeiro Assistente em 3 Passos
        </h1>
        <p className="text-lg text-muted-foreground max-w-3xl mx-auto">
          Siga estes passos simples para ter seu primeiro assistente IA funcionando e atendendo seus clientes automaticamente
        </p>
      </div>

      {/* Steps */}
      <div className="grid md:grid-cols-3 gap-6">
        {steps.map((step, index) => (
          <div key={step.number} className="relative">
            <Card className="h-full hover:shadow-lg transition-shadow duration-300 border-2 hover:border-primary/20">
              <CardHeader className="text-center pb-4">
                <div className={`w-16 h-16 mx-auto rounded-full bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center mb-4`}>
                  <step.icon className={`h-8 w-8 ${step.color}`} />
                </div>
                <div className="absolute -top-3 -left-3 w-8 h-8 bg-primary text-primary-foreground rounded-full flex items-center justify-center font-bold text-sm">
                  {step.number}
                </div>
                <CardTitle className="text-xl font-semibold">
                  {step.title}
                </CardTitle>
              </CardHeader>
              <CardContent className="text-center space-y-4">
                <p className="text-muted-foreground">
                  {step.description}
                </p>
                <Button asChild className="w-full group">
                  <Link to={step.link}>
                    {step.action}
                    <ArrowRight className="h-4 w-4 ml-2 group-hover:translate-x-1 transition-transform" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
            
            {/* Arrow between steps */}
            {index < steps.length - 1 && (
              <div className="hidden md:block absolute top-1/2 -right-3 transform -translate-y-1/2 z-10">
                <ArrowRight className="h-6 w-6 text-primary" />
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Flow Diagram */}
      <Card className="mt-8">
        <CardHeader>
          <CardTitle className="text-center">Fluxo de Configuração</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center space-x-4 flex-wrap">
            <div className="flex items-center space-x-2 bg-blue-500/10 px-4 py-2 rounded-lg">
              <Bot className="h-5 w-5 text-blue-500" />
              <span className="font-medium">Assistente</span>
            </div>
            <ArrowRight className="h-5 w-5 text-muted-foreground" />
            <div className="flex items-center space-x-2 bg-purple-500/10 px-4 py-2 rounded-lg">
              <Layers className="h-5 w-5 text-purple-500" />
              <span className="font-medium">Fila</span>
            </div>
            <ArrowRight className="h-5 w-5 text-muted-foreground" />
            <div className="flex items-center space-x-2 bg-green-500/10 px-4 py-2 rounded-lg">
              <Zap className="h-5 w-5 text-green-500" />
              <span className="font-medium">WhatsApp</span>
            </div>
            <ArrowRight className="h-5 w-5 text-muted-foreground" />
            <div className="flex items-center space-x-2 bg-primary/10 px-4 py-2 rounded-lg">
              <span className="font-medium text-primary">✨ Funcionando!</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Quick Tips */}
      <div className="bg-gradient-to-r from-primary/10 to-secondary/10 rounded-lg p-6">
        <h3 className="text-lg font-semibold mb-3 text-foreground">💡 Dicas Rápidas:</h3>
        <ul className="space-y-2 text-muted-foreground">
          <li>• Comece com configurações simples e vá refinando aos poucos</li>
          <li>• Teste sempre em ambiente controlado antes de ativar para todos os clientes</li>
          <li>• Use templates prontos para acelerar a configuração inicial</li>
        </ul>
      </div>
    </div>
  );
};