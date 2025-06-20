
import { useState, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import { appointmentsService, Appointment } from "@/services/appointmentsService";
import { bookingValidationService, BookingRequest } from "@/services/bookingValidationService";
import { format, addMinutes } from "date-fns";

interface BookingState {
  appointments: Appointment[];
  loading: boolean;
  selectedAppointment: Appointment | null;
  isCreating: boolean;
  isUpdating: boolean;
}

export const useBookingManager = (clientId: string) => {
  const [state, setState] = useState<BookingState>({
    appointments: [],
    loading: false,
    selectedAppointment: null,
    isCreating: false,
    isUpdating: false
  });

  const { toast } = useToast();

  const loadAppointments = useCallback(async (filters?: {
    professionalId?: string;
    customerId?: string;
    startDate?: string;
    endDate?: string;
    status?: 'scheduled' | 'confirmed' | 'cancelled' | 'completed' | 'no_show';
  }) => {
    try {
      setState(prev => ({ ...prev, loading: true }));
      const appointments = await appointmentsService.getAppointments(clientId, filters);
      setState(prev => ({ ...prev, appointments, loading: false }));
    } catch (error) {
      console.error('Erro ao carregar agendamentos:', error);
      toast({
        title: "Erro",
        description: "Falha ao carregar agendamentos",
        variant: "destructive",
      });
      setState(prev => ({ ...prev, loading: false }));
    }
  }, [clientId, toast]);

  const createAppointment = useCallback(async (
    appointmentData: {
      customerId: string;
      professionalId: string;
      serviceId: string;
      appointmentDate: string;
      startTime: string;
      serviceDurationMinutes: number;
      notes?: string;
      price?: number;
    }
  ) => {
    try {
      setState(prev => ({ ...prev, isCreating: true }));

      // Validar agendamento
      const validationRequest: BookingRequest = {
        professionalId: appointmentData.professionalId,
        serviceId: appointmentData.serviceId,
        customerId: appointmentData.customerId,
        appointmentDate: appointmentData.appointmentDate,
        startTime: appointmentData.startTime,
        serviceDurationMinutes: appointmentData.serviceDurationMinutes
      };

      const validation = await bookingValidationService.validateBooking(validationRequest);

      if (!validation.isValid) {
        const errorMessages = validation.errors.map(error => error.message).join(', ');
        toast({
          title: "Agendamento Inválido",
          description: errorMessages,
          variant: "destructive",
        });
        setState(prev => ({ ...prev, isCreating: false }));
        return null;
      }

      // Mostrar avisos se houver
      if (validation.warnings.length > 0) {
        validation.warnings.forEach(warning => {
          toast({
            title: "Atenção",
            description: warning,
            variant: "default",
          });
        });
      }

      // Calcular horário de fim
      const endTime = format(
        addMinutes(
          new Date(`${appointmentData.appointmentDate}T${appointmentData.startTime}`),
          appointmentData.serviceDurationMinutes
        ),
        'HH:mm'
      );

      // Criar agendamento
      const newAppointment = await appointmentsService.createAppointment({
        client_id: clientId,
        customer_id: appointmentData.customerId,
        professional_id: appointmentData.professionalId,
        service_id: appointmentData.serviceId,
        appointment_date: appointmentData.appointmentDate,
        start_time: appointmentData.startTime,
        end_time: endTime,
        status: 'scheduled',
        notes: appointmentData.notes,
        price: appointmentData.price,
        recurrence_type: 'none',
        created_by_assistant: false
      });

      toast({
        title: "Agendamento Criado",
        description: "Agendamento criado com sucesso!",
      });

      // Recarregar agendamentos
      await loadAppointments();
      
      setState(prev => ({ ...prev, isCreating: false }));
      return newAppointment;

    } catch (error) {
      console.error('Erro ao criar agendamento:', error);
      toast({
        title: "Erro",
        description: "Falha ao criar agendamento",
        variant: "destructive",
      });
      setState(prev => ({ ...prev, isCreating: false }));
      return null;
    }
  }, [clientId, toast, loadAppointments]);

  const updateAppointment = useCallback(async (
    appointmentId: string,
    updates: Partial<Appointment>
  ) => {
    try {
      setState(prev => ({ ...prev, isUpdating: true }));

      // Se está atualizando data/hora, validar
      if (updates.appointment_date || updates.start_time) {
        const appointment = state.appointments.find(a => a.id === appointmentId);
        if (appointment) {
          // Buscar duração do serviço para validação
          const serviceDurationMinutes = 60; // Por padrão, buscar do serviço

          const validationRequest: BookingRequest = {
            professionalId: appointment.professional_id,
            serviceId: appointment.service_id,
            customerId: appointment.customer_id,
            appointmentDate: updates.appointment_date || appointment.appointment_date,
            startTime: updates.start_time || appointment.start_time,
            serviceDurationMinutes,
            excludeAppointmentId: appointmentId
          };

          const validation = await bookingValidationService.validateBooking(validationRequest);

          if (!validation.isValid) {
            const errorMessages = validation.errors.map(error => error.message).join(', ');
            toast({
              title: "Atualização Inválida",
              description: errorMessages,
              variant: "destructive",
            });
            setState(prev => ({ ...prev, isUpdating: false }));
            return null;
          }
        }
      }

      const updatedAppointment = await appointmentsService.updateAppointment(appointmentId, updates);

      toast({
        title: "Agendamento Atualizado",
        description: "Agendamento atualizado com sucesso!",
      });

      // Recarregar agendamentos
      await loadAppointments();
      
      setState(prev => ({ ...prev, isUpdating: false }));
      return updatedAppointment;

    } catch (error) {
      console.error('Erro ao atualizar agendamento:', error);
      toast({
        title: "Erro",
        description: "Falha ao atualizar agendamento",
        variant: "destructive",
      });
      setState(prev => ({ ...prev, isUpdating: false }));
      return null;
    }
  }, [state.appointments, toast, loadAppointments]);

  const cancelAppointment = useCallback(async (appointmentId: string, reason?: string) => {
    try {
      await appointmentsService.cancelAppointment(appointmentId, reason);
      
      toast({
        title: "Agendamento Cancelado",
        description: "Agendamento cancelado com sucesso",
      });

      // Recarregar agendamentos
      await loadAppointments();

    } catch (error) {
      console.error('Erro ao cancelar agendamento:', error);
      toast({
        title: "Erro",
        description: "Falha ao cancelar agendamento",
        variant: "destructive",
      });
    }
  }, [toast, loadAppointments]);

  const selectAppointment = useCallback((appointment: Appointment | null) => {
    setState(prev => ({ ...prev, selectedAppointment: appointment }));
  }, []);

  return {
    ...state,
    loadAppointments,
    createAppointment,
    updateAppointment,
    cancelAppointment,
    selectAppointment
  };
};
