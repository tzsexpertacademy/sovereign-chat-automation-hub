import { Target, Repeat, MessageSquare, TrendingUp } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

export const AutomatedCampaignsSection = () => {
  const features = [
    {
      icon: Target,
      title: "Sequências inteligentes",
      description: "Baseadas no comportamento do cliente"
    },
    {
      icon: MessageSquare,
      title: "Multicanal integrado",
      description: "WhatsApp, Email e SMS sincronizados"
    },
    {
      icon: Repeat,
      title: "Recuperação automática",
      description: "Leads frios, feedback e abandono"
    },
    {
      icon: TrendingUp,
      title: "Upsell inteligente",
      description: "No momento certo, com linguagem natural"
    }
  ];

  return (
    <section className="py-20 px-6 bg-card">
      <div className="container mx-auto max-w-6xl">
        {/* Header */}
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 bg-secondary/10 border border-secondary/20 rounded-full px-4 py-2 mb-6">
            <Target className="w-4 h-4 text-secondary" />
            <span className="text-sm font-medium text-secondary">Campanhas Automáticas</span>
          </div>
          
          <h2 className="text-4xl md:text-5xl font-bold mb-6">
            <span className="bg-[var(--gradient-neon)] bg-clip-text text-transparent">
              Campanhas Automáticas
            </span>
            <br />
            <span className="text-foreground">que Não Soam Automáticas</span>
          </h2>
          
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto leading-relaxed">
            Enquanto você vive...<br />
            O YumerFlow <span className="text-primary font-semibold">reativa leads frios, faz upsell, fideliza clientes</span> — 
            tudo com a linguagem da sua marca.
          </p>
        </div>

        {/* Features Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-16">
          {features.map((feature, index) => (
            <Card key={index} className="bg-[var(--gradient-card)] border-border/50 hover:shadow-[var(--shadow-card)] transition-all duration-300 group">
              <CardContent className="p-6 text-center">
                <div className="w-16 h-16 bg-[var(--gradient-neon)] rounded-2xl flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform duration-300">
                  <feature.icon className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-lg font-semibold mb-2">{feature.title}</h3>
                <p className="text-muted-foreground text-sm">{feature.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Campaign Flow Visualization */}
        <div className="bg-[var(--gradient-card)] rounded-2xl p-8 border border-border/50 mb-16">
          <h3 className="text-2xl font-bold mb-8 text-center">Fluxo de Campanha Inteligente</h3>
          
          <div className="grid md:grid-cols-3 gap-8">
            {/* Step 1: Trigger */}
            <div className="text-center">
              <div className="w-20 h-20 bg-primary/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <Target className="w-10 h-10 text-primary" />
              </div>
              <h4 className="font-semibold mb-2">Gatilho Comportamental</h4>
              <p className="text-sm text-muted-foreground">
                Cliente abandona carrinho, não responde há 30 dias, ou visita página específica
              </p>
            </div>

            {/* Step 2: Sequence */}
            <div className="text-center">
              <div className="w-20 h-20 bg-secondary/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <MessageSquare className="w-10 h-10 text-secondary" />
              </div>
              <h4 className="font-semibold mb-2">Sequência Personalizada</h4>
              <p className="text-sm text-muted-foreground">
                Mensagens com intervalos humanizados, linguagem natural e ofertas relevantes
              </p>
            </div>

            {/* Step 3: Conversion */}
            <div className="text-center">
              <div className="w-20 h-20 bg-accent/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <TrendingUp className="w-10 h-10 text-accent" />
              </div>
              <h4 className="font-semibold mb-2">Conversão Natural</h4>
              <p className="text-sm text-muted-foreground">
                Cliente retorna ao funil sentindo que foi genuinamente cuidado
              </p>
            </div>
          </div>
        </div>

        {/* Content Types */}
        <div className="bg-muted/30 rounded-2xl p-8 border border-border/50">
          <h3 className="text-2xl font-bold mb-6 text-center">Conteúdo em Todos os Formatos</h3>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="text-center">
              <div className="w-12 h-12 bg-primary/20 rounded-xl flex items-center justify-center mx-auto mb-3">
                <MessageSquare className="w-6 h-6 text-primary" />
              </div>
              <h4 className="font-semibold text-sm">Texto Inteligente</h4>
            </div>
            
            <div className="text-center">
              <div className="w-12 h-12 bg-secondary/20 rounded-xl flex items-center justify-center mx-auto mb-3">
                <div className="w-6 h-4 bg-secondary rounded" />
              </div>
              <h4 className="font-semibold text-sm">Imagens Personalizadas</h4>
            </div>
            
            <div className="text-center">
              <div className="w-12 h-12 bg-accent/20 rounded-xl flex items-center justify-center mx-auto mb-3">
                <div className="w-6 h-4 bg-accent rounded-sm" />
              </div>
              <h4 className="font-semibold text-sm">Vídeos Automáticos</h4>
            </div>
            
            <div className="text-center">
              <div className="w-12 h-12 bg-primary/20 rounded-xl flex items-center justify-center mx-auto mb-3">
                <div className="w-2 h-2 bg-primary rounded-full" />
                <div className="w-2 h-2 bg-primary rounded-full ml-1" />
                <div className="w-2 h-2 bg-primary rounded-full ml-1" />
              </div>
              <h4 className="font-semibold text-sm">Voz Clonada</h4>
            </div>
          </div>
        </div>

        {/* Bottom Message */}
        <div className="text-center mt-16">
          <p className="text-xl font-semibold text-foreground mb-2">
            Marketing que parece cuidado,
          </p>
          <p className="text-lg text-muted-foreground">
            <span className="text-secondary font-semibold">não programação.</span>
          </p>
        </div>
      </div>
    </section>
  );
};