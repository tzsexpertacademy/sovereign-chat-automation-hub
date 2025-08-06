
import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { appointmentsService, type AppointmentWithDetails } from "@/services/appointmentsService";
import SimpleCalendar from './SimpleCalendar';

interface AppointmentCalendarProps {
  clientId: string;
  professionalId?: string;
  onCreateAppointment?: () => void;
  onEditAppointment?: (appointment: AppointmentWithDetails) => void;
}

const AppointmentCalendar: React.FC<AppointmentCalendarProps> = ({
  clientId,
  professionalId,
  onCreateAppointment,
  onEditAppointment,
}) => {
  const [appointments, setAppointments] = useState<AppointmentWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentDate, setCurrentDate] = useState(new Date());
  const { toast } = useToast();

  useEffect(() => {
    loadAppointments();
  }, [clientId, professionalId, currentDate]);

  const loadAppointments = async () => {
    try {
      setLoading(true);
      const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
      const endOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);

      const data = await appointmentsService.getAppointments(clientId, {
        professionalId,
        startDate: format(startOfMonth, 'yyyy-MM-dd'),
        endDate: format(endOfMonth, 'yyyy-MM-dd'),
      });

      setAppointments(data);
    } catch (error) {
      console.error('Erro ao carregar agendamentos:', error);
      toast({
        title: "Erro",
        description: "Erro ao carregar agendamentos",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDateSelect = (date: Date) => {
    setCurrentDate(date);
    if (onCreateAppointment) {
      onCreateAppointment();
    }
  };

  const handleAppointmentClick = (appointment: AppointmentWithDetails) => {
    if (onEditAppointment) {
      onEditAppointment(appointment);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Card with Metrics */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 lg:gap-6">
        <Card className="lg:col-span-3 bg-gradient-to-r from-primary/5 to-secondary/5 border-border/50 backdrop-blur-sm">
          <CardHeader>
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div>
                <CardTitle className="text-2xl bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
                  Agenda de Atendimentos
                </CardTitle>
                <p className="text-muted-foreground mt-1">
                  Visualize e gerencie seus agendamentos
                </p>
              </div>
              {onCreateAppointment && (
                <Button 
                  onClick={onCreateAppointment}
                  className="bg-gradient-to-r from-primary to-secondary hover:from-primary/90 hover:to-secondary/90 transition-all duration-200 shadow-lg hover:shadow-xl"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Novo Agendamento
                </Button>
              )}
            </div>
          </CardHeader>
        </Card>
        
        {/* Quick Stats */}
        <Card className="bg-gradient-to-br from-accent/10 to-accent/5 border-border/50">
          <CardContent className="p-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-accent">
                {appointments.length}
              </div>
              <div className="text-sm text-muted-foreground">
                Agendamentos
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
      
      {/* Calendar */}
      <SimpleCalendar
        appointments={appointments}
        onDateSelect={handleDateSelect}
        onAppointmentClick={handleAppointmentClick}
      />
    </div>
  );
};

export default AppointmentCalendar;
