import React, { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { TrendingUp, Clock, Users, Zap, DollarSign, Target, BarChart3, ArrowUp } from "lucide-react";

const RealResultsSection = () => {
  const [animatedValues, setAnimatedValues] = useState({
    conversion: 0,
    automation: 0,
    availability: 0,
    growth: 0,
    response: 0,
    satisfaction: 0
  });

  const finalValues = {
    conversion: 300,
    automation: 85,
    availability: 24,
    growth: 5,
    response: 3,
    satisfaction: 97
  };

  const metrics = [
    {
      icon: TrendingUp,
      value: animatedValues.conversion,
      suffix: "%",
      prefix: "+",
      label: "Aumento em Conversões",
      description: "Clientes convertem 3x mais com atendimento humanizado",
      color: "text-green-400",
      bgColor: "border-green-500/20"
    },
    {
      icon: Zap,
      value: animatedValues.automation,
      suffix: "%",
      prefix: "",
      label: "Automação Inteligente",
      description: "Das interações são resolvidas automaticamente",
      color: "text-purple-400",
      bgColor: "border-purple-500/20"
    },
    {
      icon: Clock,
      value: animatedValues.availability,
      suffix: "/7",
      prefix: "",
      label: "Disponibilidade Total",
      description: "Seu negócio nunca para, mesmo quando você para",
      color: "text-blue-400",
      bgColor: "border-blue-500/20"
    },
    {
      icon: BarChart3,
      value: animatedValues.growth,
      suffix: "x",
      prefix: "",
      label: "Crescimento do ROI",
      description: "Retorno sobre investimento multiplicado",
      color: "text-fuchsia-400",
      bgColor: "border-fuchsia-500/20"
    },
    {
      icon: Target,
      value: animatedValues.response,
      suffix: "s",
      prefix: "",
      label: "Tempo de Resposta",
      description: "Resposta instantânea em qualquer momento",
      color: "text-yellow-400",
      bgColor: "border-yellow-500/20"
    },
    {
      icon: Users,
      value: animatedValues.satisfaction,
      suffix: "%",
      prefix: "",
      label: "Satisfação do Cliente",
      description: "Clientes amam o atendimento humanizado",
      color: "text-emerald-400",
      bgColor: "border-emerald-500/20"
    }
  ];

  const testimonials = [
    {
      metric: "Vendas 4x maiores",
      business: "E-commerce de moda",
      quote: "Em 30 dias, nossas vendas quadruplicaram. Os clientes não sabem que é IA."
    },
    {
      metric: "90% menos trabalho manual",
      business: "Consultoria empresarial", 
      quote: "Agora foco em estratégia. A IA cuida de todo o atendimento inicial."
    },
    {
      metric: "200+ leads qualificados/mês",
      business: "Agência de marketing",
      quote: "Transformou nosso WhatsApp numa máquina de prospecção 24h."
    }
  ];

  useEffect(() => {
    const animateValue = (start: number, end: number, duration: number) => {
      const startTime = Date.now();
      const timer = setInterval(() => {
        const elapsedTime = Date.now() - startTime;
        const progress = Math.min(elapsedTime / duration, 1);
        const easeOutQuart = 1 - Math.pow(1 - progress, 4);
        const currentValue = Math.floor(start + (end - start) * easeOutQuart);
        
        setAnimatedValues(prev => ({
          ...prev,
          conversion: Math.min(currentValue * (finalValues.conversion / end), finalValues.conversion),
          automation: Math.min(currentValue * (finalValues.automation / end), finalValues.automation),
          availability: Math.min(currentValue * (finalValues.availability / end), finalValues.availability),
          growth: Math.min(currentValue * (finalValues.growth / end), finalValues.growth),
          response: Math.min(currentValue * (finalValues.response / end), finalValues.response),
          satisfaction: Math.min(currentValue * (finalValues.satisfaction / end), finalValues.satisfaction)
        }));

        if (progress >= 1) {
          clearInterval(timer);
        }
      }, 50);
    };

    // Start animation after a brief delay
    const timer = setTimeout(() => {
      animateValue(0, 100, 3000);
    }, 500);

    return () => clearTimeout(timer);
  }, []);

  return (
    <section className="py-20 px-6 bg-gradient-to-r from-black to-gray-900">
      <div className="container mx-auto max-w-6xl">
        <div className="text-center mb-16">
          <h2 className="text-5xl font-bold mb-6">
            <span className="bg-gradient-to-r from-purple-400 to-fuchsia-400 bg-clip-text text-transparent">
              📈 Resultados que Falam por Si
            </span>
          </h2>
          <p className="text-2xl text-gray-300 mb-4">Números reais de clientes reais</p>
          <p className="text-xl text-purple-200">Métricas que transformam negócios</p>
        </div>

        {/* Animated Metrics Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-16">
          {metrics.map((metric, index) => (
            <Card key={index} className={`bg-black/40 backdrop-blur-sm border ${metric.bgColor} hover:scale-105 transition-all duration-300`}>
              <CardContent className="p-6 text-center">
                <div className="flex justify-center mb-4">
                  <div className="bg-gradient-to-r from-purple-500 to-fuchsia-500 rounded-full p-3">
                    <metric.icon className="w-8 h-8 text-white" />
                  </div>
                </div>
                
                <div className="mb-3">
                  <span className={`text-5xl font-bold ${metric.color}`}>
                    {metric.prefix}{Math.floor(metric.value)}{metric.suffix}
                  </span>
                  {metric.value < finalValues[Object.keys(finalValues)[index] as keyof typeof finalValues] && (
                    <ArrowUp className="inline-block w-6 h-6 text-green-400 ml-2 animate-bounce" />
                  )}
                </div>
                
                <h3 className="text-lg font-semibold text-white mb-2">
                  {metric.label}
                </h3>
                <p className="text-gray-300 text-sm">
                  {metric.description}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Visual Chart Simulation */}
        <div className="mb-16">
          <Card className="bg-gradient-to-br from-purple-900/30 to-fuchsia-900/30 border-purple-500/20">
            <CardContent className="p-8">
              <h3 className="text-2xl font-bold text-white mb-6 text-center">
                Evolução da Performance (30 dias)
              </h3>
              
              {/* Simple bar chart representation */}
              <div className="grid grid-cols-7 gap-2 h-40 items-end">
                {[20, 35, 50, 65, 80, 90, 100].map((height, index) => (
                  <div key={index} className="flex flex-col items-center">
                    <div 
                      className="w-full bg-gradient-to-t from-purple-500 to-fuchsia-500 rounded-t transition-all duration-1000 delay-100"
                      style={{ 
                        height: `${(height * animatedValues.conversion) / 100}%`,
                        minHeight: '10px'
                      }}
                    />
                    <span className="text-xs text-gray-400 mt-2">
                      {index === 0 ? 'Sem. 1' : index === 3 ? 'Sem. 2' : index === 6 ? 'Sem. 4' : ''}
                    </span>
                  </div>
                ))}
              </div>
              
                <div className="text-center mt-4">
                <p className="text-white font-medium">
                  Progressão típica de conversões após implementação do YumerFlow
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Testimonials implícitos */}
        <div className="grid md:grid-cols-3 gap-6 mb-16">
          {testimonials.map((testimonial, index) => (
            <Card key={index} className="bg-gray-800/50 border-gray-700 hover:border-purple-500/40 transition-all duration-300">
              <CardContent className="p-6">
                <div className="text-center mb-4">
                  <div className="text-2xl font-bold text-purple-400 mb-2">
                    {testimonial.metric}
                  </div>
                  <div className="text-sm text-gray-500 uppercase tracking-wide">
                    {testimonial.business}
                  </div>
                </div>
                <blockquote className="text-white text-sm italic text-center">
                  "{testimonial.quote}"
                </blockquote>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Comparison Section */}
        <div className="bg-black/40 backdrop-blur-sm rounded-2xl p-8 border border-purple-500/20">
          <h3 className="text-3xl font-bold text-white text-center mb-8">
            Antes vs. Depois do YumerFlow
          </h3>
          
          <div className="grid md:grid-cols-2 gap-8">
            {/* Antes */}
            <div className="space-y-4">
              <h4 className="text-xl font-semibold text-red-400 mb-4">❌ Atendimento Tradicional</h4>
              {[
                "Horário comercial limitado",
                "Respostas demoradas",
                "Perda de leads noturnos",
                "Atendimento inconsistente",
                "Sobrecarga da equipe"
              ].map((item, index) => (
                <div key={index} className="flex items-center space-x-3">
                  <div className="w-2 h-2 bg-red-400 rounded-full" />
                  <span className="text-gray-300">{item}</span>
                </div>
              ))}
            </div>

            {/* Depois */}
            <div className="space-y-4">
              <h4 className="text-xl font-semibold text-green-400 mb-4">✅ Com YumerFlow</h4>
              {[
                "Disponível 24/7/365",
                "Resposta em 3 segundos",
                "Nunca perde uma oportunidade",
                "Atendimento padronizado e humanizado",
                "Equipe focada em estratégia"
              ].map((item, index) => (
                <div key={index} className="flex items-center space-x-3">
                  <div className="w-2 h-2 bg-green-400 rounded-full" />
                  <span className="text-gray-300">{item}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Final CTA */}
        <div className="text-center mt-16">
          <div className="bg-gradient-to-r from-purple-900/40 to-fuchsia-900/40 backdrop-blur-sm rounded-2xl p-8 border border-purple-500/20">
            <h3 className="text-3xl font-bold text-white mb-4">
              Quer resultados como esses?
            </h3>
            <p className="text-gray-300 mb-6">
              Seus concorrentes já estão usando IA. Não fique para trás.
            </p>
            <a
              href="https://wa.me/554731802324"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center space-x-2 bg-gradient-to-r from-purple-500 to-fuchsia-500 hover:from-purple-600 hover:to-fuchsia-600 text-white px-8 py-4 rounded-full font-bold transition-all transform hover:scale-105"
            >
              <DollarSign className="w-5 h-5" />
              <span>Quero Esses Resultados</span>
            </a>
          </div>
        </div>
      </div>
    </section>
  );
};

export default RealResultsSection;