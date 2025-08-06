import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, MessageSquare, Settings, Rocket, CheckCircle, Heart, Headphones, Zap } from "lucide-react";

const HumanSupportSection = () => {
  const supportFeatures = [
    {
      icon: Users,
      title: "Time Dedicado",
      description: "Especialistas que entendem seu negócio pessoalmente",
      color: "text-blue-400"
    },
    {
      icon: MessageSquare,
      title: "Suporte via WhatsApp",
      description: "Tire dúvidas no mesmo canal que seus clientes usam",
      color: "text-green-400"
    },
    {
      icon: Settings,
      title: "Configuração Personalizada",
      description: "Ajustamos tudo para funcionar exatamente como você precisa",
      color: "text-purple-400"
    },
    {
      icon: Rocket,
      title: "Onboarding Guiado",
      description: "Acompanhamento completo até você estar 100% confortável",
      color: "text-fuchsia-400"
    }
  ];

  const onboardingSteps = [
    {
      step: "1",
      title: "Análise do Seu Negócio",
      description: "Conversamos para entender seu processo, clientes e objetivos",
      duration: "30 min"
    },
    {
      step: "2",
      title: "Configuração Personalizada",
      description: "Montamos sua IA com as características únicas do seu atendimento",
      duration: "2-3 dias"
    },
    {
      step: "3",
      title: "Testes e Ajustes",
      description: "Testamos juntos e refinamos até ficar perfeito",
      duration: "1 semana"
    },
    {
      step: "4",
      title: "Acompanhamento Contínuo",
      description: "Monitoramos performance e fazemos otimizações constantes",
      duration: "Sempre"
    }
  ];

  return (
    <section className="py-20 px-6 bg-gradient-to-r from-gray-900 to-black">
      <div className="container mx-auto max-w-6xl">
        <div className="text-center mb-16">
          <h2 className="text-5xl font-bold mb-6">
            <span className="bg-gradient-to-r from-purple-400 to-fuchsia-400 bg-clip-text text-transparent">
              🤝 Mais que Tecnologia: Parceria
            </span>
          </h2>
          <p className="text-2xl text-gray-300 mb-4">Você não compra uma ferramenta. Você ativa um time.</p>
          <p className="text-xl text-purple-200">Sucesso garantido com suporte humano de verdade</p>
        </div>

        <div className="grid lg:grid-cols-2 gap-12 mb-16">
          {/* Support Features */}
          <div className="space-y-6">
            <h3 className="text-2xl font-bold text-white mb-6">
              Suporte que Faz a Diferença:
            </h3>
            
            <div className="space-y-4">
              {supportFeatures.map((feature, index) => (
                <Card key={index} className="bg-gray-800/50 border-gray-700 hover:border-purple-500/40 transition-all duration-300">
                  <CardContent className="p-6">
                    <div className="flex items-start space-x-4">
                      <div className="bg-gradient-to-r from-purple-500 to-fuchsia-500 rounded-full p-3 flex-shrink-0">
                        <feature.icon className="w-6 h-6 text-white" />
                      </div>
                      <div className="flex-1">
                        <h4 className="text-lg font-semibold text-white mb-2">
                          {feature.title}
                        </h4>
                        <p className="text-gray-400">{feature.description}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Support Stats */}
            <div className="grid grid-cols-2 gap-4 mt-8">
              <div className="text-center bg-black/40 backdrop-blur-sm rounded-xl p-4 border border-purple-500/20">
                <div className="text-3xl font-bold text-green-400 mb-1">&lt; 2h</div>
                <p className="text-gray-300 text-sm">Tempo de resposta</p>
              </div>
              <div className="text-center bg-black/40 backdrop-blur-sm rounded-xl p-4 border border-purple-500/20">
                <div className="text-3xl font-bold text-blue-400 mb-1">98%</div>
                <p className="text-gray-300 text-sm">Satisfação no suporte</p>
              </div>
            </div>
          </div>

          {/* Onboarding Process */}
          <div className="space-y-6">
            <h3 className="text-2xl font-bold text-white mb-6">
              Processo de Onboarding:
            </h3>
            
            <div className="space-y-4">
              {onboardingSteps.map((step, index) => (
                <div key={index} className="relative">
                  <div className="flex items-start space-x-4">
                    <div className="bg-gradient-to-r from-purple-500 to-fuchsia-500 rounded-full w-10 h-10 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                      {step.step}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="text-lg font-semibold text-white">
                          {step.title}
                        </h4>
                        <span className="text-xs bg-purple-900/40 text-purple-300 px-2 py-1 rounded">
                          {step.duration}
                        </span>
                      </div>
                      <p className="text-gray-400">{step.description}</p>
                    </div>
                  </div>
                  {index < onboardingSteps.length - 1 && (
                    <div className="absolute left-5 mt-2 w-px h-8 bg-gradient-to-b from-purple-500 to-fuchsia-500" />
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Contact Methods */}
        <div className="grid md:grid-cols-3 gap-6 mb-16">
          <Card className="bg-gradient-to-br from-green-900/30 to-emerald-900/30 border-green-500/20">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2 text-white">
                <MessageSquare className="w-6 h-6 text-green-400" />
                <span>WhatsApp Direto</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-300 mb-4">
                Fale com nossa equipe pelo mesmo canal que você vai usar com seus clientes.
              </p>
              <div className="text-green-400 font-semibold">
                +55 47 3180-2324
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Disponível de seg-sex, 8h às 18h
              </p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-blue-900/30 to-indigo-900/30 border-blue-500/20">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2 text-white">
                <Headphones className="w-6 h-6 text-blue-400" />
                <span>Suporte Técnico</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-300 mb-4">
                Resolvemos qualquer questão técnica rapidamente.
              </p>
              <div className="flex items-center space-x-2 text-blue-400">
                <CheckCircle className="w-4 h-4" />
                <span className="text-sm">Resposta em até 2h</span>
              </div>
              <div className="flex items-center space-x-2 text-blue-400 mt-1">
                <CheckCircle className="w-4 h-4" />
                <span className="text-sm">Acesso remoto quando necessário</span>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-purple-900/30 to-fuchsia-900/30 border-purple-500/20">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2 text-white">
                <Zap className="w-6 h-6 text-purple-400" />
                <span>Consultoria Estratégica</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-300 mb-4">
                Ajudamos você a extrair o máximo potencial da automação.
              </p>
              <div className="text-purple-400 font-semibold">
                Sessões mensais incluídas
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Otimização contínua da performance
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Success Guarantee */}
        <div className="text-center">
          <Card className="bg-gradient-to-r from-purple-900/40 to-fuchsia-900/40 border-purple-500/20 max-w-4xl mx-auto">
            <CardContent className="p-8">
              <div className="flex justify-center mb-6">
                <div className="bg-gradient-to-r from-purple-500 to-fuchsia-500 rounded-full p-4">
                  <Heart className="w-12 h-12 text-white" />
                </div>
              </div>
              
              <h3 className="text-3xl font-bold text-white mb-4">
                Garantia de Sucesso
              </h3>
              <p className="text-xl text-gray-300 mb-6">
                Se em 30 dias você não estiver completamente satisfeito com os resultados,
                <br />
                <span className="text-purple-400 font-semibold">devolvemos 100% do seu investimento.</span>
              </p>
              
              <div className="grid md:grid-cols-3 gap-4 mb-8">
                <div className="flex items-center space-x-2 text-green-400">
                  <CheckCircle className="w-5 h-5" />
                  <span className="text-sm">30 dias de garantia</span>
                </div>
                <div className="flex items-center space-x-2 text-green-400">
                  <CheckCircle className="w-5 h-5" />
                  <span className="text-sm">Suporte ilimitado</span>
                </div>
                <div className="flex items-center space-x-2 text-green-400">
                  <CheckCircle className="w-5 h-5" />
                  <span className="text-sm">Zero risco para você</span>
                </div>
              </div>

              <a
                href="https://wa.me/554731802324"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center space-x-2 bg-gradient-to-r from-purple-500 to-fuchsia-500 hover:from-purple-600 hover:to-fuchsia-600 text-white px-8 py-4 rounded-full font-bold transition-all transform hover:scale-105"
              >
                <MessageSquare className="w-5 h-5" />
                <span>Começar com Suporte Completo</span>
              </a>
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  );
};

export default HumanSupportSection;