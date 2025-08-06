
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { MessageSquare, Users, BarChart3, Zap, Shield, Globe, Phone, Brain, Mic, Calendar, Settings, TrendingUp, Heart } from "lucide-react";
import { useNavigate } from "react-router-dom";
import yumerLogo from "@/assets/yumer-logo.png";
import heroImage from "@/assets/hero-yumerflow.jpg";
import foundersImage from "@/assets/founders-team.jpg";

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

      {/* IA Humanizada Section */}
      <section id="ia-humanizada" className="py-20 px-6 bg-gradient-to-r from-gray-900 to-black">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center mb-16">
            <h2 className="text-5xl font-bold mb-6">
              <span className="bg-gradient-to-r from-purple-400 to-fuchsia-400 bg-clip-text text-transparent">
                Inteligência Humanizada
              </span>
            </h2>
            <p className="text-2xl text-gray-300 mb-4">A Máquina que Parece Gente</p>
            <p className="text-xl text-purple-200">Eles vão achar que é uma pessoa. Mas é a sua IA.</p>
          </div>
          
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <h3 className="text-3xl font-bold mb-6 text-white">YumerFlow vai além de fluxos prontos. Ele entende.</h3>
              <div className="space-y-4">
                {[
                  "Digita como humano (com pausas, erros e hesitações)",
                  "Lembra de interações anteriores",
                  "Muda o tom com base no humor do cliente", 
                  "Interpreta áudios, PDFs, imagens e vídeos",
                  "Responde com lógica, empatia e estratégia"
                ].map((feature, index) => (
                  <div key={index} className="flex items-start space-x-3">
                    <Brain className="w-5 h-5 text-purple-400 mt-1 flex-shrink-0" />
                    <span className="text-gray-300">{feature}</span>
                  </div>
                ))}
              </div>
            </div>
            
            <div className="bg-gradient-to-br from-purple-900/30 to-fuchsia-900/30 p-6 rounded-2xl border border-purple-500/20">
              <h4 className="text-lg font-semibold mb-4 text-purple-300">Exemplo real:</h4>
              <div className="space-y-3">
                <div className="bg-gray-800 p-3 rounded-lg">
                  <p className="text-sm text-gray-400">Cliente (2h da manhã)</p>
                  <p className="text-white">🎵 [Áudio confuso de 2 minutos]</p>
                </div>
                <div className="bg-purple-800/30 p-3 rounded-lg">
                  <p className="text-sm text-purple-300">YumerFlow</p>
                  <p className="text-white">Entendi sua dúvida sobre o plano premium. Vou te explicar de forma simples...</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

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
