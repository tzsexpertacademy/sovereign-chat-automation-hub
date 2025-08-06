import { Button } from "@/components/ui/button";
import { MessageSquare, Phone } from "lucide-react";
import heroImage from "@/assets/hero-yumerflow.jpg";

export const HeroSection = () => {
  const whatsappUrl = "https://wa.me/554731802324";

  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
      {/* Gradient Background */}
      <div className="absolute inset-0 bg-[var(--gradient-hero)]" />
      
      {/* Animated Gradient Overlay */}
      <div className="absolute inset-0 bg-[var(--gradient-neon)] opacity-20 animate-pulse" />
      
      <div className="container mx-auto px-6 py-20 relative z-10">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Text Content */}
          <div className="text-center lg:text-left">
            <div className="inline-flex items-center gap-2 bg-primary/10 border border-primary/20 rounded-full px-4 py-2 mb-6">
              <MessageSquare className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium text-primary">YumerFlow</span>
            </div>
            
            <h1 className="text-4xl md:text-6xl font-bold mb-6 leading-tight">
              <span className="bg-[var(--gradient-neon)] bg-clip-text text-transparent">
                O Atendimento do Futuro,
              </span>
              <br />
              <span className="text-foreground">
                com a Alma do Presente
              </span>
            </h1>
            
            <p className="text-xl md:text-2xl text-muted-foreground mb-8 leading-relaxed">
              Transforme seu WhatsApp em um{" "}
              <span className="text-primary font-semibold">Especialista que Encanta, Vende</span>{" "}
              e Constrói Relacionamento — <span className="text-secondary font-semibold">Sem Parecer IA</span>
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 mb-8">
              <Button 
                size="lg" 
                className="bg-[var(--gradient-neon)] hover:shadow-[var(--shadow-neon)] transition-all duration-300 text-lg px-8 py-6"
                onClick={() => window.open(whatsappUrl, '_blank')}
              >
                <Phone className="w-5 h-5 mr-2" />
                Falar no WhatsApp Agora
              </Button>
              
              <Button 
                variant="outline" 
                size="lg"
                className="border-primary text-primary hover:bg-primary/10 text-lg px-8 py-6"
              >
                Ver Demonstração
              </Button>
            </div>
            
            {/* Phone Number Display */}
            <div className="inline-flex items-center gap-2 text-muted-foreground">
              <Phone className="w-4 h-4" />
              <span className="font-mono text-lg">+55 47 3180-2324</span>
            </div>
          </div>
          
          {/* Hero Image */}
          <div className="relative">
            <div className="relative rounded-2xl overflow-hidden shadow-[var(--shadow-card)]">
              <img 
                src={heroImage} 
                alt="YumerFlow WhatsApp Interface"
                className="w-full h-auto"
              />
              <div className="absolute inset-0 bg-[var(--gradient-neon)] opacity-10" />
            </div>
            
            {/* Floating Elements */}
            <div className="absolute -top-4 -right-4 w-16 h-16 bg-primary rounded-full opacity-60 animate-bounce" />
            <div className="absolute -bottom-6 -left-6 w-12 h-12 bg-secondary rounded-full opacity-40 animate-pulse" />
          </div>
        </div>
      </div>
      
      {/* Scroll Indicator */}
      <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2">
        <div className="w-6 h-10 border-2 border-primary rounded-full flex justify-center">
          <div className="w-1 h-3 bg-primary rounded-full mt-2 animate-bounce" />
        </div>
      </div>
    </section>
  );
};