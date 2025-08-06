import { Brain, MessageCircle, Clock, Heart } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

export const AIHumanizedSection = () => {
  const features = [
    {
      icon: MessageCircle,
      title: "Digita como humano",
      description: "Com pausas, erros e hesitações naturais"
    },
    {
      icon: Brain,
      title: "Lembra de tudo",
      description: "Interações anteriores sempre em contexto"
    },
    {
      icon: Heart,
      title: "Muda o tom",
      description: "Baseado no humor e perfil do cliente"
    },
    {
      icon: Clock,
      title: "Disponível 24/7",
      description: "Responde às 2h da manhã como um especialista"
    }
  ];

  return (
    <section className="py-20 px-6 bg-card">
      <div className="container mx-auto max-w-6xl">
        {/* Header */}
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 bg-primary/10 border border-primary/20 rounded-full px-4 py-2 mb-6">
            <Brain className="w-4 h-4 text-primary" />
            <span className="text-sm font-medium text-primary">Inteligência Humanizada</span>
          </div>
          
          <h2 className="text-4xl md:text-5xl font-bold mb-6">
            <span className="bg-[var(--gradient-neon)] bg-clip-text text-transparent">
              A Máquina que Parece Gente
            </span>
          </h2>
          
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto leading-relaxed">
            Eles vão achar que é uma pessoa. Mas é a sua IA.<br />
            YumerFlow vai além de fluxos prontos. <span className="text-primary font-semibold">Ele entende.</span>
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

        {/* Example Conversation */}
        <div className="bg-muted/30 rounded-2xl p-8 border border-border/50">
          <h3 className="text-2xl font-bold mb-6 text-center">Exemplo Real:</h3>
          
          <div className="max-w-md mx-auto space-y-4">
            {/* Client Message */}
            <div className="flex justify-end">
              <div className="bg-primary text-primary-foreground rounded-2xl rounded-tr-sm px-4 py-3 max-w-[80%]">
                <p className="text-sm">🎙️ [Áudio confuso às 2h da manhã]</p>
              </div>
            </div>
            
            {/* Typing Indicator */}
            <div className="flex justify-start">
              <div className="bg-card border border-border rounded-2xl rounded-tl-sm px-4 py-3">
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 bg-primary rounded-full animate-bounce" />
                  <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0.1s' }} />
                  <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
                  <span className="text-xs text-muted-foreground ml-2">digitando...</span>
                </div>
              </div>
            </div>
            
            {/* AI Response */}
            <div className="flex justify-start">
              <div className="bg-card border border-border rounded-2xl rounded-tl-sm px-4 py-3 max-w-[80%]">
                <p className="text-sm">
                  Oi! Ouvi seu áudio e entendi perfeitamente sua dúvida sobre o agendamento. 
                  Que tal marcarmos para amanhã às 14h? Já tenho sua disponibilidade aqui no sistema.
                </p>
              </div>
            </div>
          </div>
          
          <p className="text-center text-muted-foreground mt-6 font-medium">
            O YumerFlow transcreve, entende, responde com precisão — <span className="text-primary">como um consultor experiente faria.</span>
          </p>
        </div>
      </div>
    </section>
  );
};