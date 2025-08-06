import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar, Clock, CheckCircle, AlertCircle, RefreshCw, Bell } from "lucide-react";

const SmartSchedulingSection = () => {
  const [selectedDate, setSelectedDate] = useState(15);

  const calendarDays = [
    { day: 13, sessions: 2, available: true },
    { day: 14, sessions: 3, available: true },
    { day: 15, sessions: 5, available: false },
    { day: 16, sessions: 1, available: true },
    { day: 17, sessions: 0, available: true },
    { day: 18, sessions: 4, available: true },
    { day: 19, sessions: 0, available: true }
  ];

  const flowSteps = [
    { icon: Calendar, title: "Agenda", description: "Cliente escolhe horário" },
    { icon: RefreshCw, title: "Reagenda", description: "IA reorganiza automaticamente" },
    { icon: Bell, title: "Avisa", description: "Notifica todas as partes" },
    { icon: CheckCircle, title: "Organiza", description: "Atualiza agenda e CRM" }
  ];

  return (
    <section id="agendamentos" className="py-20 px-6 bg-gradient-to-r from-gray-900 to-black">
      <div className="container mx-auto max-w-6xl">
        <div className="text-center mb-16">
          <h2 className="text-5xl font-bold mb-6">
            <span className="bg-gradient-to-r from-purple-400 to-fuchsia-400 bg-clip-text text-transparent">
              📅 Agendamentos Inteligentes
            </span>
          </h2>
          <p className="text-2xl text-gray-300 mb-4">Sua agenda se organiza sozinha</p>
          <p className="text-xl text-purple-200">Do caos para a ordem, sem sua intervenção</p>
        </div>

        <div className="grid lg:grid-cols-2 gap-12 items-start">
          {/* Calendar Mockup */}
          <div className="space-y-6">
            <Card className="bg-gradient-to-br from-purple-900/30 to-fuchsia-900/30 border-purple-500/20">
              <CardHeader>
                <CardTitle className="flex items-center space-x-2 text-white">
                  <Calendar className="w-6 h-6 text-purple-400" />
                  <span>Agenda Inteligente</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-7 gap-2 mb-4">
                  {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(day => (
                    <div key={day} className="text-center text-gray-400 text-sm font-medium py-2">
                      {day}
                    </div>
                  ))}
                </div>
                
                <div className="grid grid-cols-7 gap-2">
                  {calendarDays.map((day, index) => (
                    <div
                      key={index}
                      className={`aspect-square flex flex-col items-center justify-center rounded-lg cursor-pointer transition-all ${
                        selectedDate === day.day
                          ? 'bg-purple-600 text-white'
                          : day.available
                          ? 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                          : 'bg-red-900/30 text-red-400'
                      }`}
                      onClick={() => setSelectedDate(day.day)}
                    >
                      <span className="text-sm font-medium">{day.day}</span>
                      {day.sessions > 0 && (
                        <span className="text-xs">
                          {day.sessions}x
                        </span>
                      )}
                    </div>
                  ))}
                </div>

                <div className="mt-4 p-3 bg-gray-800 rounded-lg">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-300">Google Calendar</span>
                    <CheckCircle className="w-4 h-4 text-green-400" />
                  </div>
                  <p className="text-sm text-gray-400 mt-1">
                    Sincronização automática ativada
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Success Story */}
            <div className="bg-black/40 backdrop-blur-sm rounded-2xl p-6 border border-green-500/20">
              <h3 className="text-lg font-bold text-green-400 mb-3">
                Caso Real: Coach Fitness
              </h3>
              <p className="text-gray-300 mb-3">
                "Agendou 5 sessões de diferentes clientes em 10 minutos, sem minha intervenção."
              </p>
              <div className="flex items-center space-x-2 text-sm text-green-300">
                <CheckCircle className="w-4 h-4" />
                <span>Zero conflitos de horário</span>
              </div>
            </div>
          </div>

          {/* Flow Process */}
          <div className="space-y-6">
            <h3 className="text-2xl font-bold text-white mb-6">
              Fluxo Automático:
            </h3>
            
            <div className="space-y-4">
              {flowSteps.map((step, index) => (
                <div key={index} className="flex items-start space-x-4">
                  <div className="bg-gradient-to-r from-purple-500 to-fuchsia-500 rounded-full p-3 flex-shrink-0">
                    <step.icon className="w-6 h-6 text-white" />
                  </div>
                  <div className="flex-1">
                    <h4 className="text-lg font-semibold text-white mb-2">
                      {step.title}
                    </h4>
                    <p className="text-gray-400">{step.description}</p>
                  </div>
                  {index < flowSteps.length - 1 && (
                    <div className="absolute left-6 mt-12 w-px h-6 bg-gradient-to-b from-purple-500 to-fuchsia-500" />
                  )}
                </div>
              ))}
            </div>

            {/* Integration Highlight */}
            <Card className="bg-gray-800/50 border-gray-700">
              <CardContent className="p-6">
                <h4 className="text-xl font-bold text-white mb-4">
                  Integração Completa
                </h4>
                <div className="space-y-3">
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 bg-blue-600 rounded flex items-center justify-center">
                      <Calendar className="w-4 h-4 text-white" />
                    </div>
                    <span className="text-gray-300">Google Calendar</span>
                    <CheckCircle className="w-4 h-4 text-green-400 ml-auto" />
                  </div>
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 bg-purple-600 rounded flex items-center justify-center">
                      <Clock className="w-4 h-4 text-white" />
                    </div>
                    <span className="text-gray-300">Calendly</span>
                    <CheckCircle className="w-4 h-4 text-green-400 ml-auto" />
                  </div>
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 bg-green-600 rounded flex items-center justify-center">
                      <Bell className="w-4 h-4 text-white" />
                    </div>
                    <span className="text-gray-300">WhatsApp Business</span>
                    <CheckCircle className="w-4 h-4 text-green-400 ml-auto" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Stats Section */}
        <div className="grid md:grid-cols-3 gap-6 mt-16">
          <div className="text-center bg-black/40 backdrop-blur-sm rounded-2xl p-6 border border-purple-500/20">
            <div className="text-4xl font-bold text-purple-400 mb-2">92%</div>
            <p className="text-gray-300">Menos reagendamentos</p>
          </div>
          <div className="text-center bg-black/40 backdrop-blur-sm rounded-2xl p-6 border border-purple-500/20">
            <div className="text-4xl font-bold text-fuchsia-400 mb-2">5h</div>
            <p className="text-gray-300">Economizadas por semana</p>
          </div>
          <div className="text-center bg-black/40 backdrop-blur-sm rounded-2xl p-6 border border-purple-500/20">
            <div className="text-4xl font-bold text-green-400 mb-2">100%</div>
            <p className="text-gray-300">Sincronização automática</p>
          </div>
        </div>
      </div>
    </section>
  );
};

export default SmartSchedulingSection;