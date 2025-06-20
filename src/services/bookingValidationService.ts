
import { addMinutes, isAfter, isBefore, startOfDay, endOfDay, format, parseISO } from "date-fns";
import { appointmentsService } from "./appointmentsService";
import { workScheduleService } from "./workScheduleService";

export interface BookingValidationError {
  type: 'schedule' | 'conflict' | 'availability' | 'business_rules';
  message: string;
  details?: any;
}

export interface BookingValidationResult {
  isValid: boolean;
  errors: BookingValidationError[];
  warnings: string[];
}

export interface BookingRequest {
  professionalId: string;
  serviceId: string;
  customerId: string;
  appointmentDate: string;
  startTime: string;
  serviceDurationMinutes: number;
  excludeAppointmentId?: string;
}

export const bookingValidationService = {
  async validateBooking(request: BookingRequest): Promise<BookingValidationResult> {
    const errors: BookingValidationError[] = [];
    const warnings: string[] = [];

    try {
      // 1. Validar horário de trabalho
      const scheduleValidation = await this.validateWorkSchedule(request);
      if (!scheduleValidation.isValid) {
        errors.push(...scheduleValidation.errors);
      }

      // 2. Validar conflitos de agendamento
      const conflictValidation = await this.validateAppointmentConflicts(request);
      if (!conflictValidation.isValid) {
        errors.push(...conflictValidation.errors);
      }

      // 3. Validar regras de negócio
      const businessValidation = await this.validateBusinessRules(request);
      if (!businessValidation.isValid) {
        errors.push(...businessValidation.errors);
      }
      warnings.push(...businessValidation.warnings);

      return {
        isValid: errors.length === 0,
        errors,
        warnings
      };

    } catch (error) {
      console.error('Erro na validação de agendamento:', error);
      return {
        isValid: false,
        errors: [{
          type: 'schedule',
          message: 'Erro interno na validação do agendamento',
          details: error
        }],
        warnings: []
      };
    }
  },

  async validateWorkSchedule(request: BookingRequest): Promise<BookingValidationResult> {
    const errors: BookingValidationError[] = [];
    
    try {
      const dayOfWeek = new Date(request.appointmentDate).toLocaleDateString('en-US', { weekday: 'lowercase' }) as any;
      const schedules = await workScheduleService.getProfessionalSchedules(request.professionalId);
      const daySchedule = schedules.find(s => s.day_of_week === dayOfWeek && s.is_active);

      if (!daySchedule) {
        errors.push({
          type: 'schedule',
          message: `Profissional não atende neste dia da semana`
        });
        return { isValid: false, errors, warnings: [] };
      }

      const requestStartTime = new Date(`${request.appointmentDate}T${request.startTime}`);
      const requestEndTime = addMinutes(requestStartTime, request.serviceDurationMinutes);
      
      const workStart = new Date(`${request.appointmentDate}T${daySchedule.start_time}`);
      const workEnd = new Date(`${request.appointmentDate}T${daySchedule.end_time}`);

      // Verificar se está dentro do horário de trabalho
      if (isBefore(requestStartTime, workStart) || isAfter(requestEndTime, workEnd)) {
        errors.push({
          type: 'schedule',
          message: `Horário fora do expediente. Horário de trabalho: ${daySchedule.start_time} às ${daySchedule.end_time}`
        });
      }

      // Verificar horário de almoço
      if (daySchedule.break_start_time && daySchedule.break_end_time) {
        const breakStart = new Date(`${request.appointmentDate}T${daySchedule.break_start_time}`);
        const breakEnd = new Date(`${request.appointmentDate}T${daySchedule.break_end_time}`);

        if (
          (isAfter(requestStartTime, breakStart) && isBefore(requestStartTime, breakEnd)) ||
          (isAfter(requestEndTime, breakStart) && isBefore(requestEndTime, breakEnd)) ||
          (isBefore(requestStartTime, breakStart) && isAfter(requestEndTime, breakEnd))
        ) {
          errors.push({
            type: 'schedule',
            message: `Conflito com horário de intervalo: ${daySchedule.break_start_time} às ${daySchedule.break_end_time}`
          });
        }
      }

    } catch (error) {
      errors.push({
        type: 'schedule',
        message: 'Erro ao validar horário de trabalho',
        details: error
      });
    }

    return { isValid: errors.length === 0, errors, warnings: [] };
  },

  async validateAppointmentConflicts(request: BookingRequest): Promise<BookingValidationResult> {
    const errors: BookingValidationError[] = [];

    try {
      const endTime = format(
        addMinutes(new Date(`${request.appointmentDate}T${request.startTime}`), request.serviceDurationMinutes),
        'HH:mm'
      );

      const isAvailable = await appointmentsService.checkAvailability(
        request.professionalId,
        request.appointmentDate,
        request.startTime,
        endTime,
        request.excludeAppointmentId
      );

      if (!isAvailable) {
        errors.push({
          type: 'conflict',
          message: `Já existe um agendamento neste horário`
        });
      }

    } catch (error) {
      errors.push({
        type: 'conflict',
        message: 'Erro ao verificar conflitos de agendamento',
        details: error
      });
    }

    return { isValid: errors.length === 0, errors, warnings: [] };
  },

  async validateBusinessRules(request: BookingRequest): Promise<BookingValidationResult> {
    const errors: BookingValidationError[] = [];
    const warnings: string[] = [];

    try {
      const requestDateTime = new Date(`${request.appointmentDate}T${request.startTime}`);
      const now = new Date();

      // Não permitir agendamento no passado
      if (isBefore(requestDateTime, now)) {
        errors.push({
          type: 'business_rules',
          message: 'Não é possível agendar no passado'
        });
      }

      // Avisar se é agendamento para hoje
      if (format(requestDateTime, 'yyyy-MM-dd') === format(now, 'yyyy-MM-dd')) {
        warnings.push('Agendamento para hoje - verificar disponibilidade com antecedência');
      }

      // Avisar se é agendamento de última hora (menos de 2 horas)
      const twoHoursFromNow = addMinutes(now, 120);
      if (isBefore(requestDateTime, twoHoursFromNow) && isAfter(requestDateTime, now)) {
        warnings.push('Agendamento de última hora - confirmar disponibilidade do profissional');
      }

    } catch (error) {
      errors.push({
        type: 'business_rules',
        message: 'Erro ao validar regras de negócio',
        details: error
      });
    }

    return { isValid: errors.length === 0, errors, warnings };
  },

  async getAvailableSlots(
    professionalId: string,
    serviceId: string,
    date: string,
    serviceDurationMinutes: number = 60
  ): Promise<{ start: string; end: string; available: boolean }[]> {
    try {
      // Usar o endpoint do Supabase para buscar slots disponíveis
      const slots = await appointmentsService.getAvailableTimeSlots(professionalId, serviceId, date);
      
      // Filtrar apenas slots disponíveis que comportem o serviço
      return slots.filter(slot => {
        const slotStart = new Date(`${date}T${slot.start}`);
        const slotEnd = new Date(`${date}T${slot.end}`);
        const serviceDuration = slotEnd.getTime() - slotStart.getTime();
        return slot.available && serviceDuration >= (serviceDurationMinutes * 60 * 1000);
      });

    } catch (error) {
      console.error('Erro ao buscar slots disponíveis:', error);
      return [];
    }
  }
};
