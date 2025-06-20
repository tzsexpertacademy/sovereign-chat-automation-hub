
import React, { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar, Users, Briefcase, Settings, Clock } from "lucide-react";
import AppointmentCalendar from './AppointmentCalendar';
import ProfessionalsManager from './ProfessionalsManager';
import ServicesManager from './ServicesManager';
import BookingSettings from './BookingSettings';

interface BookingManagerProps {
  clientId: string;
}

const BookingManager: React.FC<BookingManagerProps> = ({ clientId }) => {
  const [activeTab, setActiveTab] = useState("calendar");

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold">Sistema de Agendamento</h1>
        <p className="text-muted-foreground">
          Gerencie agendamentos, profissionais e serviços com integração ao Google Calendar
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="calendar" className="flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            Agenda
          </TabsTrigger>
          <TabsTrigger value="professionals" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Profissionais
          </TabsTrigger>
          <TabsTrigger value="services" className="flex items-center gap-2">
            <Briefcase className="h-4 w-4" />
            Serviços
          </TabsTrigger>
          <TabsTrigger value="schedules" className="flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Horários
          </TabsTrigger>
          <TabsTrigger value="settings" className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            Configurações
          </TabsTrigger>
        </TabsList>

        <TabsContent value="calendar" className="mt-6">
          <AppointmentCalendar clientId={clientId} />
        </TabsContent>

        <TabsContent value="professionals" className="mt-6">
          <ProfessionalsManager clientId={clientId} />
        </TabsContent>

        <TabsContent value="services" className="mt-6">
          <ServicesManager clientId={clientId} />
        </TabsContent>

        <TabsContent value="schedules" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Horários de Trabalho</CardTitle>
              <CardDescription>
                Configure os horários de trabalho dos profissionais
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                Em desenvolvimento - Configuração de horários por profissional
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settings" className="mt-6">
          <BookingSettings clientId={clientId} />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default BookingManager;
