import { Mic, Volume2, PlayCircle, MessageSquare } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export const VoiceCloningSection = () => {
  const useCases = [
    {
      icon: MessageSquare,
      title: "Explica produtos",
      description: "Com sua voz, sua didática"
    },
    {
      icon: Volume2,
      title: "Envia promoções",
      description: "Tom entusiasmado e convincente"
    },
    {
      icon: PlayCircle,
      title: "Confirma agendamentos",
      description: "Profissional e acolhedor"
    },
    {
      icon: Mic,
      title: "Dá suporte técnico",
      description: "Paciente e detalhado"
    }
  ];

  return (
    <section className="py-20 px-6 bg-background">
      <div className="container mx-auto max-w-6xl">
        {/* Header */}
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 bg-secondary/10 border border-secondary/20 rounded-full px-4 py-2 mb-6">
            <Mic className="w-4 h-4 text-secondary" />
            <span className="text-sm font-medium text-secondary">Voz Clonada</span>
          </div>
          
          <h2 className="text-4xl md:text-5xl font-bold mb-6">
            <span className="bg-[var(--gradient-neon)] bg-clip-text text-transparent">
              Sua Voz, Multiplicada
            </span>
            <br />
            <span className="text-foreground">Sem Perder a Essência</span>
          </h2>
          
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto leading-relaxed mb-8">
            Com apenas <span className="text-secondary font-semibold">10 segundos de áudio</span>, clonamos seu tom, sua entonação, sua energia.<br />
            E então, ela fala por você. Por WhatsApp. Por áudio. <span className="text-primary font-semibold">Em escala.</span>
          </p>
        </div>

        {/* Voice Demo */}
        <div className="bg-[var(--gradient-card)] rounded-2xl p-8 mb-16 border border-border/50 relative overflow-hidden">
          <div className="absolute inset-0 bg-[var(--gradient-neon)] opacity-5" />
          
          <div className="relative z-10 text-center">
            <h3 className="text-2xl font-bold mb-6">Experimente Agora</h3>
            
            <div className="flex items-center justify-center gap-8 mb-6">
              {/* Original Voice */}
              <div className="text-center">
                <div className="w-20 h-20 bg-primary/20 rounded-full flex items-center justify-center mb-3 mx-auto">
                  <Mic className="w-10 h-10 text-primary" />
                </div>
                <p className="text-sm font-medium">Sua Voz Original</p>
                <Button variant="outline" size="sm" className="mt-2">
                  <PlayCircle className="w-4 h-4 mr-2" />
                  Ouvir Amostra
                </Button>
              </div>
              
              {/* Arrow */}
              <div className="text-4xl text-primary">→</div>
              
              {/* Cloned Voice */}
              <div className="text-center">
                <div className="w-20 h-20 bg-secondary/20 rounded-full flex items-center justify-center mb-3 mx-auto animate-pulse">
                  <Volume2 className="w-10 h-10 text-secondary" />
                </div>
                <p className="text-sm font-medium">IA com Sua Voz</p>
                <Button variant="outline" size="sm" className="mt-2">
                  <PlayCircle className="w-4 h-4 mr-2" />
                  Ouvir Resultado
                </Button>
              </div>
            </div>
            
            {/* Audio Waveform Visualization */}
            <div className="flex items-center justify-center gap-1 mb-4">
              {Array.from({ length: 30 }).map((_, i) => (
                <div
                  key={i}
                  className="w-1 bg-primary rounded-full animate-pulse"
                  style={{
                    height: `${Math.random() * 40 + 10}px`,
                    animationDelay: `${i * 0.1}s`
                  }}
                />
              ))}
            </div>
            
            <p className="text-muted-foreground italic">
              "Olá! Este é um exemplo de como sua voz clonada soaria explicando nossos produtos..."
            </p>
          </div>
        </div>

        {/* Use Cases Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {useCases.map((useCase, index) => (
            <Card key={index} className="bg-card border-border/50 hover:shadow-[var(--shadow-card)] transition-all duration-300 group">
              <CardContent className="p-6 text-center">
                <div className="w-16 h-16 bg-[var(--gradient-neon)] rounded-2xl flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform duration-300">
                  <useCase.icon className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-lg font-semibold mb-2">{useCase.title}</h3>
                <p className="text-muted-foreground text-sm">{useCase.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Bottom CTA */}
        <div className="text-center mt-16">
          <p className="text-xl font-semibold text-foreground mb-2">
            Seu cliente sente que foi você.
          </p>
          <p className="text-lg text-muted-foreground">
            <span className="text-primary font-semibold">Mesmo quando não foi.</span>
          </p>
        </div>
      </div>
    </section>
  );
};