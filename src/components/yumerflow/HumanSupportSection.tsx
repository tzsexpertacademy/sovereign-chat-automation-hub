import { Phone, Users, BookOpen, Wrench } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

export const HumanSupportSection = () => {
  const features = [
    {
      icon: Phone,
      title: "Suporte via WhatsApp",
      description: "Com gente de verdade, não bots"
    },
    {
      icon: Users,
      title: "Onboarding especializado",
      description: "Feito por especialistas dedicados"
    },
    {
      icon: Wrench,
      title: "Customização completa",
      description: "Com acompanhamento técnico pessoal"
    },
    {
      icon: BookOpen,
      title: "Treinamentos inclusos",
      description: "Quando necessário, sem custo adicional"
    }
  ];

  return (
    <section className="py-20 px-6 bg-background">
      <div className="container mx-auto max-w-6xl">
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 bg-accent/10 border border-accent/20 rounded-full px-4 py-2 mb-6">
            <Users className="w-4 h-4 text-accent" />
            <span className="text-sm font-medium text-accent">Suporte Humano</span>
          </div>
          
          <h2 className="text-4xl md:text-5xl font-bold mb-6">
            <span className="bg-[var(--gradient-neon)] bg-clip-text text-transparent">
              Suporte Humano.
            </span>
            <br />
            <span className="text-foreground">Conexão Real.</span>
          </h2>
          
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto leading-relaxed">
            Você não compra uma ferramenta.<br />
            <span className="text-primary font-semibold">Você ativa um time.</span>
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
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
      </div>
    </section>
  );
};