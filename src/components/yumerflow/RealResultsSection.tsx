import { TrendingUp, MessageCircle, Clock, Users } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

export const RealResultsSection = () => {
  const metrics = [
    {
      icon: TrendingUp,
      value: "+300%",
      label: "Conversão em funis automatizados",
      color: "text-primary"
    },
    {
      icon: MessageCircle,
      value: "85%",
      label: "Dúvidas resolvidas sem humanos",
      color: "text-secondary"
    },
    {
      icon: Clock,
      value: "24/7",
      label: "Atendimento sem necessidade de equipe extra",
      color: "text-accent"
    },
    {
      icon: Users,
      value: "5x",
      label: "Mais leads qualificados com a mesma verba",
      color: "text-primary"
    }
  ];

  return (
    <section className="py-20 px-6 bg-background">
      <div className="container mx-auto max-w-6xl">
        {/* Header */}
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 bg-accent/10 border border-accent/20 rounded-full px-4 py-2 mb-6">
            <TrendingUp className="w-4 h-4 text-accent" />
            <span className="text-sm font-medium text-accent">Resultados Reais</span>
          </div>
          
          <h2 className="text-4xl md:text-5xl font-bold mb-6">
            <span className="bg-[var(--gradient-neon)] bg-clip-text text-transparent">
              Resultados Reais.
            </span>
            <br />
            <span className="text-foreground">Impacto Medível.</span>
          </h2>
          
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto leading-relaxed">
            O YumerFlow não substitui o humano.<br />
            <span className="text-primary font-semibold">Ele amplifica o que você tem de melhor.</span>
          </p>
        </div>

        {/* Metrics Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-16">
          {metrics.map((metric, index) => (
            <Card key={index} className="bg-[var(--gradient-card)] border-border/50 hover:shadow-[var(--shadow-card)] transition-all duration-300 group">
              <CardContent className="p-6 text-center">
                <div className="w-16 h-16 bg-[var(--gradient-neon)] rounded-2xl flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform duration-300">
                  <metric.icon className="w-8 h-8 text-white" />
                </div>
                <h3 className={`text-3xl font-bold mb-2 ${metric.color}`}>{metric.value}</h3>
                <p className="text-muted-foreground text-sm">{metric.label}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Chart Visualization */}
        <div className="bg-[var(--gradient-card)] rounded-2xl p-8 border border-border/50 mb-16">
          <h3 className="text-2xl font-bold mb-8 text-center">Evolução do Atendimento</h3>
          
          <div className="grid md:grid-cols-2 gap-8">
            {/* Before */}
            <div className="text-center">
              <h4 className="text-lg font-semibold mb-4 text-muted-foreground">Antes do YumerFlow</h4>
              <div className="space-y-3">
                <div className="bg-destructive/20 border border-destructive/30 rounded-lg p-3">
                  <p className="text-sm">Atendimento limitado ao horário comercial</p>
                </div>
                <div className="bg-destructive/20 border border-destructive/30 rounded-lg p-3">
                  <p className="text-sm">Respostas demoradas e genéricas</p>
                </div>
                <div className="bg-destructive/20 border border-destructive/30 rounded-lg p-3">
                  <p className="text-sm">Leads perdidos por falta de follow-up</p>
                </div>
                <div className="bg-destructive/20 border border-destructive/30 rounded-lg p-3">
                  <p className="text-sm">Equipe sobrecarregada com tarefas repetitivas</p>
                </div>
              </div>
            </div>

            {/* After */}
            <div className="text-center">
              <h4 className="text-lg font-semibold mb-4 text-primary">Depois do YumerFlow</h4>
              <div className="space-y-3">
                <div className="bg-primary/20 border border-primary/30 rounded-lg p-3">
                  <p className="text-sm">Atendimento 24/7 com qualidade humana</p>
                </div>
                <div className="bg-primary/20 border border-primary/30 rounded-lg p-3">
                  <p className="text-sm">Respostas instantâneas e personalizadas</p>
                </div>
                <div className="bg-primary/20 border border-primary/30 rounded-lg p-3">
                  <p className="text-sm">Leads nutridos automaticamente</p>
                </div>
                <div className="bg-primary/20 border border-primary/30 rounded-lg p-3">
                  <p className="text-sm">Equipe focada em estratégias de alto valor</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Success Stories */}
        <div className="grid md:grid-cols-3 gap-6">
          <Card className="bg-primary/5 border-primary/20 hover:shadow-[var(--shadow-card)] transition-all duration-300">
            <CardContent className="p-6 text-center">
              <h4 className="font-semibold mb-2">Clínica de Estética</h4>
              <p className="text-sm text-muted-foreground mb-3">
                Reduziu tempo de agendamento de 15 min para 30 segundos
              </p>
              <div className="text-2xl font-bold text-primary">+400%</div>
              <p className="text-xs text-muted-foreground">Eficiência operacional</p>
            </CardContent>
          </Card>

          <Card className="bg-secondary/5 border-secondary/20 hover:shadow-[var(--shadow-card)] transition-all duration-300">
            <CardContent className="p-6 text-center">
              <h4 className="font-semibold mb-2">Consultoria Empresarial</h4>
              <p className="text-sm text-muted-foreground mb-3">
                Qualificou leads 24h/dia com conversas naturais
              </p>
              <div className="text-2xl font-bold text-secondary">+250%</div>
              <p className="text-xs text-muted-foreground">Leads qualificados</p>
            </CardContent>
          </Card>

          <Card className="bg-accent/5 border-accent/20 hover:shadow-[var(--shadow-card)] transition-all duration-300">
            <CardContent className="p-6 text-center">
              <h4 className="font-semibold mb-2">E-commerce</h4>
              <p className="text-sm text-muted-foreground mb-3">
                Recuperou 60% dos carrinhos abandonados
              </p>
              <div className="text-2xl font-bold text-accent">+180%</div>
              <p className="text-xs text-muted-foreground">Taxa de conversão</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  );
};