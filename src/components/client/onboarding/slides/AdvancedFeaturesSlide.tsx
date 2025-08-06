import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowRight, BarChart3, Megaphone, Palette, Zap, Brain, Shield } from 'lucide-react';
import { Link } from 'react-router-dom';

interface AdvancedFeaturesSlideProps {
  clientId: string;
}

export const AdvancedFeaturesSlide: React.FC<AdvancedFeaturesSlideProps> = ({ clientId }) => {
  const features = [
    {
      icon: Megaphone,
      title: 'Campanhas Automatizadas',
      description: 'Crie campanhas de marketing via WhatsApp com segmentação inteligente e disparos automáticos',
      link: `/client/${clientId}/campaigns`,
      color: 'text-blue-500',
      gradient: 'from-blue-500/20 to-blue-600/10',
      benefits: ['Segmentação avançada', 'Disparos programados', 'Métricas detalhadas'],
      status: 'Disponível'
    },
    {
      icon: BarChart3,
      title: 'Analytics Avançados',
      description: 'Dashboard completo com métricas de performance, conversão e análise de comportamento',
      link: `/client/${clientId}/dashboard`,
      color: 'text-green-500',
      gradient: 'from-green-500/20 to-green-600/10',
      benefits: ['ROI em tempo real', 'Funil de conversão', 'Heatmaps de atividade'],
      status: 'Disponível'
    },
    {
      icon: Palette,
      title: 'Personalização Total',
      description: 'Customize completamente a interface, cores, logos e mensagens da sua marca',
      link: `/client/${clientId}/personalization`,
      color: 'text-purple-500',
      gradient: 'from-purple-500/20 to-purple-600/10',
      benefits: ['Brand customization', 'Templates personalizados', 'White-label'],
      status: 'Disponível'
    },
    {
      icon: Brain,
      title: 'IA Multi-Modal',
      description: 'Processamento de texto, áudio, imagem e vídeo com IA de última geração',
      link: `/client/${clientId}/assistants`,
      color: 'text-orange-500',
      gradient: 'from-orange-500/20 to-orange-600/10',
      benefits: ['Visão computacional', 'Análise de sentimento', 'OCR automático'],
      status: 'Beta'
    },
    {
      icon: Zap,
      title: 'Automações Avançadas',
      description: 'Fluxos de trabalho complexos com integrações nativas e webhooks customizados',
      link: `/client/${clientId}/settings`,
      color: 'text-teal-500',
      gradient: 'from-teal-500/20 to-teal-600/10',
      benefits: ['Workflows visuais', 'Integrações API', 'Triggers customizados'],
      status: 'Disponível'
    },
    {
      icon: Shield,
      title: 'Segurança Enterprise',
      description: 'Recursos de segurança avançados com compliance e auditoria completa',
      link: `/client/${clientId}/settings`,
      color: 'text-red-500',
      gradient: 'from-red-500/20 to-red-600/10',
      benefits: ['LGPD compliance', 'Logs de auditoria', 'Criptografia E2E'],
      status: 'Enterprise'
    }
  ];

  const upcomingFeatures = [
    {
      title: 'Integração com CRMs',
      description: 'Conecte com Salesforce, HubSpot, Pipedrive e outros CRMs',
      eta: 'Q2 2024'
    },
    {
      title: 'SDK para Desenvolvedores',
      description: 'SDK completo para criar integrações customizadas',
      eta: 'Q2 2024'
    },
    {
      title: 'Marketplace de Plugins',
      description: 'Biblioteca de plugins e integrações da comunidade',
      eta: 'Q3 2024'
    }
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-3xl font-bold text-foreground mb-4">
          Recursos Avançados
        </h1>
        <p className="text-lg text-muted-foreground max-w-3xl mx-auto">
          Explore todas as funcionalidades avançadas da plataforma YumerFlow para maximizar seu potencial de negócio
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
              <div className="flex items-center justify-center space-x-2 mb-2">
                <CardTitle className="text-lg font-semibold">
                  {feature.title}
                </CardTitle>
                <span className={`text-xs px-2 py-1 rounded-full ${
                  feature.status === 'Disponível' ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' :
                  feature.status === 'Beta' ? 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300' :
                  'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300'
                }`}>
                  {feature.status}
                </span>
              </div>
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
              <Button asChild variant="outline" className="w-full group/btn">
                <Link to={feature.link}>
                  Explorar
                  <ArrowRight className="h-4 w-4 ml-2 group-hover/btn:translate-x-1 transition-transform" />
                </Link>
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Platform Stats */}
      <div className="bg-gradient-to-r from-primary/10 to-secondary/10 rounded-lg p-6">
        <h3 className="text-lg font-semibold mb-6 text-center text-foreground">
          Estatísticas da Plataforma
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-primary">50+</div>
            <div className="text-sm text-muted-foreground">Recursos Disponíveis</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-primary">99.9%</div>
            <div className="text-sm text-muted-foreground">Uptime Garantido</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-primary">24/7</div>
            <div className="text-sm text-muted-foreground">Suporte Disponível</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-primary">10M+</div>
            <div className="text-sm text-muted-foreground">Mensagens Processadas</div>
          </div>
        </div>
      </div>

      {/* Upcoming Features */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Zap className="h-5 w-5 mr-2" />
            Próximos Lançamentos
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {upcomingFeatures.map((feature, index) => (
              <div key={index} className="flex items-center justify-between p-4 bg-muted rounded-lg">
                <div className="flex-1">
                  <h4 className="font-medium text-foreground">{feature.title}</h4>
                  <p className="text-sm text-muted-foreground">{feature.description}</p>
                </div>
                <div className="text-right">
                  <span className="text-sm font-medium text-primary">{feature.eta}</span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Integration Examples */}
      <Card>
        <CardHeader>
          <CardTitle>Exemplos de Integrações</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-2 gap-6">
            <div className="space-y-3">
              <h4 className="font-medium text-foreground">E-commerce</h4>
              <ul className="space-y-1 text-sm text-muted-foreground">
                <li>• WooCommerce / Shopify</li>
                <li>• Mercado Livre API</li>
                <li>• Sistemas de pagamento</li>
                <li>• Controle de estoque</li>
              </ul>
            </div>
            <div className="space-y-3">
              <h4 className="font-medium text-foreground">Produtividade</h4>
              <ul className="space-y-1 text-sm text-muted-foreground">
                <li>• Google Workspace</li>
                <li>• Microsoft 365</li>
                <li>• Slack / Teams</li>
                <li>• Zapier / Make</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Next Steps */}
      <div className="text-center space-y-4">
        <h3 className="text-xl font-semibold text-foreground">
          Pronto para Começar?
        </h3>
        <p className="text-muted-foreground">
          Você agora conhece todos os recursos da plataforma. Escolha por onde começar:
        </p>
        <div className="flex flex-wrap justify-center gap-4">
          <Button asChild size="lg" className="group">
            <Link to={`/client/${clientId}/dashboard`}>
              <BarChart3 className="h-5 w-5 mr-2" />
              Ver Dashboard
              <ArrowRight className="h-4 w-4 ml-2 group-hover:translate-x-1 transition-transform" />
            </Link>
          </Button>
          <Button asChild variant="outline" size="lg" className="group">
            <Link to={`/client/${clientId}/assistants`}>
              <Brain className="h-5 w-5 mr-2" />
              Configurar IA
              <ArrowRight className="h-4 w-4 ml-2 group-hover:translate-x-1 transition-transform" />
            </Link>
          </Button>
        </div>
      </div>

      {/* Final Tips */}
      <div className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-950/20 dark:to-purple-950/20 rounded-lg p-6">
        <h3 className="text-lg font-semibold mb-3 text-foreground">🚀 Dicas para Máximo Aproveitamento:</h3>
        <ul className="space-y-2 text-muted-foreground">
          <li>• Comece com recursos básicos e vá expandindo gradualmente</li>
          <li>• Use o suporte 24/7 sempre que tiver dúvidas</li>
          <li>• Participe da comunidade para trocar experiências</li>
          <li>• Mantenha-se atualizado com os novos recursos lançados</li>
        </ul>
      </div>
    </div>
  );
};