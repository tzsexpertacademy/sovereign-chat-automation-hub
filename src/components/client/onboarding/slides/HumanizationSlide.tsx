import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Mic, MessageCircle, User, Sparkles, Volume2, Clock } from 'lucide-react';

interface HumanizationSlideProps {
  clientId: string;
}

export const HumanizationSlide: React.FC<HumanizationSlideProps> = ({ clientId }) => {
  const features = [
    {
      icon: Volume2,
      title: 'Clonagem de Voz',
      description: 'Integração com ElevenLabs para criar vozes personalizadas que soam naturais',
      benefits: ['Voz única da marca', 'Tom personalizado', 'Múltiplos idiomas'],
      color: 'text-blue-500',
      gradient: 'from-blue-500/20 to-blue-600/10'
    },
    {
      icon: Mic,
      title: 'Processamento de Áudio',
      description: 'Processamento de áudio em tempo real para conversas fluidas',
      benefits: ['Resposta instantânea', 'Qualidade HD', 'Redução de ruído'],
      color: 'text-purple-500',
      gradient: 'from-purple-500/20 to-purple-600/10'
    },
    {
      icon: MessageCircle,
      title: 'Indicadores Visuais',
      description: 'Indicadores de digitação e gravação para simular presença humana',
      benefits: ['Status "digitando"', 'Indicador de áudio', 'Presença online'],
      color: 'text-green-500',
      gradient: 'from-green-500/20 to-green-600/10'
    },
    {
      icon: User,
      title: 'Personalidade Única',
      description: 'Configure personalidade, tom de voz e estilo de comunicação',
      benefits: ['Tom personalizado', 'Contexto específico', 'Memória de conversas'],
      color: 'text-orange-500',
      gradient: 'from-orange-500/20 to-orange-600/10'
    },
    {
      icon: Clock,
      title: 'Tempo de Resposta Natural',
      description: 'Delays inteligentes que simulam tempo de leitura e reflexão humana',
      benefits: ['Timing realista', 'Pausas naturais', 'Ritmo humano'],
      color: 'text-teal-500',
      gradient: 'from-teal-500/20 to-teal-600/10'
    },
    {
      icon: Sparkles,
      title: 'IA Avançada',
      description: 'Algoritmos de última geração para conversas mais inteligentes',
      benefits: ['Compreensão contextual', 'Aprendizado contínuo', 'Respostas precisas'],
      color: 'text-pink-500',
      gradient: 'from-pink-500/20 to-pink-600/10'
    }
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-3xl font-bold text-foreground mb-4">
          Qualidades da Humanização
        </h1>
        <p className="text-lg text-muted-foreground max-w-3xl mx-auto">
          Descubra como nossa IA se torna indistinguível de um atendente humano através de recursos avançados de humanização
        </p>
      </div>

      {/* Features Grid */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {features.map((feature, index) => (
          <Card key={index} className="h-full hover:shadow-lg transition-all duration-300 hover:scale-105 group">
            <CardHeader className="text-center pb-4">
              <div className={`w-16 h-16 mx-auto rounded-full bg-gradient-to-br ${feature.gradient} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
                <feature.icon className={`h-8 w-8 ${feature.color}`} />
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
                  <Badge 
                    key={benefitIndex} 
                    variant="secondary" 
                    className="text-xs mr-2 mb-2"
                  >
                    {benefit}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Comparison Section */}
      <div className="grid md:grid-cols-2 gap-6 mt-12">
        {/* Before */}
        <Card className="border-red-200 dark:border-red-800">
          <CardHeader className="bg-red-50 dark:bg-red-950/50">
            <CardTitle className="text-red-700 dark:text-red-300 flex items-center">
              <MessageCircle className="h-5 w-5 mr-2" />
              IA Tradicional
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            <ul className="space-y-2 text-muted-foreground">
              <li>❌ Respostas robóticas e mecânicas</li>
              <li>❌ Tempo de resposta instantâneo (não natural)</li>
              <li>❌ Sem personalidade ou contexto</li>
              <li>❌ Voz sintética artificial</li>
              <li>❌ Não entende nuances emocionais</li>
            </ul>
          </CardContent>
        </Card>

        {/* After */}
        <Card className="border-green-200 dark:border-green-800">
          <CardHeader className="bg-green-50 dark:bg-green-950/50">
            <CardTitle className="text-green-700 dark:text-green-300 flex items-center">
              <Sparkles className="h-5 w-5 mr-2" />
              YumerFlow IA
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            <ul className="space-y-2 text-muted-foreground">
              <li>✅ Conversas naturais e fluidas</li>
              <li>✅ Timing humano com pausas realistas</li>
              <li>✅ Personalidade única configurável</li>
              <li>✅ Voz clonada indistinguível</li>
              <li>✅ Compreende contexto emocional</li>
            </ul>
          </CardContent>
        </Card>
      </div>

      {/* Stats Section */}
      <div className="bg-gradient-to-r from-primary/10 to-secondary/10 rounded-lg p-6">
        <h3 className="text-lg font-semibold mb-6 text-center text-foreground">
          Resultados Comprovados
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-primary">94%</div>
            <div className="text-sm text-muted-foreground">Satisfação do Cliente</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-primary">2.3s</div>
            <div className="text-sm text-muted-foreground">Tempo Médio de Resposta</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-primary">87%</div>
            <div className="text-sm text-muted-foreground">Resolução Automática</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-primary">24/7</div>
            <div className="text-sm text-muted-foreground">Disponibilidade</div>
          </div>
        </div>
      </div>

      {/* Tips */}
      <div className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-950/20 dark:to-purple-950/20 rounded-lg p-6">
        <h3 className="text-lg font-semibold mb-3 text-foreground">🎯 Dicas de Humanização:</h3>
        <ul className="space-y-2 text-muted-foreground">
          <li>• Configure uma personalidade que combine com sua marca</li>
          <li>• Use padrões de conversa específicos do seu negócio</li>
          <li>• Ajuste o timing para parecer mais natural</li>
          <li>• Treine a IA com exemplos reais de conversas</li>
        </ul>
      </div>
    </div>
  );
};