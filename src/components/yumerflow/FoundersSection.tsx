import { Users, Award, Lightbulb } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import foundersImage from "@/assets/founders-team.jpg";

export const FoundersSection = () => {
  const founders = [
    {
      name: "Thalis",
      role: "CEO & Visionário",
      description: "Especialista em IA e automação"
    },
    {
      name: "Deni",
      role: "CTO & Arquiteto",
      description: "Expert em sistemas escaláveis"
    },
    {
      name: "Alan",
      role: "CPO & Estrategista",
      description: "Focado na experiência do usuário"
    }
  ];

  const values = [
    {
      icon: Users,
      title: "Conexão Humana",
      description: "Tecnologia que aproxima, não afasta"
    },
    {
      icon: Award,
      title: "Excelência Técnica",
      description: "Soluções robustas e confiáveis"
    },
    {
      icon: Lightbulb,
      title: "Inovação Constante",
      description: "Sempre um passo à frente do mercado"
    }
  ];

  return (
    <section className="py-20 px-6 bg-card">
      <div className="container mx-auto max-w-6xl">
        {/* Header */}
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 bg-primary/10 border border-primary/20 rounded-full px-4 py-2 mb-6">
            <Users className="w-4 h-4 text-primary" />
            <span className="text-sm font-medium text-primary">Nosso Time</span>
          </div>
          
          <h2 className="text-4xl md:text-5xl font-bold mb-6">
            <span className="bg-[var(--gradient-neon)] bg-clip-text text-transparent">
              Quem Está por Trás
            </span>
            <br />
            <span className="text-foreground">da Revolução do Atendimento</span>
          </h2>
          
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto leading-relaxed">
            Três especialistas unidos por uma missão: <span className="text-primary font-semibold">humanizar a tecnologia</span> 
            e tornar o atendimento extraordinário acessível para todos.
          </p>
        </div>

        {/* Founders Image and Info */}
        <div className="mb-16">
          <div className="relative">
            <div className="relative rounded-2xl overflow-hidden shadow-[var(--shadow-card)] mb-8">
              <img 
                src={foundersImage} 
                alt="Fundadores da Yumer - Thalis, Deni e Alan"
                className="w-full h-auto max-h-96 object-cover"
              />
              <div className="absolute inset-0 bg-[var(--gradient-neon)] opacity-10" />
            </div>
          </div>

          {/* Founders Grid */}
          <div className="grid md:grid-cols-3 gap-6 mb-16">
            {founders.map((founder, index) => (
              <Card key={index} className="bg-[var(--gradient-card)] border-border/50 hover:shadow-[var(--shadow-card)] transition-all duration-300 group">
                <CardContent className="p-6 text-center">
                  <div className="w-16 h-16 bg-[var(--gradient-neon)] rounded-full flex items-center justify-center mx-auto mb-4">
                    <span className="text-white font-bold text-xl">{founder.name[0]}</span>
                  </div>
                  <h3 className="text-xl font-bold mb-1">{founder.name}</h3>
                  <p className="text-primary font-semibold text-sm mb-2">{founder.role}</p>
                  <p className="text-muted-foreground text-sm">{founder.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Company Values */}
        <div className="bg-[var(--gradient-card)] rounded-2xl p-8 border border-border/50">
          <h3 className="text-2xl font-bold mb-8 text-center">Nossos Valores</h3>
          
          <div className="grid md:grid-cols-3 gap-6">
            {values.map((value, index) => (
              <div key={index} className="text-center">
                <div className="w-16 h-16 bg-[var(--gradient-neon)] rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <value.icon className="w-8 h-8 text-white" />
                </div>
                <h4 className="text-lg font-semibold mb-2">{value.title}</h4>
                <p className="text-muted-foreground text-sm">{value.description}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Mission Statement */}
        <div className="text-center mt-16 bg-primary/5 border border-primary/20 rounded-2xl p-8">
          <h3 className="text-2xl font-bold mb-4">Nossa Missão</h3>
          <p className="text-lg text-muted-foreground max-w-3xl mx-auto">
            "Acreditamos que a tecnologia deve amplificar o que há de melhor no ser humano. 
            O YumerFlow não é apenas uma ferramenta — é uma extensão da sua capacidade de 
            <span className="text-primary font-semibold"> se conectar, cuidar e transformar vidas</span> através do atendimento."
          </p>
        </div>
      </div>
    </section>
  );
};