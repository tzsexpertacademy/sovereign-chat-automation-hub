import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BarChart3, Users, Settings, Sparkles, ArrowRight, CheckCircle } from "lucide-react";

const AdaptableCRMSection = () => {
  const [activeExample, setActiveExample] = useState(0);

  const examples = [
    {
      title: "Clínica Estética",
      icon: "💆‍♀️",
      color: "from-pink-500 to-rose-500",
      features: [
        "Pipeline: Consulta → Orçamento → Procedimento → Acompanhamento",
        "Campos: Tipo de pele, histórico, tratamentos anteriores",
        "Automações: Lembretes pós-procedimento, promoções personalizadas"
      ],
      kanban: [
        { stage: "Interesse", count: 12, color: "bg-blue-500" },
        { stage: "Consulta", count: 8, color: "bg-yellow-500" },
        { stage: "Orçamento", count: 5, color: "bg-orange-500" },
        { stage: "Agendado", count: 3, color: "bg-green-500" }
      ]
    },
    {
      title: "Agência de Tráfego",
      icon: "📊",
      color: "from-blue-500 to-cyan-500",
      features: [
        "Pipeline: Lead → Diagnóstico → Proposta → Contrato → Entrega",
        "Campos: Budget, nicho, canais atuais, metas de ROI",
        "Automações: Reports automáticos, alertas de performance"
      ],
      kanban: [
        { stage: "Leads", count: 25, color: "bg-purple-500" },
        { stage: "Qualificados", count: 15, color: "bg-blue-500" },
        { stage: "Propostas", count: 8, color: "bg-orange-500" },
        { stage: "Fechados", count: 4, color: "bg-green-500" }
      ]
    },
    {
      title: "Mentoria Business",
      icon: "🎯",
      color: "from-purple-500 to-indigo-500",
      features: [
        "Pipeline: Descoberta → Avaliação → Programa → Acompanhamento",
        "Campos: Nível atual, objetivos, prazo, investimento disponível",
        "Automações: Check-ins semanais, material exclusivo"
      ],
      kanban: [
        { stage: "Interessados", count: 18, color: "bg-indigo-500" },
        { stage: "Avaliação", count: 10, color: "bg-blue-500" },
        { stage: "Em Programa", count: 6, color: "bg-green-500" },
        { stage: "Alumni", count: 20, color: "bg-yellow-500" }
      ]
    }
  ];

  return (
    <section id="crm" className="py-20 px-6 bg-gradient-to-r from-black to-gray-900">
      <div className="container mx-auto max-w-6xl">
        <div className="text-center mb-16">
          <h2 className="text-5xl font-bold mb-6">
            <span className="bg-gradient-to-r from-purple-400 to-fuchsia-400 bg-clip-text text-transparent">
              📊 CRM que se Adapta a Você
            </span>
          </h2>
          <p className="text-2xl text-gray-300 mb-4">Cada negócio é único. Seu CRM também deveria ser.</p>
          <p className="text-xl text-purple-200">"Você diz, a gente constrói"</p>
        </div>

        {/* Business Type Selector */}
        <div className="flex flex-wrap justify-center gap-4 mb-12">
          {examples.map((example, index) => (
            <Button
              key={index}
              onClick={() => setActiveExample(index)}
              className={`px-6 py-3 rounded-full text-white transition-all ${
                activeExample === index
                  ? `bg-gradient-to-r ${example.color}`
                  : 'bg-gray-700 hover:bg-gray-600'
              }`}
            >
              <span className="mr-2">{example.icon}</span>
              {example.title}
            </Button>
          ))}
        </div>

        {/* Active Example Display */}
        <div className="grid lg:grid-cols-2 gap-12">
          {/* Kanban Visual */}
          <div className="space-y-6">
            <h3 className="text-2xl font-bold text-white mb-4">
              Pipeline Personalizado: {examples[activeExample].title}
            </h3>
            
            <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl p-6 border border-gray-700">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {examples[activeExample].kanban.map((stage, index) => (
                  <div key={index} className="space-y-3">
                    <div className={`${stage.color} rounded-lg p-3 text-white text-center`}>
                      <div className="font-bold text-2xl">{stage.count}</div>
                      <div className="text-sm opacity-90">{stage.stage}</div>
                    </div>
                    {/* Sample cards */}
                    <div className="space-y-2">
                      {[...Array(Math.min(stage.count, 3))].map((_, cardIndex) => (
                        <div key={cardIndex} className="bg-gray-700 rounded p-2 text-xs text-gray-300">
                          Cliente {cardIndex + 1}
                        </div>
                      ))}
                      {stage.count > 3 && (
                        <div className="text-xs text-gray-500 text-center">
                          +{stage.count - 3} mais
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Interactive Features */}
            <Card className="bg-gradient-to-br from-purple-900/30 to-fuchsia-900/30 border-purple-500/20">
              <CardHeader>
                <CardTitle className="flex items-center space-x-2 text-white">
                  <Settings className="w-5 h-5 text-purple-400" />
                  <span>Campos Customizados</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {examples[activeExample].features.map((feature, index) => (
                    <div key={index} className="flex items-start space-x-3">
                      <CheckCircle className="w-5 h-5 text-green-400 mt-0.5 flex-shrink-0" />
                      <span className="text-white text-sm">{feature}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Adaptation Process */}
          <div className="space-y-6">
            <h3 className="text-2xl font-bold text-white mb-6">
              Como Funciona a Adaptação:
            </h3>

            <div className="space-y-4">
              {[
                {
                  step: "1",
                  title: "Análise do Seu Negócio",
                  description: "Entendemos seu processo, clientes e objetivos",
                  icon: BarChart3
                },
                {
                  step: "2", 
                  title: "Configuração Personalizada",
                  description: "Criamos campos, pipelines e automações específicas",
                  icon: Settings
                },
                {
                  step: "3",
                  title: "Integração Inteligente",
                  description: "Conectamos com suas ferramentas existentes",
                  icon: Sparkles
                },
                {
                  step: "4",
                  title: "Evolução Contínua",
                  description: "O sistema aprende e se adapta com seu crescimento",
                  icon: ArrowRight
                }
              ].map((item, index) => (
                <div key={index} className="flex items-start space-x-4">
                  <div className="bg-gradient-to-r from-purple-500 to-fuchsia-500 rounded-full w-10 h-10 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                    {item.step}
                  </div>
                  <div className="flex-1">
                    <h4 className="text-lg font-semibold text-white mb-2 flex items-center space-x-2">
                      <item.icon className="w-5 h-5 text-purple-400" />
                      <span>{item.title}</span>
                    </h4>
                    <p className="text-gray-300">{item.description}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Success Stats */}
            <div className="bg-black/40 backdrop-blur-sm rounded-2xl p-6 border border-purple-500/20 mt-8">
              <h4 className="text-lg font-bold text-white mb-4">Resultados Comprovados:</h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center">
                  <div className="text-3xl font-bold text-purple-400">73%</div>
                  <p className="text-sm text-gray-400">Mais conversões</p>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-fuchsia-400">4.2x</div>
                  <p className="text-sm text-gray-400">ROI médio</p>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-green-400">-60%</div>
                  <p className="text-sm text-gray-400">Tempo perdido</p>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-blue-400">24h</div>
                  <p className="text-sm text-gray-400">Para configurar</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom CTA */}
        <div className="text-center mt-16">
          <div className="bg-gradient-to-r from-purple-900/40 to-fuchsia-900/40 backdrop-blur-sm rounded-2xl p-8 border border-purple-500/20">
            <h3 className="text-3xl font-bold text-white mb-4">
              Pronto para um CRM feito para o SEU negócio?
            </h3>
            <p className="text-gray-300 mb-6">
              Conte-nos sobre seu processo e vamos criar a solução perfeita
            </p>
            <a
              href="https://wa.me/554731802324"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center space-x-2 bg-gradient-to-r from-purple-500 to-fuchsia-500 hover:from-purple-600 hover:to-fuchsia-600 text-white px-8 py-4 rounded-full font-bold transition-all transform hover:scale-105"
            >
              <Users className="w-5 h-5" />
              <span>Personalizar Meu CRM</span>
            </a>
          </div>
        </div>
      </div>
    </section>
  );
};

export default AdaptableCRMSection;