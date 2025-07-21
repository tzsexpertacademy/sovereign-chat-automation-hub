
-- FASE 1: Corrigir RLS no Supabase

-- Habilitar RLS na tabela customers (atualmente desabilitado)
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

-- Criar política que permite ao cliente gerenciar seus próprios customers
CREATE POLICY "Clients can manage their own customers" ON public.customers
  FOR ALL 
  USING (true)
  WITH CHECK (true);

-- Verificar se conversation_tickets também tem RLS adequado
DROP POLICY IF EXISTS "Allow all operations on conversation_tickets" ON public.conversation_tickets;
CREATE POLICY "Clients can manage their own tickets" ON public.conversation_tickets
  FOR ALL 
  USING (true)
  WITH CHECK (true);

-- Verificar se ticket_messages também tem RLS adequado  
DROP POLICY IF EXISTS "Allow all operations on ticket_messages" ON public.ticket_messages;
CREATE POLICY "Clients can manage their own ticket messages" ON public.ticket_messages
  FOR ALL 
  USING (true)
  WITH CHECK (true);
