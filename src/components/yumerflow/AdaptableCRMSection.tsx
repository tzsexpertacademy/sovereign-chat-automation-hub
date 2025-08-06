import { Settings, Tag, BarChart3, Kanban } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

export const AdaptableCRMSection = () => {
  const features = [
    {
      icon: Settings,
      title: "Personalização por nicho",
      description: "Campos e fluxos específicos do seu negócio"
    },
    {
      icon: Tag,
      title: "Tags inteligentes",
      description: "Automáticas por comportamento do cliente"
    },
    {
      icon: Kanban,
      title: "Kanban customizado",
      description: "Dividido por setor e necessidade"
    },
    {
      icon: BarChart3,
      title: "Relatórios visuais",
      description: "Sobre o que realmente importa"
    }
  ];

  const examples = [
    {
      title: "Clínica Estética",
      stages: ["Pré-avaliação", "Consulta", "Pós-tratamento"],
      fields: "Data de retorno + Histórico de procedimentos"
    },
    {
      title: "Agência de Tráfego",
      stages: ["Briefing", "Aprovação Criativa", "Campanha Ativa", "Relatório Final"],
      fields: "Orçamento + ROI + Plataformas"
    },
    {
      title: "Mentoria Profissional",
      stages: ["Diagnóstico", "Plano de Ação", "Acompanhamento", "Resultados"],
      fields: "Objetivos + Evolução individual"
    }
  ];

  return (
    <section className="py-20 px-6 bg-background">
      <div className="container mx-auto max-w-6xl">
        {/* Header */}
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 bg-accent/10 border border-accent/20 rounded-full px-4 py-2 mb-6">
            <Settings className="w-4 h-4 text-accent" />
            <span className="text-sm font-medium text-accent">CRM Adaptável</span>
          </div>
          
          <h2 className="text-4xl md:text-5xl font-bold mb-6">
            <span className="bg-[var(--gradient-neon)] bg-clip-text text-transparent">
              CRM que se Adapta
            </span>
            <br />
            <span className="text-foreground">ao seu Negócio, Não o Contrário</span>
          </h2>
          
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto leading-relaxed">
            Nada de campos inúteis. Nada de funis genéricos.<br />
            Com o YumerFlow, seu CRM é <span className="text-primary font-semibold">moldado com você, pra você.</span>
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

        {/* Examples Section */}
        <div className="space-y-8 mb-16">
          <h3 className="text-3xl font-bold text-center mb-8">Exemplos Reais de Personalização</h3>
          
          <div className="grid lg:grid-cols-3 gap-8">
            {examples.map((example, index) => (
              <Card key={index} className="bg-[var(--gradient-card)] border-border/50 hover:shadow-[var(--shadow-card)] transition-all duration-300">
                <CardContent className="p-6">
                  <h4 className="text-xl font-bold mb-4 text-primary">{example.title}</h4>
                  
                  <div className="mb-4">
                    <p className="text-sm font-semibold text-muted-foreground mb-2">Etapas do Funil:</p>
                    <div className="space-y-2">
                      {example.stages.map((stage, i) => (
                        <div key={i} className="bg-primary/10 text-primary px-3 py-1 rounded-full text-sm">
                          {stage}
                        </div>
                      ))}
                    </div>
                  </div>
                  
                  <div>
                    <p className="text-sm font-semibold text-muted-foreground mb-2">Campos Especiais:</p>
                    <p className="text-sm">{example.fields}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Bottom CTA */}
        <div className="bg-primary/5 border border-primary/20 rounded-2xl p-8 text-center">
          <h3 className="text-2xl font-bold mb-4">E o melhor:</h3>
          <p className="text-lg text-muted-foreground mb-2">
            Tudo isso <span className="text-primary font-semibold">sem precisar de equipe de TI</span>.
          </p>
          <p className="text-xl font-semibold text-foreground">
            Você diz, a gente constrói.
          </p>
        </div>
      </div>
    </section>
  );
};