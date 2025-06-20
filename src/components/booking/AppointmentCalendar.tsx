
import React, { useState, useEffect } from 'react';
import { Calendar, dateFnsLocalizer } from 'react-big-calendar';
import { format, parse, startOfWeek, getDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Eye, Edit, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { appointmentsService, type AppointmentWithDetails } from "@/services/appointmentsService";
import 'react-big-calendar/lib/css/react-big-calendar.css';

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek,
  getDay,
  locales: { 'pt-BR': ptBR },
});

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

  const events = appointments.map(appointment => ({
    id: appointment.id,
    title: `${appointment.service.name} - ${appointment.customer.name}`,
    start: new Date(`${appointment.appointment_date}T${appointment.start_time}`),
    end: new Date(`${appointment.appointment_date}T${appointment.end_time}`),
    resource: appointment,
  }));

  const eventStyleGetter = (event: any) => {
    const appointment = event.resource as AppointmentWithDetails;
    let backgroundColor = appointment.service.color;
    
    switch (appointment.status) {
      case 'confirmed':
        backgroundColor = '#22c55e';
        break;
      case 'cancelled':
        backgroundColor = '#ef4444';
        break;
      case 'completed':
        backgroundColor = '#6b7280';
        break;
      case 'no_show':
        backgroundColor = '#f59e0b';
        break;
    }

    return {
      style: {
        backgroundColor,
        borderRadius: '5px',
        opacity: 0.8,
        color: 'white',
        border: '0px',
        display: 'block'
      }
    };
  };

  const handleSelectEvent = (event: any) => {
    if (onEditAppointment) {
      onEditAppointment(event.resource);
    }
  };

  const handleSelectSlot = (slotInfo: any) => {
    if (onCreateAppointment) {
      onCreateAppointment();
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
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Agenda de Atendimentos</CardTitle>
          {onCreateAppointment && (
            <Button onClick={onCreateAppointment}>
              <Plus className="h-4 w-4 mr-2" />
              Novo Agendamento
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div style={{ height: '600px' }}>
          <Calendar
            localizer={localizer}
            events={events}
            startAccessor="start"
            endAccessor="end"
            onSelectEvent={handleSelectEvent}
            onSelectSlot={handleSelectSlot}
            selectable
            eventPropGetter={eventStyleGetter}
            messages={{
              next: "Próximo",
              previous: "Anterior",
              today: "Hoje",
              month: "Mês",
              week: "Semana",
              day: "Dia",
              agenda: "Agenda",
              date: "Data",
              time: "Hora",
              event: "Evento",
              noEventsInRange: "Não há eventos neste período",
              showMore: (total) => `+ ${total} mais`
            }}
            culture="pt-BR"
            onNavigate={(date) => setCurrentDate(date)}
          />
        </div>
      </CardContent>
    </Card>
  );
};

export default AppointmentCalendar;
