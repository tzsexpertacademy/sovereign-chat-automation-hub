import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MessageSquare, Mail, Smartphone, Clock, Zap, Play, Users, Heart } from "lucide-react";

const AutomatedCampaignsSection = () => {
  const [activeStep, setActiveStep] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  const campaignSteps = [
    {
      day: "Dia 1",
      time: "9h00",
      channel: "WhatsApp",
      icon: MessageSquare,
      color: "bg-green-500",
      message: "Olá! Vi que você se interessou pelo nosso produto. Que tal conhecer mais?",
      type: "Primeira abordagem"
    },
    {
      day: "Dia 3", 
      time: "14h30",
      channel: "Email",
      icon: Mail,
      color: "bg-blue-500",
      message: "Preparamos um material exclusivo sobre como isso pode transformar seu negócio.",
      type: "Educativo"
    },
    {
      day: "Dia 7",
      time: "10h15",
      channel: "SMS",
      icon: Smartphone,
      color: "bg-purple-500",
      message: "Última chance: 20% OFF válido apenas hoje. Quer aproveitar?",
      type: "Urgência"
    },
    {
      day: "Dia 10",
      time: "16h00",
      channel: "WhatsApp",
      icon: MessageSquare,
      color: "bg-green-500",
      message: "Olá! Notei que ainda não finalizou. Posso ajudar com alguma dúvida?",
      type: "Reengajamento"
    }
  ];

  const channels = [
    { name: "WhatsApp", icon: MessageSquare, color: "text-green-400", active: true },
    { name: "Email", icon: Mail, color: "text-blue-400", active: true },
    { name: "SMS", icon: Smartphone, color: "text-purple-400", active: true },
  ];

  useEffect(() => {
    if (isPlaying) {
      const interval = setInterval(() => {
        setActiveStep(prev => (prev + 1) % campaignSteps.length);
      }, 2000);
      return () => clearInterval(interval);
    }
  }, [isPlaying, campaignSteps.length]);

  return (
    <section className="py-20 px-6 bg-gradient-to-r from-gray-900 to-black">
      <div className="container mx-auto max-w-6xl">
        <div className="text-center mb-16">
          <h2 className="text-5xl font-bold mb-6">
            <span className="bg-gradient-to-r from-purple-400 to-fuchsia-400 bg-clip-text text-transparent">
              🔁 Campanhas que Nunca Dormem
            </span>
          </h2>
          <p className="text-2xl text-gray-300 mb-4">Sequências automáticas multicanal</p>
          <p className="text-xl text-purple-200">"Marketing que parece cuidado, não programação"</p>
        </div>

        <div className="grid lg:grid-cols-2 gap-12">
          {/* Timeline Animation */}
          <div className="space-y-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-2xl font-bold text-white">Timeline Automática</h3>
              <Button
                onClick={() => setIsPlaying(!isPlaying)}
                className={`rounded-full ${isPlaying ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'}`}
              >
                <Play className="w-4 h-4 mr-2" />
                {isPlaying ? 'Pausar' : 'Demonstrar'}
              </Button>
            </div>

            <div className="relative">
              {/* Timeline Line */}
              <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-gradient-to-b from-purple-500 to-fuchsia-500" />
              
              {campaignSteps.map((step, index) => (
                <div
                  key={index}
                  className={`relative flex items-start space-x-4 pb-8 transition-all duration-500 ${
                    activeStep === index ? 'opacity-100 scale-105' : 'opacity-70'
                  }`}
                >
                  {/* Timeline Dot */}
                  <div className={`relative z-10 ${step.color} rounded-full p-3 shadow-lg ${
                    activeStep === index ? 'ring-4 ring-white/20' : ''
                  }`}>
                    <step.icon className="w-5 h-5 text-white" />
                  </div>
                  
                  {/* Content Card */}
                  <Card className={`flex-1 transition-all duration-300 ${
                    activeStep === index 
                      ? 'bg-gradient-to-br from-purple-900/40 to-fuchsia-900/40 border-purple-500/40 shadow-xl' 
                      : 'bg-gray-800/50 border-gray-700'
                  }`}>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center space-x-2">
                          <span className="text-sm font-semibold text-purple-400">{step.day}</span>
                          <span className="text-xs text-gray-400">{step.time}</span>
                        </div>
                        <div className="text-xs bg-gray-700 px-2 py-1 rounded text-gray-300">
                          {step.type}
                        </div>
                      </div>
                      <p className="text-white text-sm mb-2 font-medium">{step.message}</p>
                      <div className="flex items-center space-x-2">
                        <step.icon className="w-4 h-4 text-gray-400" />
                        <span className="text-xs text-gray-400">{step.channel}</span>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              ))}
            </div>
          </div>

          {/* Multicanal & Controls */}
          <div className="space-y-6">
            <h3 className="text-2xl font-bold text-white mb-6">Multicanal Inteligente</h3>
            
            {/* Channel Status */}
            <Card className="bg-gray-800/50 border-gray-700">
              <CardHeader>
                <CardTitle className="text-white">Canais Ativos</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {channels.map((channel, index) => (
                    <div key={index} className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <channel.icon className={`w-5 h-5 ${channel.color}`} />
                        <span className="text-gray-300">{channel.name}</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                        <span className="text-xs text-green-400">Ativo</span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Campaign Stats */}
            <Card className="bg-gradient-to-br from-purple-900/30 to-fuchsia-900/30 border-purple-500/20">
              <CardHeader>
                <CardTitle className="text-white">Performance em Tempo Real</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-400">89%</div>
                    <p className="text-xs text-gray-400">Taxa de entrega</p>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-400">34%</div>
                    <p className="text-xs text-gray-400">Taxa de abertura</p>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-purple-400">12%</div>
                    <p className="text-xs text-gray-400">Taxa de conversão</p>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-fuchsia-400">247</div>
                    <p className="text-xs text-gray-400">Leads ativos</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Smart Features */}
            <div className="space-y-4">
              <h4 className="text-lg font-semibold text-white">Recursos Inteligentes:</h4>
              
              {[
                { icon: Clock, title: "Timing Otimizado", desc: "Envia no melhor horário para cada cliente" },
                { icon: Users, title: "Segmentação Dinâmica", desc: "Adapta a mensagem ao perfil do lead" },
                { icon: Heart, title: "Tom Humanizado", desc: "Cada mensagem soa natural e cuidadosa" },
                { icon: Zap, title: "Gatilhos Inteligentes", desc: "Reage ao comportamento em tempo real" }
              ].map((feature, index) => (
                <div key={index} className="flex items-start space-x-3 p-3 bg-black/20 rounded-lg">
                  <feature.icon className="w-5 h-5 text-purple-400 mt-0.5" />
                  <div>
                    <h5 className="text-white font-medium">{feature.title}</h5>
                    <p className="text-gray-300 text-sm">{feature.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Results Section */}
        <div className="mt-16 grid md:grid-cols-3 gap-6">
          <div className="text-center bg-black/40 backdrop-blur-sm rounded-2xl p-6 border border-green-500/20">
            <div className="text-4xl font-bold text-green-400 mb-2">+340%</div>
            <p className="text-gray-300">Aumento em conversões</p>
            <p className="text-sm text-gray-500 mt-1">vs. campanhas manuais</p>
          </div>
          <div className="text-center bg-black/40 backdrop-blur-sm rounded-2xl p-6 border border-blue-500/20">
            <div className="text-4xl font-bold text-blue-400 mb-2">24/7</div>
            <p className="text-gray-300">Operação contínua</p>
            <p className="text-sm text-gray-500 mt-1">Nunca perde uma oportunidade</p>
          </div>
          <div className="text-center bg-black/40 backdrop-blur-sm rounded-2xl p-6 border border-purple-500/20">
            <div className="text-4xl font-bold text-purple-400 mb-2">-85%</div>
            <p className="text-gray-300">Menos tempo manual</p>
            <p className="text-sm text-gray-500 mt-1">Foque no que importa</p>
          </div>
        </div>

        {/* CTA */}
        <div className="text-center mt-16">
          <div className="bg-gradient-to-r from-purple-900/40 to-fuchsia-900/40 backdrop-blur-sm rounded-2xl p-8 border border-purple-500/20">
            <h3 className="text-3xl font-bold text-white mb-4">
              Pronto para campanhas que trabalham enquanto você dorme?
            </h3>
            <p className="text-gray-300 mb-6">
              Configure uma vez, colha resultados para sempre
            </p>
            <a
              href="https://wa.me/554731802324"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center space-x-2 bg-gradient-to-r from-purple-500 to-fuchsia-500 hover:from-purple-600 hover:to-fuchsia-600 text-white px-8 py-4 rounded-full font-bold transition-all transform hover:scale-105"
            >
              <Zap className="w-5 h-5" />
              <span>Automatizar Minhas Campanhas</span>
            </a>
          </div>
        </div>
      </div>
    </section>
  );
};

export default AutomatedCampaignsSection;