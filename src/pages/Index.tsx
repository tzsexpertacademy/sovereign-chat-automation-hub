
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { MessageSquare, Users, BarChart3, Zap, Shield, Globe } from "lucide-react";
import { useNavigate } from "react-router-dom";

const Index = () => {
  const navigate = useNavigate();

  const features = [
    {
      icon: MessageSquare,
      title: "WhatsApp Multi-Cliente",
      description: "Conexão direta sem APIs terceiras"
    },
    {
      icon: Users,
      title: "Isolamento Total",
      description: "Cada cliente em ambiente blindado"
    },
    {
      icon: BarChart3,
      title: "Analytics IA",
      description: "Análise inteligente de conversas"
    },
    {
      icon: Zap,
      title: "Automação",
      description: "Campanhas e respostas automáticas"
    },
    {
      icon: Shield,
      title: "100% Independente",
      description: "Sem dependências externas"
    },
    {
      icon: Globe,
      title: "SaaS Escalável",
      description: "Infraestrutura própria escalável"
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-blue-50 to-purple-50">
      {/* Header */}
      <header className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-6 py-4 flex justify-between items-center">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-gradient-to-r from-green-500 to-blue-500 rounded-lg flex items-center justify-center">
              <MessageSquare className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-xl font-bold bg-gradient-to-r from-green-600 to-blue-600 bg-clip-text text-transparent">
              YumerFlow
            </h1>
          </div>
          <div className="flex space-x-3">
            <Button 
              variant="outline" 
              onClick={() => navigate('/admin')}
              className="hover:bg-green-50"
            >
              Admin
            </Button>
            <Button 
              onClick={() => navigate('/client/demo')}
              className="bg-gradient-to-r from-green-500 to-blue-500 hover:from-green-600 hover:to-blue-600"
            >
              Demo Cliente
            </Button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="py-20 px-6">
        <div className="container mx-auto text-center max-w-4xl">
          <h2 className="text-5xl font-bold mb-6 bg-gradient-to-r from-gray-900 via-green-600 to-blue-600 bg-clip-text text-transparent">
            YumerFlow - Sistema Completo de Atendimento
          </h2>
          <p className="text-xl text-gray-600 mb-8 leading-relaxed">
            Plataforma SaaS 100% independente com WhatsApp multi-cliente, agendamento inteligente, 
            automação com IA e analytics avançados. Tudo integrado em uma solução completa.
          </p>
          <div className="flex justify-center space-x-4">
            <Button 
              size="lg" 
              onClick={() => navigate('/admin')}
              className="bg-gradient-to-r from-green-500 to-blue-500 hover:from-green-600 hover:to-blue-600 px-8 py-3"
            >
              Acessar Admin
            </Button>
            <Button 
              size="lg" 
              variant="outline" 
              onClick={() => navigate('/client/demo')}
              className="px-8 py-3 border-green-300 text-green-700 hover:bg-green-50"
            >
              Ver Demo
            </Button>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-16 px-6 bg-white/50">
        <div className="container mx-auto max-w-6xl">
          <h3 className="text-3xl font-bold text-center mb-12 text-gray-900">
            Recursos Avançados do YumerFlow
          </h3>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, index) => (
              <Card key={index} className="hover:shadow-lg transition-shadow border-0 bg-white/80 backdrop-blur-sm">
                <CardHeader>
                  <div className="w-12 h-12 bg-gradient-to-r from-green-500 to-blue-500 rounded-lg flex items-center justify-center mb-4">
                    <feature.icon className="w-6 h-6 text-white" />
                  </div>
                  <CardTitle className="text-lg">{feature.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-gray-600">
                    {feature.description}
                  </CardDescription>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-6 bg-gradient-to-r from-green-600 to-blue-600 text-white">
        <div className="container mx-auto text-center max-w-3xl">
          <h3 className="text-3xl font-bold mb-6">
            Pronto para Revolucionar seu Atendimento?
          </h3>
          <p className="text-xl mb-8 opacity-90">
            Experimente o YumerFlow e veja como nossa plataforma completa pode transformar sua comunicação e gestão de clientes
          </p>
          <Button 
            size="lg" 
            onClick={() => navigate('/admin')}
            className="bg-white text-green-600 hover:bg-gray-100 px-8 py-3 font-semibold"
          >
            Começar Agora
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-6 bg-gray-900 text-white">
        <div className="container mx-auto text-center">
          <p className="text-gray-400">
            © 2024 YumerFlow - Sistema Completo de Atendimento e Agendamento
          </p>
        </div>
      </footer>
    </div>
  );
};

export default Index;
