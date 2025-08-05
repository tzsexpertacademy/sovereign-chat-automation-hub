-- TESTE FINAL: Simular chegada de nova mensagem para ticket fechado
-- Primeiro, fechar o ticket novamente para testar a reabertura automática
UPDATE public.conversation_tickets 
SET 
  status = 'closed',
  closed_at = now(),
  updated_at = now()
WHERE id = 'ff487be2-f85d-42e9-afed-4e18ee11a3b8';

-- Agora chamar a função de upsert para simular nova mensagem
SELECT public.upsert_conversation_ticket(
  '35f36a03-39b2-412c-bba6-01fdd45c2dd3'::uuid,
  '554796451886@s.whatsapp.net',
  '01K11NBE1QB0GVFMME8NA4YPCB',
  'Theo',
  '554796451886',
  'Nova mensagem de teste!',
  now()
);