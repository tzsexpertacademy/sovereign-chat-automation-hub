
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { MessageSquare, Users, BarChart3, Zap, Shield, Globe, Phone, Brain, Mic, Calendar, Settings, TrendingUp, Heart } from "lucide-react";
import { useNavigate } from "react-router-dom";
import VoiceCloningSection from "@/components/yumerflow/VoiceCloningSection";
import SmartSchedulingSection from "@/components/yumerflow/SmartSchedulingSection";
import AdaptableCRMSection from "@/components/yumerflow/AdaptableCRMSection";
import AutomatedCampaignsSection from "@/components/yumerflow/AutomatedCampaignsSection";
import RealResultsSection from "@/components/yumerflow/RealResultsSection";
import HumanSupportSection from "@/components/yumerflow/HumanSupportSection";
import yumerLogo from "@/assets/yumer-logo.png";
import heroImage from "@/assets/hero-yumerflow.jpg";
import foundersImage from "/lovable-uploads/a77cb0ed-df85-4dbe-be20-c556ca6b2d3d.png";

const Index = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Fixed Header */}
      <header className="fixed top-0 w-full bg-black/90 backdrop-blur-sm border-b border-white/10 z-50">
        <div className="container mx-auto px-6 py-4 flex justify-between items-center">
          <div className="flex items-center space-x-3">
            <img src={yumerLogo} alt="Yumer" className="w-8 h-8" />
            <h1 className="text-xl font-bold bg-gradient-to-r from-purple-400 to-fuchsia-400 bg-clip-text text-transparent">
              YumerFlow
            </h1>
          </div>
          <nav className="hidden md:flex space-x-6">
            <a href="#ia-humanizada" className="hover:text-purple-400 transition-colors">IA Humanizada</a>
            <a href="#voz-clonada" className="hover:text-purple-400 transition-colors">Voz Clonada</a>
            <a href="#agendamentos" className="hover:text-purple-400 transition-colors">Agendamentos</a>
            <a href="#crm" className="hover:text-purple-400 transition-colors">CRM</a>
          </nav>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative min-h-screen flex items-center justify-center px-6 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-purple-900/20 to-fuchsia-900/20" />
        <img src={heroImage} alt="YumerFlow Hero" className="absolute inset-0 w-full h-full object-cover opacity-30" />
        
        <div className="relative z-10 text-center max-w-5xl mx-auto">
          <h1 className="text-6xl md:text-7xl font-bold mb-6 leading-tight">
            <span className="bg-gradient-to-r from-white to-purple-200 bg-clip-text text-transparent">
              O Atendimento do Futuro,
            </span>
            <br />
            <span className="bg-gradient-to-r from-purple-400 to-fuchsia-400 bg-clip-text text-transparent">
              com a Alma do Presente
            </span>
          </h1>
          
          <p className="text-2xl mb-4 text-gray-300 max-w-4xl mx-auto leading-relaxed">
            Transforme seu <span className="text-green-400 font-semibold">WhatsApp</span> em um Especialista que Encanta, Vende e Constrói Relacionamento
          </p>
          <p className="text-lg mb-8 text-purple-200">— Sem Parecer IA</p>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4 mb-10 max-w-4xl mx-auto">
            <div className="flex items-center space-x-2 text-purple-300">
              <div className="w-2 h-2 bg-purple-400 rounded-full" />
              <span className="text-sm">Automatize 90% das interações</span>
            </div>
            <div className="flex items-center space-x-2 text-purple-300">
              <div className="w-2 h-2 bg-purple-400 rounded-full" />
              <span className="text-sm">Sua própria voz clonada</span>
            </div>
            <div className="flex items-center space-x-2 text-purple-300">
              <div className="w-2 h-2 bg-purple-400 rounded-full" />
              <span className="text-sm">CRM adaptável</span>
            </div>
            <div className="flex items-center space-x-2 text-purple-300">
              <div className="w-2 h-2 bg-purple-400 rounded-full" />
              <span className="text-sm">Agendamentos inteligentes</span>
            </div>
          </div>
          
          <a 
            href="https://wa.me/554731802324" 
            target="_blank" 
            rel="noopener noreferrer"
            className="inline-flex items-center space-x-3 bg-gradient-to-r from-purple-500 to-fuchsia-500 hover:from-purple-600 hover:to-fuchsia-600 text-white px-8 py-4 rounded-full text-lg font-semibold transition-all transform hover:scale-105 shadow-lg hover:shadow-xl"
          >
            <Phone className="w-5 h-5" />
            <span>Chamar no WhatsApp Agora</span>
          </a>
        </div>
      </section>

      {/* 2. Inteligência Humanizada - MOVIDO PARA 2ª POSIÇÃO */}
      <section id="ia-humanizada" className="py-20 px-6 bg-gradient-to-r from-gray-900 to-black">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center mb-16">
            <h2 className="text-5xl font-bold mb-6">
              <span className="bg-gradient-to-r from-purple-400 to-fuchsia-400 bg-clip-text text-transparent">
                🧠 Inteligência que Emociona
              </span>
            </h2>
            <p className="text-2xl text-gray-300 mb-4">Cada conversa única, cada resposta personalizada</p>
            <p className="text-xl text-purple-200">"Seus clientes não vão saber que é IA"</p>
          </div>

          <div className="grid lg:grid-cols-2 gap-16 items-center">
            {/* Chat Simulation */}
            <div className="bg-gray-800 rounded-3xl p-6 shadow-2xl border border-gray-700">
              <div className="bg-green-600 text-white px-4 py-2 rounded-t-xl text-center font-semibold">
                WhatsApp Business
              </div>
              
              <div className="bg-white rounded-b-xl p-4 h-80 overflow-y-auto space-y-4">
                <div className="flex justify-start">
                  <div className="bg-gray-200 rounded-2xl rounded-bl-sm px-4 py-2 max-w-xs">
                    <p className="text-gray-800">Oi! Gostaria de saber mais sobre os seus produtos</p>
                    <span className="text-xs text-gray-500">14:23</span>
                  </div>
                </div>
                
                <div className="flex justify-end">
                  <div className="bg-green-500 text-white rounded-2xl rounded-br-sm px-4 py-2 max-w-xs">
                    <p>Olá! Que bom te ver por aqui! 😊 Tenho certeza que posso te ajudar a encontrar exatamente o que você precisa. Me conta, qual tipo de solução você está buscando?</p>
                    <span className="text-xs text-green-100">14:23</span>
                  </div>
                </div>
                
                <div className="flex justify-start">
                  <div className="bg-gray-200 rounded-2xl rounded-bl-sm px-4 py-2 max-w-xs">
                    <p className="text-gray-800">Preciso de algo para organizar meus clientes</p>
                    <span className="text-xs text-gray-500">14:24</span>
                  </div>
                </div>
                
                <div className="flex justify-end">
                  <div className="bg-green-500 text-white rounded-2xl rounded-br-sm px-4 py-2 max-w-xs">
                    <p>Perfeito! Organização é fundamental para crescer. Pelo que entendi, você quer ter controle total dos seus clientes e não perder nenhuma oportunidade, certo? Nosso CRM integrado é perfeito para isso! Posso te mostrar como funciona?</p>
                    <span className="text-xs text-green-100">14:24</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Features List */}
            <div className="space-y-8">
              <div className="space-y-6">
                <div className="flex items-start space-x-4">
                  <div className="bg-gradient-to-r from-purple-500 to-fuchsia-500 rounded-full p-3">
                    <MessageSquare className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-white mb-2">Contexto Completo</h3>
                    <p className="text-gray-300">Lembra de toda conversa, histórico e preferências de cada cliente</p>
                  </div>
                </div>
                
                <div className="flex items-start space-x-4">
                  <div className="bg-gradient-to-r from-purple-500 to-fuchsia-500 rounded-full p-3">
                    <Heart className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-white mb-2">Empatia Genuína</h3>
                    <p className="text-gray-300">Reconhece emoções e adapta o tom da conversa automaticamente</p>
                  </div>
                </div>
                
                <div className="flex items-start space-x-4">
                  <div className="bg-gradient-to-r from-purple-500 to-fuchsia-500 rounded-full p-3">
                    <Brain className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-white mb-2">Aprendizado Contínuo</h3>
                    <p className="text-gray-300">Fica mais inteligente a cada interação, sempre melhorando</p>
                  </div>
                </div>
              </div>

              <div className="bg-black/40 backdrop-blur-sm rounded-2xl p-6 border border-purple-500/20">
                <h4 className="text-lg font-bold text-white mb-4">Resultado Real:</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center">
                    <div className="text-3xl font-bold text-green-400">94%</div>
                    <p className="text-sm text-gray-400">Satisfação do cliente</p>
                  </div>
                  <div className="text-center">
                    <div className="text-3xl font-bold text-purple-400">+280%</div>
                    <p className="text-sm text-gray-400">Taxa de conversão</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <VoiceCloningSection />
      <SmartSchedulingSection />
      <AdaptableCRMSection />
      <AutomatedCampaignsSection />
      <RealResultsSection />
      <HumanSupportSection />

      {/* Fundadores Section */}
      <section className="py-20 px-6 bg-black">
        <div className="container mx-auto max-w-4xl text-center">
          <h2 className="text-4xl font-bold mb-6">
            <span className="bg-gradient-to-r from-purple-400 to-fuchsia-400 bg-clip-text text-transparent">
              Quem está por trás da revolução
            </span>
          </h2>
          <p className="text-xl text-gray-300 mb-12">Conheça os fundadores que estão transformando o atendimento</p>
          
          <div className="relative">
            <img 
              src={foundersImage} 
              alt="Fundadores: Thalis, Deni e Alan" 
              className="w-full max-w-2xl mx-auto rounded-2xl shadow-2xl"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent rounded-2xl" />
            <div className="absolute bottom-6 left-6 right-6 text-left">
              <h3 className="text-2xl font-bold text-white mb-2">Thalis, Deni e Alan</h3>
              <p className="text-purple-200">Fundadores da Yumer</p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Final Section */}
      <section className="py-20 px-6 bg-gradient-to-r from-purple-900 to-fuchsia-900">
        <div className="container mx-auto max-w-4xl text-center">
          <h2 className="text-5xl font-bold mb-6 text-white">
            A Decisão que Muda seu Atendimento
          </h2>
          <p className="text-xl mb-4 text-purple-100">Você chegou até aqui.</p>
          <p className="text-lg mb-8 text-purple-200">
            Seu cliente nunca mais deveria sentir que está sendo atendido por um script robótico.
          </p>
          
          <div className="bg-black/20 p-8 rounded-2xl mb-8 backdrop-blur-sm">
            <p className="text-xl mb-6 text-white">
              Deixe que a nossa IA entenda seu negócio e mostre, em 5 minutos, o que pode ser transformado.
            </p>
            <a 
              href="https://wa.me/554731802324" 
              target="_blank" 
              rel="noopener noreferrer"
              className="inline-flex items-center space-x-3 bg-white text-purple-900 hover:bg-gray-100 px-8 py-4 rounded-full text-lg font-bold transition-all transform hover:scale-105 shadow-lg hover:shadow-xl"
            >
              <Phone className="w-5 h-5" />
              <span>Falar com um Especialista</span>
            </a>
          </div>
          
          <div className="text-center">
            <p className="text-purple-200 mb-2">Sem formulário. Sem espera.</p>
            <p className="text-white font-semibold">Só uma conversa inteligente — do jeito que seu cliente merece.</p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-6 bg-black border-t border-white/10">
        <div className="container mx-auto text-center">
          <div className="flex items-center justify-center space-x-4 mb-4">
            <img src={yumerLogo} alt="Yumer" className="w-6 h-6" />
            <span className="text-purple-400 font-semibold">YumerFlow</span>
          </div>
          <p className="text-gray-400 mb-4">A tecnologia que fala como você. E vende como ninguém.</p>
          <p className="text-gray-500 text-sm">© 2024 YumerFlow - O Atendimento do Futuro</p>
          
          {/* Admin link discreto */}
          <div className="mt-6 pt-4 border-t border-gray-800">
            <button 
              onClick={() => navigate('/admin')}
              className="text-gray-600 hover:text-gray-400 text-xs transition-colors"
            >
              Admin
            </button>
          </div>
        </div>
      </footer>

      {/* WhatsApp Float Button */}
      <a 
        href="https://wa.me/554731802324" 
        target="_blank" 
        rel="noopener noreferrer"
        className="fixed bottom-6 right-6 bg-green-500 hover:bg-green-600 text-white p-4 rounded-full shadow-lg hover:shadow-xl transition-all transform hover:scale-110 z-50"
      >
        <Phone className="w-6 h-6" />
      </a>
    </div>
  );
};

export default Index;
