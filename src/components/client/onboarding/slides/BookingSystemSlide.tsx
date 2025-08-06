import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowRight, Calendar, Clock, Users, MapPin, CreditCard, Bell } from 'lucide-react';
import { Link } from 'react-router-dom';

interface BookingSystemSlideProps {
  clientId: string;
}

export const BookingSystemSlide: React.FC<BookingSystemSlideProps> = ({ clientId }) => {
  const professionals = [
    {
      name: 'Dr. Silva',
      specialty: 'Cardiologista',
      available: '09:00-17:00',
      booked: 12,
      available_slots: 8,
      color: 'bg-blue-500'
    },
    {
      name: 'Ana Santos',
      specialty: 'Nutricionista',
      available: '08:00-16:00',
      booked: 8,
      available_slots: 12,
      color: 'bg-green-500'
    },
    {
      name: 'João Lima',
      specialty: 'Personal Trainer',
      available: '06:00-20:00',
      booked: 15,
      available_slots: 5,
      color: 'bg-orange-500'
    }
  ];

  const features = [
    {
      icon: Calendar,
      title: 'Integração Google Calendar',
      description: 'Sincronização automática com Google Calendar para evitar conflitos de horários',
      benefits: ['Sync bidirecional', 'Bloqueio automático', 'Notificações integradas']
    },
    {
      icon: Users,
      title: 'Gestão de Profissionais',
      description: 'Cadastre profissionais, serviços e configure disponibilidades personalizadas',
      benefits: ['Múltiplos profissionais', 'Serviços variados', 'Horários flexíveis']
    },
    {
      icon: Bell,
      title: 'Lembretes Automáticos',
      description: 'Sistema de lembretes via WhatsApp para reduzir ausências e reagendamentos',
      benefits: ['Lembretes automáticos', 'Confirmação de presença', 'Reagendamento fácil']
    }
  ];

  const timeSlots = ['09:00', '10:00', '11:00', '14:00', '15:00', '16:00'];
  const currentDay = new Date().getDate();

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-3xl font-bold text-foreground mb-4">
          Sistema de Agendamentos Integrado
        </h1>
        <p className="text-lg text-muted-foreground max-w-3xl mx-auto">
          Configure e gerencie agendamentos automáticos com integração completa ao Google Calendar e notificações via WhatsApp
        </p>
      </div>

      {/* Calendar Preview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Calendar className="h-5 w-5 mr-2" />
            Visualização do Sistema de Agendamentos
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-7 gap-2 mb-6">
            {Array.from({ length: 7 }, (_, i) => (
              <div key={i} className="text-center">
                <div className="text-sm font-medium text-muted-foreground mb-2">
                  {new Date(2024, 0, i + currentDay).toLocaleDateString('pt-BR', { weekday: 'short' })}
                </div>
                <div className={`p-2 rounded-lg border ${i === 2 ? 'bg-primary text-primary-foreground' : 'bg-card'}`}>
                  <div className="text-lg font-bold">
                    {currentDay + i}
                  </div>
                  <div className="text-xs">
                    {i === 2 ? '8 agendados' : `${Math.floor(Math.random() * 10)} agendados`}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="grid md:grid-cols-6 gap-2">
            {timeSlots.map((time, index) => (
              <div key={time} className="p-3 border rounded-lg text-center">
                <div className="font-medium text-foreground">{time}</div>
                <div className={`text-xs mt-1 ${index % 3 === 0 ? 'text-red-500' : index % 2 === 0 ? 'text-green-500' : 'text-muted-foreground'}`}>
                  {index % 3 === 0 ? 'Ocupado' : index % 2 === 0 ? 'Disponível' : 'Bloqueado'}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Professionals Dashboard */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Users className="h-5 w-5 mr-2" />
            Profissionais Cadastrados
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {professionals.map((prof, index) => (
              <div key={index} className="flex items-center justify-between p-4 bg-muted rounded-lg">
                <div className="flex items-center space-x-4">
                  <div className={`w-4 h-4 rounded-full ${prof.color}`} />
                  <div>
                    <h4 className="font-medium text-foreground">{prof.name}</h4>
                    <p className="text-sm text-muted-foreground">{prof.specialty}</p>
                  </div>
                </div>
                
                <div className="flex items-center space-x-6">
                  <div className="text-center">
                    <div className="text-sm font-bold text-foreground">{prof.available}</div>
                    <div className="text-xs text-muted-foreground">Horário</div>
                  </div>
                  <div className="text-center">
                    <div className="text-sm font-bold text-foreground">{prof.booked}</div>
                    <div className="text-xs text-muted-foreground">Agendados</div>
                  </div>
                  <div className="text-center">
                    <div className="text-sm font-bold text-foreground">{prof.available_slots}</div>
                    <div className="text-xs text-muted-foreground">Disponíveis</div>
                  </div>
                  <Badge variant={prof.available_slots > 5 ? 'default' : 'secondary'}>
                    {prof.available_slots > 5 ? 'Disponível' : 'Quase Lotado'}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Features */}
      <div className="grid md:grid-cols-3 gap-6">
        {features.map((feature, index) => (
          <Card key={index} className="h-full hover:shadow-lg transition-shadow">
            <CardHeader className="text-center pb-4">
              <div className="w-16 h-16 mx-auto rounded-full bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center mb-4">
                <feature.icon className="h-8 w-8 text-primary" />
              </div>
              <CardTitle className="text-lg font-semibold">
                {feature.title}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-muted-foreground text-sm">
                {feature.description}
              </p>
              <div className="space-y-2">
                {feature.benefits.map((benefit, benefitIndex) => (
                  <div key={benefitIndex} className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-primary rounded-full" />
                    <span className="text-xs text-muted-foreground">{benefit}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Booking Flow */}
      <Card>
        <CardHeader>
          <CardTitle>Fluxo de Agendamento</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center space-x-4 flex-wrap gap-4">
            <div className="flex items-center space-x-2 bg-blue-500/10 px-4 py-2 rounded-lg">
              <Users className="h-5 w-5 text-blue-500" />
              <span className="font-medium">Cliente Solicita</span>
            </div>
            <ArrowRight className="h-5 w-5 text-muted-foreground" />
            <div className="flex items-center space-x-2 bg-purple-500/10 px-4 py-2 rounded-lg">
              <Calendar className="h-5 w-5 text-purple-500" />
              <span className="font-medium">IA Verifica Agenda</span>
            </div>
            <ArrowRight className="h-5 w-5 text-muted-foreground" />
            <div className="flex items-center space-x-2 bg-orange-500/10 px-4 py-2 rounded-lg">
              <Clock className="h-5 w-5 text-orange-500" />
              <span className="font-medium">Oferece Horários</span>
            </div>
            <ArrowRight className="h-5 w-5 text-muted-foreground" />
            <div className="flex items-center space-x-2 bg-green-500/10 px-4 py-2 rounded-lg">
              <Bell className="h-5 w-5 text-green-500" />
              <span className="font-medium">Confirma & Lembra</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Integration Services */}
      <Card>
        <CardHeader>
          <CardTitle>Integrações Disponíveis</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-4 gap-4">
            <div className="flex items-center space-x-3 p-3 bg-muted rounded-lg">
              <Calendar className="h-8 w-8 text-blue-500" />
              <div>
                <div className="font-medium">Google Calendar</div>
                <div className="text-xs text-muted-foreground">Sync automático</div>
              </div>
            </div>
            <div className="flex items-center space-x-3 p-3 bg-muted rounded-lg">
              <MapPin className="h-8 w-8 text-green-500" />
              <div>
                <div className="font-medium">Google Maps</div>
                <div className="text-xs text-muted-foreground">Localização</div>
              </div>
            </div>
            <div className="flex items-center space-x-3 p-3 bg-muted rounded-lg">
              <CreditCard className="h-8 w-8 text-purple-500" />
              <div>
                <div className="font-medium">Pagamentos</div>
                <div className="text-xs text-muted-foreground">PIX, Cartão</div>
              </div>
            </div>
            <div className="flex items-center space-x-3 p-3 bg-muted rounded-lg">
              <Bell className="h-8 w-8 text-orange-500" />
              <div>
                <div className="font-medium">WhatsApp</div>
                <div className="text-xs text-muted-foreground">Notificações</div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Metrics */}
      <div className="bg-gradient-to-r from-primary/10 to-secondary/10 rounded-lg p-6">
        <h3 className="text-lg font-semibold mb-6 text-center text-foreground">
          Estatísticas de Agendamento
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-primary">94%</div>
            <div className="text-sm text-muted-foreground">Taxa de Comparecimento</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-primary">156</div>
            <div className="text-sm text-muted-foreground">Agendamentos Este Mês</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-primary">2.1min</div>
            <div className="text-sm text-muted-foreground">Tempo Médio de Agendamento</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-primary">5%</div>
            <div className="text-sm text-muted-foreground">Taxa de Cancelamento</div>
          </div>
        </div>
      </div>

      {/* CTA */}
      <div className="text-center">
        <Button asChild size="lg" className="group">
          <Link to={`/client/${clientId}/booking`}>
            <Calendar className="h-5 w-5 mr-2" />
            Configurar Agendamentos
            <ArrowRight className="h-4 w-4 ml-2 group-hover:translate-x-1 transition-transform" />
          </Link>
        </Button>
      </div>

      {/* Tips */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20 rounded-lg p-6">
        <h3 className="text-lg font-semibold mb-3 text-foreground">📅 Dicas de Agendamento:</h3>
        <ul className="space-y-2 text-muted-foreground">
          <li>• Configure buffers entre agendamentos para evitar atrasos</li>
          <li>• Use lembretes 24h e 2h antes do compromisso</li>
          <li>• Permita reagendamentos automáticos para reduzir faltas</li>
          <li>• Integre com sistema de pagamento para garantir compromissos</li>
        </ul>
      </div>
    </div>
  );
};