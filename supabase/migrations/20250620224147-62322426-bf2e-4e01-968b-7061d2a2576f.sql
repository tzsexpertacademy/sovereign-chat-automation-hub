
-- Criar enum para tipos de status de agendamento
CREATE TYPE appointment_status AS ENUM ('scheduled', 'confirmed', 'cancelled', 'completed', 'no_show');

-- Criar enum para tipos de recorrência
CREATE TYPE recurrence_type AS ENUM ('none', 'daily', 'weekly', 'monthly', 'yearly');

-- Criar enum para dias da semana
CREATE TYPE weekday AS ENUM ('monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday');

-- Tabela de profissionais
CREATE TABLE public.professionals (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    specialty TEXT,
    description TEXT,
    avatar_url TEXT,
    google_calendar_id TEXT,
    timezone TEXT DEFAULT 'America/Sao_Paulo',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela de serviços
CREATE TABLE public.services (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    duration_minutes INTEGER NOT NULL DEFAULT 60,
    price DECIMAL(10,2),
    color TEXT DEFAULT '#3B82F6',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela de relacionamento profissional-serviço
CREATE TABLE public.professional_services (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    professional_id UUID NOT NULL REFERENCES public.professionals(id) ON DELETE CASCADE,
    service_id UUID NOT NULL REFERENCES public.services(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE(professional_id, service_id)
);

-- Tabela de horários de trabalho dos profissionais
CREATE TABLE public.professional_schedules (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    professional_id UUID NOT NULL REFERENCES public.professionals(id) ON DELETE CASCADE,
    day_of_week weekday NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    break_start_time TIME,
    break_end_time TIME,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE(professional_id, day_of_week)
);

-- Tabela de clientes/pacientes
CREATE TABLE public.customers (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    email TEXT,
    phone TEXT NOT NULL,
    whatsapp_chat_id TEXT,
    birth_date DATE,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE(client_id, phone)
);

-- Tabela de agendamentos
CREATE TABLE public.appointments (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
    customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
    professional_id UUID NOT NULL REFERENCES public.professionals(id) ON DELETE CASCADE,
    service_id UUID NOT NULL REFERENCES public.services(id) ON DELETE CASCADE,
    appointment_date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    status appointment_status DEFAULT 'scheduled',
    notes TEXT,
    google_event_id TEXT,
    recurrence_type recurrence_type DEFAULT 'none',
    recurrence_end_date DATE,
    price DECIMAL(10,2),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    created_by_assistant BOOLEAN DEFAULT false
);

-- Tabela de bloqueios de agenda
CREATE TABLE public.schedule_blocks (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    professional_id UUID NOT NULL REFERENCES public.professionals(id) ON DELETE CASCADE,
    start_datetime TIMESTAMP WITH TIME ZONE NOT NULL,
    end_datetime TIMESTAMP WITH TIME ZONE NOT NULL,
    reason TEXT NOT NULL,
    is_recurring BOOLEAN DEFAULT false,
    recurrence_pattern JSONB,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela de configurações de agendamento por cliente
CREATE TABLE public.booking_settings (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE UNIQUE,
    timezone TEXT DEFAULT 'America/Sao_Paulo',
    advance_booking_days INTEGER DEFAULT 30,
    same_day_booking_enabled BOOLEAN DEFAULT true,
    booking_window_start TIME DEFAULT '08:00',
    booking_window_end TIME DEFAULT '18:00',
    google_calendar_integration_enabled BOOLEAN DEFAULT false,
    google_calendar_credentials JSONB,
    auto_confirm_appointments BOOLEAN DEFAULT false,
    send_confirmation_messages BOOLEAN DEFAULT true,
    send_reminder_messages BOOLEAN DEFAULT true,
    reminder_hours_before INTEGER DEFAULT 24,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Índices para performance
CREATE INDEX idx_appointments_professional_date ON public.appointments(professional_id, appointment_date);
CREATE INDEX idx_appointments_customer_date ON public.appointments(customer_id, appointment_date);
CREATE INDEX idx_appointments_status ON public.appointments(status);
CREATE INDEX idx_appointments_google_event ON public.appointments(google_event_id);
CREATE INDEX idx_professional_schedules_day ON public.professional_schedules(day_of_week);
CREATE INDEX idx_schedule_blocks_professional ON public.schedule_blocks(professional_id);
CREATE INDEX idx_customers_phone ON public.customers(phone);
CREATE INDEX idx_customers_whatsapp_chat ON public.customers(whatsapp_chat_id);

-- Triggers para updated_at
CREATE TRIGGER update_professionals_updated_at
    BEFORE UPDATE ON public.professionals
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_services_updated_at
    BEFORE UPDATE ON public.services
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_professional_schedules_updated_at
    BEFORE UPDATE ON public.professional_schedules
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_customers_updated_at
    BEFORE UPDATE ON public.customers
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_appointments_updated_at
    BEFORE UPDATE ON public.appointments
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_schedule_blocks_updated_at
    BEFORE UPDATE ON public.schedule_blocks
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_booking_settings_updated_at
    BEFORE UPDATE ON public.booking_settings
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- Comentários explicativos
COMMENT ON TABLE public.professionals IS 'Profissionais que prestam serviços e podem ter agendamentos';
COMMENT ON TABLE public.services IS 'Serviços disponíveis para agendamento';
COMMENT ON TABLE public.professional_services IS 'Relacionamento entre profissionais e serviços que eles oferecem';
COMMENT ON TABLE public.professional_schedules IS 'Horários de trabalho dos profissionais por dia da semana';
COMMENT ON TABLE public.customers IS 'Clientes/pacientes que fazem agendamentos';
COMMENT ON TABLE public.appointments IS 'Agendamentos realizados';
COMMENT ON TABLE public.schedule_blocks IS 'Bloqueios de agenda (feriados, folgas, etc.)';
COMMENT ON TABLE public.booking_settings IS 'Configurações de agendamento por cliente';

-- Storage bucket para avatars de profissionais se não existir
INSERT INTO storage.buckets (id, name, public) 
VALUES ('professional-avatars', 'professional-avatars', true)
ON CONFLICT (id) DO NOTHING;

-- Política de storage para avatars
CREATE POLICY "Professional avatars are publicly accessible" 
ON storage.objects FOR SELECT 
USING (bucket_id = 'professional-avatars');

CREATE POLICY "Users can upload professional avatars" 
ON storage.objects FOR INSERT 
WITH CHECK (bucket_id = 'professional-avatars');
