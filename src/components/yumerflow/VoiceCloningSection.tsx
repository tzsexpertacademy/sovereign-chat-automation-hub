import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Play, Pause, Volume2, Mic } from "lucide-react";

const VoiceCloningSection = () => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [activeScenario, setActiveScenario] = useState(0);

  const scenarios = [
    {
      title: "Explicação de Produtos",
      description: "Cliente pergunta sobre funcionalidades",
      audioTime: "2:15"
    },
    {
      title: "Promoções Especiais",
      description: "Oferta personalizada para o cliente",
      audioTime: "1:45"
    },
    {
      title: "Agendamentos",
      description: "Confirmação de horário marcado",
      audioTime: "1:30"
    },
    {
      title: "Suporte Técnico",
      description: "Resolução de dúvidas complexas",
      audioTime: "3:20"
    }
  ];

  return (
    <section id="voz-clonada" className="py-20 px-6 bg-gradient-to-r from-black to-gray-900">
      <div className="container mx-auto max-w-6xl">
        <div className="text-center mb-16">
          <h2 className="text-5xl font-bold mb-6">
            <span className="bg-gradient-to-r from-purple-400 to-fuchsia-400 bg-clip-text text-transparent">
              🎙️ Sua Voz, Multiplicada
            </span>
          </h2>
          <p className="text-2xl text-gray-300 mb-4">Clone sua voz e atenda 1000 clientes ao mesmo tempo</p>
          <p className="text-xl text-purple-200">"Seu cliente sente que foi você. Mesmo quando não foi."</p>
        </div>

        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Audio Player Demo */}
          <div className="space-y-6">
            <div className="bg-gradient-to-br from-purple-900/30 to-fuchsia-900/30 p-8 rounded-2xl border border-purple-500/20">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-white">Player de Demonstração</h3>
                <Mic className="w-6 h-6 text-purple-400" />
              </div>
              
              {/* Audio Waveform Animation */}
              <div className="flex items-center justify-center space-x-1 mb-6 h-16">
                {[...Array(20)].map((_, i) => (
                  <div
                    key={i}
                    className={`bg-gradient-to-t from-purple-500 to-fuchsia-500 rounded-full transition-all duration-300 ${
                      isPlaying ? 'animate-pulse' : ''
                    }`}
                    style={{
                      width: '4px',
                      height: `${Math.random() * 40 + 10}px`,
                      animationDelay: `${i * 0.1}s`
                    }}
                  />
                ))}
              </div>

              {/* Play Controls */}
              <div className="flex items-center justify-between">
                <Button
                  onClick={() => setIsPlaying(!isPlaying)}
                  className="bg-purple-600 hover:bg-purple-700 text-white rounded-full w-12 h-12"
                >
                  {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-1" />}
                </Button>
                
                <div className="flex-1 mx-4">
                  <div className="bg-gray-700 rounded-full h-2 overflow-hidden">
                    <div className="bg-gradient-to-r from-purple-500 to-fuchsia-500 h-full w-1/3 transition-all duration-300" />
                  </div>
                </div>
                
                <Volume2 className="w-5 h-5 text-gray-400" />
              </div>
            </div>

            <p className="text-center text-purple-200 text-lg">
              ↑ Ouça como sua voz clonada atende naturalmente
            </p>
          </div>

          {/* Scenarios Cards */}
          <div className="space-y-4">
            <h3 className="text-2xl font-bold text-white mb-6">4 Cenários Principais:</h3>
            {scenarios.map((scenario, index) => (
              <Card
                key={index}
                className={`cursor-pointer transition-all duration-300 border ${
                  activeScenario === index
                    ? 'border-purple-500 bg-purple-900/20'
                    : 'border-gray-700 bg-gray-800/50 hover:border-purple-600'
                }`}
                onClick={() => setActiveScenario(index)}
              >
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-lg font-semibold text-white mb-2">
                        {scenario.title}
                      </h4>
                      <p className="text-gray-400">{scenario.description}</p>
                    </div>
                    <div className="text-right">
                      <div className="text-purple-400 font-mono text-sm">
                        {scenario.audioTime}
                      </div>
                      <Play className="w-4 h-4 text-purple-400 mt-1" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Bottom CTA */}
        <div className="text-center mt-16">
          <div className="bg-black/40 backdrop-blur-sm rounded-2xl p-8 border border-purple-500/20">
            <h3 className="text-3xl font-bold text-white mb-4">
              Pronto para ter sua voz trabalhando 24/7?
            </h3>
            <p className="text-gray-300 mb-6">
              Em 48 horas, sua voz estará atendendo todos os seus clientes
            </p>
            <a
              href="https://wa.me/554731802324"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center space-x-2 bg-gradient-to-r from-purple-500 to-fuchsia-500 hover:from-purple-600 hover:to-fuchsia-600 text-white px-6 py-3 rounded-full font-semibold transition-all transform hover:scale-105"
            >
              <Mic className="w-4 h-4" />
              <span>Clonar Minha Voz</span>
            </a>
          </div>
        </div>
      </div>
    </section>
  );
};

export default VoiceCloningSection;