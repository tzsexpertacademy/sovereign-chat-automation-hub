import { Button } from "@/components/ui/button";
import { Phone, ArrowRight } from "lucide-react";

export const FinalCTASection = () => {
  const whatsappUrl = "https://wa.me/554731802324";

  return (
    <section className="py-20 px-6 bg-[var(--gradient-hero)] relative overflow-hidden">
      <div className="absolute inset-0 bg-[var(--gradient-neon)] opacity-10" />
      
      <div className="container mx-auto max-w-4xl relative z-10 text-center">
        <h2 className="text-4xl md:text-6xl font-bold mb-6 text-foreground">
          <span className="bg-[var(--gradient-neon)] bg-clip-text text-transparent">
            A Decisão que Muda
          </span>
          <br />
          <span className="text-foreground">seu Atendimento</span>
        </h2>
        
        <p className="text-xl md:text-2xl text-muted-foreground mb-8 leading-relaxed">
          Você chegou até aqui.<br />
          Seu cliente nunca mais deveria sentir que está sendo atendido por um script robótico.
        </p>
        
        <div className="mb-8">
          <p className="text-lg text-muted-foreground mb-4">
            Fale com o YumerFlow agora.
          </p>
          <p className="text-muted-foreground">
            Deixe que a nossa IA entenda seu negócio e mostre, em 5 minutos, o que pode ser transformado.
          </p>
        </div>
        
        <Button 
          size="lg" 
          className="bg-[var(--gradient-neon)] hover:shadow-[var(--shadow-neon)] transition-all duration-300 text-xl px-12 py-8 mb-8"
          onClick={() => window.open(whatsappUrl, '_blank')}
        >
          <Phone className="w-6 h-6 mr-3" />
          Falar com um Especialista no WhatsApp
          <ArrowRight className="w-6 h-6 ml-3" />
        </Button>
        
        <div className="text-center">
          <p className="text-muted-foreground mb-2">Sem formulário. Sem espera.</p>
          <p className="text-lg font-semibold text-foreground mb-4">
            Só uma conversa inteligente — do jeito que seu cliente merece.
          </p>
          
          <div className="border-t border-border/20 pt-6 mt-8">
            <p className="text-2xl font-bold text-foreground mb-2">
              YumerFlow.
            </p>
            <p className="text-lg text-muted-foreground">
              A tecnologia que fala como você. <span className="text-primary font-semibold">E vende como ninguém.</span>
            </p>
          </div>
        </div>
      </div>
    </section>
  );
};