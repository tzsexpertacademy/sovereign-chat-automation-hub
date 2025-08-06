
import React, { useState } from 'react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { AppointmentWithDetails } from "@/services/appointmentsService";

interface SimpleCalendarProps {
  appointments: AppointmentWithDetails[];
  onDateSelect?: (date: Date) => void;
  onAppointmentClick?: (appointment: AppointmentWithDetails) => void;
}

const SimpleCalendar: React.FC<SimpleCalendarProps> = ({
  appointments,
  onDateSelect,
  onAppointmentClick,
}) => {
  const [currentDate, setCurrentDate] = useState(new Date());

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });

  const getDayAppointments = (date: Date) => {
    return appointments.filter(appointment => 
      isSameDay(new Date(appointment.appointment_date), date)
    );
  };

  const handlePreviousMonth = () => {
    setCurrentDate(subMonths(currentDate, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(addMonths(currentDate, 1));
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'confirmed': return 'bg-green-500 hover:bg-green-600';
      case 'cancelled': return 'bg-destructive hover:bg-destructive/90';
      case 'completed': return 'bg-muted-foreground hover:bg-muted-foreground/90';
      case 'no_show': return 'bg-yellow-500 hover:bg-yellow-600';
      default: return 'bg-primary hover:bg-primary/90';
    }
  };

  return (
    <Card className="bg-gradient-to-br from-background to-muted/20 border-border/50 backdrop-blur-sm shadow-lg">
      <CardHeader className="bg-gradient-to-r from-primary/5 to-secondary/5 border-b border-border/50">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <CardTitle className="text-xl font-bold capitalize bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
            {format(currentDate, 'MMMM yyyy', { locale: ptBR })}
          </CardTitle>
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handlePreviousMonth}
              className="hover:bg-primary/10 hover:text-primary border-border/50 transition-all duration-200"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleNextMonth}
              className="hover:bg-primary/10 hover:text-primary border-border/50 transition-all duration-200"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-4 lg:p-6">
        {/* Header dos dias */}
        <div className="grid grid-cols-7 gap-1 mb-4">
          {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(day => (
            <div key={day} className="p-2 text-center font-semibold text-sm text-muted-foreground bg-muted/30 rounded-md">
              <span className="hidden sm:inline">{day}</span>
              <span className="sm:hidden">{day.charAt(0)}</span>
            </div>
          ))}
        </div>
        
        {/* Grid do calendário */}
        <div className="grid grid-cols-7 gap-1">
          {days.map(day => {
            const dayAppointments = getDayAppointments(day);
            const isToday = isSameDay(day, new Date());
            
            return (
              <div
                key={day.toString()}
                className={`
                  min-h-[80px] lg:min-h-[100px] p-1 lg:p-2 border border-border/30 cursor-pointer 
                  hover:bg-primary/5 hover:border-primary/20 rounded-lg transition-all duration-200
                  ${isToday ? 'bg-primary/10 border-primary/30 shadow-md' : 'bg-background/50'}
                  ${!isSameMonth(day, currentDate) ? 'opacity-30' : ''}
                `}
                onClick={() => onDateSelect?.(day)}
              >
                <div className={`text-sm font-medium mb-1 ${isToday ? 'text-primary font-bold' : 'text-foreground'}`}>
                  {format(day, 'd')}
                </div>
                <div className="space-y-1">
                  {dayAppointments.slice(0, 3).map(appointment => (
                    <div
                      key={appointment.id}
                      className={`
                        text-xs p-1 rounded-md text-white cursor-pointer transition-all duration-200
                        shadow-sm hover:shadow-md transform hover:scale-105
                        ${getStatusColor(appointment.status)}
                      `}
                      onClick={(e) => {
                        e.stopPropagation();
                        onAppointmentClick?.(appointment);
                      }}
                      title={`${appointment.service.name} - ${appointment.customer.name}`}
                    >
                      {format(new Date(`2000-01-01T${appointment.start_time}`), 'HH:mm')}
                    </div>
                  ))}
                  {dayAppointments.length > 3 && (
                    <div className="text-xs text-muted-foreground bg-muted/50 rounded-md p-1 text-center">
                      +{dayAppointments.length - 3} mais
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
};

export default SimpleCalendar;
