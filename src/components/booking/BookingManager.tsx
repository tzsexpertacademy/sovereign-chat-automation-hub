
import React, { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar, Users, Briefcase, Settings, Clock } from "lucide-react";
import AppointmentCalendar from './AppointmentCalendar';
import ProfessionalsManager from './ProfessionalsManager';
import ServicesManager from './ServicesManager';
import BookingSettings from './BookingSettings';
import WorkScheduleManager from './WorkScheduleManager';

interface BookingManagerProps {
  clientId: string;
}

const BookingManager: React.FC<BookingManagerProps> = ({ clientId }) => {
  const [activeTab, setActiveTab] = useState("calendar");

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/30">
      <div className="max-w-7xl mx-auto p-4 lg:p-6 space-y-6">
        {/* Modern Header */}
        <div className="relative overflow-hidden rounded-xl bg-gradient-to-r from-primary/10 via-secondary/5 to-accent/10 p-8 lg:p-12 border border-border/50 backdrop-blur-sm">
          <div className="absolute inset-0 bg-grid-white/[0.02] bg-[size:60px_60px]" />
          <div className="relative text-center space-y-4">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium">
              <Calendar className="h-4 w-4" />
              Sistema de Agendamento
            </div>
            <h1 className="text-4xl lg:text-5xl font-bold bg-gradient-to-r from-primary via-secondary to-accent bg-clip-text text-transparent">
              YumerFlow
            </h1>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              Gerencie agendamentos, profissionais e serviços com integração ao Google Calendar
            </p>
          </div>
        </div>

        {/* Modern Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <div className="overflow-x-auto pb-2">
            <TabsList className="grid w-full grid-cols-5 lg:w-fit lg:grid-cols-5 bg-muted/50 backdrop-blur-sm border border-border/50 min-w-[500px] lg:min-w-0">
              <TabsTrigger 
                value="calendar" 
                className="flex items-center gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground transition-all duration-200"
              >
                <Calendar className="h-4 w-4" />
                <span className="hidden sm:inline">Agenda</span>
              </TabsTrigger>
              <TabsTrigger 
                value="professionals" 
                className="flex items-center gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground transition-all duration-200"
              >
                <Users className="h-4 w-4" />
                <span className="hidden sm:inline">Profissionais</span>
              </TabsTrigger>
              <TabsTrigger 
                value="services" 
                className="flex items-center gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground transition-all duration-200"
              >
                <Briefcase className="h-4 w-4" />
                <span className="hidden sm:inline">Serviços</span>
              </TabsTrigger>
              <TabsTrigger 
                value="schedules" 
                className="flex items-center gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground transition-all duration-200"
              >
                <Clock className="h-4 w-4" />
                <span className="hidden sm:inline">Horários</span>
              </TabsTrigger>
              <TabsTrigger 
                value="settings" 
                className="flex items-center gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground transition-all duration-200"
              >
                <Settings className="h-4 w-4" />
                <span className="hidden sm:inline">Config</span>
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="calendar" className="animate-fade-in">
            <AppointmentCalendar clientId={clientId} />
          </TabsContent>

          <TabsContent value="professionals" className="animate-fade-in">
            <ProfessionalsManager clientId={clientId} />
          </TabsContent>

          <TabsContent value="services" className="animate-fade-in">
            <ServicesManager clientId={clientId} />
          </TabsContent>

          <TabsContent value="schedules" className="animate-fade-in">
            <WorkScheduleManager clientId={clientId} />
          </TabsContent>

          <TabsContent value="settings" className="animate-fade-in">
            <BookingSettings clientId={clientId} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default BookingManager;
