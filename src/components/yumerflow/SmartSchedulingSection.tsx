import { Calendar, Clock, CheckCircle, Bell } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

export const SmartSchedulingSection = () => {
  const features = [
    {
      icon: Calendar,
      title: "Integração Google Calendar",
      description: "Sincronização automática e inteligente"
    },
    {
      icon: Clock,
      title: "Escolha por profissional",
      description: "Área ou tipo de serviço específico"
    },
    {
      icon: CheckCircle,
      title: "Confirmações automáticas",
      description: "Por texto, imagem ou sua voz clonada"
    },
    {
      icon: Bell,
      title: "Lembretes inteligentes",
      description: "No momento certo antes do agendamento"
    }
  ];

  return (
    <section className="py-20 px-6 bg-card">
      <div className="container mx-auto max-w-6xl">
        {/* Header */}
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 bg-primary/10 border border-primary/20 rounded-full px-4 py-2 mb-6">
            <Calendar className="w-4 h-4 text-primary" />
            <span className="text-sm font-medium text-primary">Agendamento Inteligente</span>
          </div>
          
          <h2 className="text-4xl md:text-5xl font-bold mb-6">
            <span className="bg-[var(--gradient-neon)] bg-clip-text text-transparent">
              Agendamento que Funciona
            </span>
            <br />
            <span className="text-foreground">Sem Você Precisar Intervir</span>
          </h2>
          
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto leading-relaxed">
            Você dorme.<br />
            <span className="text-primary font-semibold">YumerFlow agenda, reagenda, avisa e organiza.</span>
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

        {/* Calendar Demo */}
        <div className="bg-[var(--gradient-card)] rounded-2xl p-8 border border-border/50 mb-16">
          <h3 className="text-2xl font-bold mb-6 text-center">Fluxo Automático</h3>
          
          <div className="grid md:grid-cols-4 gap-6">
            {/* Step 1 */}
            <div className="text-center">
              <div className="w-16 h-16 bg-primary/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <Calendar className="w-8 h-8 text-primary" />
              </div>
              <h4 className="font-semibold mb-2">Cliente Solicita</h4>
              <p className="text-sm text-muted-foreground">WhatsApp ou site</p>
            </div>

            {/* Arrow */}
            <div className="hidden md:flex items-center justify-center">
              <div className="text-2xl text-primary">→</div>
            </div>

            {/* Step 2 */}
            <div className="text-center">
              <div className="w-16 h-16 bg-secondary/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <Clock className="w-8 h-8 text-secondary" />
              </div>
              <h4 className="font-semibold mb-2">IA Analisa</h4>
              <p className="text-sm text-muted-foreground">Disponibilidade e preferências</p>
            </div>

            {/* Arrow */}
            <div className="hidden md:flex items-center justify-center">
              <div className="text-2xl text-primary">→</div>
            </div>

            {/* Step 3 */}
            <div className="text-center">
              <div className="w-16 h-16 bg-accent/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-8 h-8 text-accent" />
              </div>
              <h4 className="font-semibold mb-2">Confirma Automático</h4>
              <p className="text-sm text-muted-foreground">Com sua voz clonada</p>
            </div>
          </div>
        </div>

        {/* Success Story */}
        <div className="bg-primary/5 border border-primary/20 rounded-2xl p-8 text-center">
          <h3 className="text-2xl font-bold mb-4">Exemplo Prático:</h3>
          <p className="text-lg text-muted-foreground mb-2">
            Um coach agenda <span className="text-primary font-semibold">5 sessões por dia</span> com{" "}
            <span className="text-secondary font-semibold">0 intervenção humana</span>.
          </p>
          <p className="text-muted-foreground">
            A voz dele confirma tudo. O cliente se sente VIP.
          </p>
        </div>
      </div>
    </section>
  );
};