-- Corrigir a associação do assistente no ticket atual
UPDATE conversation_tickets 
SET assigned_assistant_id = 'fad74a47-c94a-47f9-8e67-26da5083676e'
WHERE id = 'abfb4cab-9823-4c00-ab42-a1640fc3cd96';