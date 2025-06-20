
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
      case 'confirmed': return 'bg-green-500';
      case 'cancelled': return 'bg-red-500';
      case 'completed': return 'bg-gray-500';
      case 'no_show': return 'bg-yellow-500';
      default: return 'bg-blue-500';
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>
            {format(currentDate, 'MMMM yyyy', { locale: ptBR })}
          </CardTitle>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handlePreviousMonth}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={handleNextMonth}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-7 gap-1 mb-4">
          {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(day => (
            <div key={day} className="p-2 text-center font-semibold text-sm">
              {day}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {days.map(day => {
            const dayAppointments = getDayAppointments(day);
            const isToday = isSameDay(day, new Date());
            
            return (
              <div
                key={day.toString()}
                className={`
                  min-h-[80px] p-1 border border-gray-200 cursor-pointer hover:bg-gray-50
                  ${isToday ? 'bg-blue-50 border-blue-300' : ''}
                  ${!isSameMonth(day, currentDate) ? 'opacity-30' : ''}
                `}
                onClick={() => onDateSelect?.(day)}
              >
                <div className="text-sm font-medium mb-1">
                  {format(day, 'd')}
                </div>
                <div className="space-y-1">
                  {dayAppointments.slice(0, 3).map(appointment => (
                    <div
                      key={appointment.id}
                      className={`
                        text-xs p-1 rounded text-white cursor-pointer
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
                    <div className="text-xs text-gray-500">
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
