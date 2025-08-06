
import { Button } from "@/components/ui/button";
import { MessageSquare } from "lucide-react";
import { useNavigate } from "react-router-dom";
import yumerLogo from "@/assets/yumer-logo.png";
import { HeroSection } from "@/components/yumerflow/HeroSection";
import { AIHumanizedSection } from "@/components/yumerflow/AIHumanizedSection";
import { VoiceCloningSection } from "@/components/yumerflow/VoiceCloningSection";
import { SmartSchedulingSection } from "@/components/yumerflow/SmartSchedulingSection";
import { AdaptableCRMSection } from "@/components/yumerflow/AdaptableCRMSection";
import { AutomatedCampaignsSection } from "@/components/yumerflow/AutomatedCampaignsSection";
import { RealResultsSection } from "@/components/yumerflow/RealResultsSection";
import { FoundersSection } from "@/components/yumerflow/FoundersSection";
import { HumanSupportSection } from "@/components/yumerflow/HumanSupportSection";
import { FinalCTASection } from "@/components/yumerflow/FinalCTASection";

const Index = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      {/* Fixed Header */}
      <header className="fixed top-0 w-full bg-background/80 backdrop-blur-sm border-b border-border/50 z-50">
        <div className="container mx-auto px-6 py-4 flex justify-between items-center">
          <div className="flex items-center space-x-3">
            <img src={yumerLogo} alt="Yumer" className="w-8 h-8" />
            <h1 className="text-xl font-bold bg-[var(--gradient-neon)] bg-clip-text text-transparent">
              YumerFlow
            </h1>
          </div>
          
          {/* Navigation Menu */}
          <nav className="hidden md:flex items-center space-x-6">
            <a href="#ia-humanizada" className="text-muted-foreground hover:text-primary transition-colors">IA Humanizada</a>
            <a href="#voz-clonada" className="text-muted-foreground hover:text-primary transition-colors">Voz Clonada</a>
            <a href="#agendamento" className="text-muted-foreground hover:text-primary transition-colors">Agendamento</a>
            <a href="#crm" className="text-muted-foreground hover:text-primary transition-colors">CRM</a>
          </nav>
          
          <Button 
            onClick={() => window.open("https://wa.me/554731802324", '_blank')}
            className="bg-[var(--gradient-neon)] hover:shadow-[var(--shadow-neon)] transition-all duration-300"
          >
            <MessageSquare className="w-4 h-4 mr-2" />
            WhatsApp
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <main className="pt-20">
        <HeroSection />
        <div id="ia-humanizada">
          <AIHumanizedSection />
        </div>
        <div id="voz-clonada">
          <VoiceCloningSection />
        </div>
        <div id="agendamento">
          <SmartSchedulingSection />
        </div>
        <div id="crm">
          <AdaptableCRMSection />
        </div>
        <AutomatedCampaignsSection />
        <RealResultsSection />
        <FoundersSection />
        <HumanSupportSection />
        <FinalCTASection />
      </main>

      {/* Footer */}
      <footer className="py-8 px-6 bg-card border-t border-border/50">
        <div className="container mx-auto text-center">
          <div className="flex justify-center items-center space-x-3 mb-4">
            <img src={yumerLogo} alt="Yumer" className="w-6 h-6" />
            <span className="font-bold bg-[var(--gradient-neon)] bg-clip-text text-transparent">
              YumerFlow
            </span>
          </div>
          <p className="text-muted-foreground text-sm mb-4">
            © 2024 YumerFlow - A tecnologia que fala como você e vende como ninguém.
          </p>
          {/* Admin Link Discreto */}
          <button 
            onClick={() => navigate('/admin')}
            className="text-xs text-muted-foreground/50 hover:text-muted-foreground transition-colors"
          >
            Admin
          </button>
        </div>
      </footer>
    </div>
  );
};

export default Index;
