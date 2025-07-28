/**
 * Painel de Teste para Processamento de Mensagens
 * Para testar se o sistema de AI está funcionando corretamente
 */

import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { aiQueueIntegrationService } from '@/services/aiQueueIntegrationService';
import { 
  TestTube, 
  Send, 
  Loader2, 
  CheckCircle2, 
  XCircle, 
  MessageSquare,
  Bot,
  Phone
} from 'lucide-react';

interface MessageProcessingTestPanelProps {
  clientId: string;
}

export const MessageProcessingTestPanel: React.FC<MessageProcessingTestPanelProps> = ({ 
  clientId 
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [testMessage, setTestMessage] = useState('Olá, gostaria de saber mais sobre seus serviços');
  const [testChatId, setTestChatId] = useState('555199999999@s.whatsapp.net');
  const [results, setResults] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  /**
   * Simular mensagem de teste
   */
  const runMessageTest = async () => {
    if (!testMessage.trim()) {
      setError('Digite uma mensagem de teste');
      return;
    }

    setIsLoading(true);
    setError(null);
    setResults(null);

    try {
      console.log('🧪 [TEST] Iniciando teste de processamento...');

      // 1. Buscar instância conectada
      const { data: instances } = await supabase
        .from('whatsapp_instances')
        .select('*')
        .eq('client_id', clientId)
        .eq('status', 'connected')
        .limit(1);

      if (!instances || instances.length === 0) {
        throw new Error('Nenhuma instância conectada encontrada');
      }

      const instance = instances[0];

      // 2. Buscar conexão de fila ativa
      const { data: connection } = await supabase
        .from('instance_queue_connections')
        .select(`
          *,
          queues:queue_id (
            id,
            name,
            is_active,
            assistants:assistant_id (id, name, is_active)
          )
        `)
        .eq('instance_id', instance.id)
        .eq('is_active', true)
        .maybeSingle();

      if (!connection || !connection.queues?.assistants) {
        throw new Error('Nenhuma fila/assistente ativo encontrado para a instância');
      }

      // 3. Simular criação de ticket
      const phoneNumber = testChatId.replace('@s.whatsapp.net', '').replace('@c.us', '');
      
      const { data: customer, error: customerError } = await supabase
        .from('customers')
        .upsert({
          client_id: clientId,
          name: `Cliente Teste ${phoneNumber.slice(-4)}`,
          phone: phoneNumber,
          whatsapp_chat_id: testChatId
        }, {
          onConflict: 'client_id,phone'
        })
        .select()
        .single();

      if (customerError) throw customerError;

      const { data: ticket, error: ticketError } = await supabase
        .from('conversation_tickets')
        .upsert({
          client_id: clientId,
          customer_id: customer.id,
          chat_id: testChatId,
          instance_id: instance.instance_id,
          title: `Teste: Conversa com ${customer.name}`,
          status: 'open',
          last_message_preview: testMessage,
          last_message_at: new Date().toISOString()
        }, {
          onConflict: 'client_id,chat_id,instance_id'
        })
        .select()
        .single();

      if (ticketError) throw ticketError;

      // 4. Processar com IA
      console.log('🤖 [TEST] Processando com IA...');
      const startTime = Date.now();

      const aiResult = await aiQueueIntegrationService.processIncomingMessage(
        ticket.id,
        testMessage,
        clientId,
        instance.instance_id
      );

      const processingTime = Date.now() - startTime;

      // 5. Salvar mensagem de teste
      await supabase
        .from('ticket_messages')
        .insert({
          ticket_id: ticket.id,
          message_id: `test_${Date.now()}`,
          content: testMessage,
          from_me: false,
          timestamp: new Date().toISOString(),
          sender_name: 'Cliente Teste',
          message_type: 'text'
        });

      setResults({
        success: aiResult.success,
        response: aiResult.response,
        processingTime,
        error: aiResult.error,
        shouldHandoff: aiResult.shouldHandoffToHuman,
        confidence: aiResult.confidence,
        metadata: aiResult.metadata,
        instance: {
          id: instance.instance_id,
          name: instance.custom_name || 'Instância principal'
        },
        queue: {
          id: connection.queues.id,
          name: connection.queues.name
        },
        assistant: {
          id: connection.queues.assistants.id,
          name: connection.queues.assistants.name
        },
        ticket: {
          id: ticket.id,
          customerId: customer.id,
          customerName: customer.name
        }
      });

      console.log('✅ [TEST] Teste concluído:', aiResult);

    } catch (err) {
      console.error('❌ [TEST] Erro no teste:', err);
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center gap-2">
          <TestTube className="h-5 w-5" />
          <CardTitle>Teste de Processamento de IA</CardTitle>
        </div>
        <CardDescription>
          Testar se o assistente de IA está respondendo corretamente
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Formulário de Teste */}
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="test-chat">Chat ID (Telefone)</Label>
            <Input
              id="test-chat"
              value={testChatId}
              onChange={(e) => setTestChatId(e.target.value)}
              placeholder="Ex: 555199999999@s.whatsapp.net"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="test-message">Mensagem de Teste</Label>
            <Textarea
              id="test-message"
              value={testMessage}
              onChange={(e) => setTestMessage(e.target.value)}
              placeholder="Digite uma mensagem para testar o assistente..."
              rows={3}
            />
          </div>

          <Button
            onClick={runMessageTest}
            disabled={isLoading || !testMessage.trim()}
            className="w-full"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Testando...
              </>
            ) : (
              <>
                <Send className="h-4 w-4 mr-2" />
                Executar Teste
              </>
            )}
          </Button>
        </div>

        {/* Erro */}
        {error && (
          <Alert variant="destructive">
            <XCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Resultados */}
        {results && (
          <div className="space-y-4 p-4 bg-muted/50 rounded-lg">
            <div className="flex items-center gap-2">
              {results.success ? (
                <CheckCircle2 className="h-5 w-5 text-green-600" />
              ) : (
                <XCircle className="h-5 w-5 text-red-600" />
              )}
              <h3 className="font-semibold">
                {results.success ? 'Teste Bem-sucedido' : 'Teste Falhou'}
              </h3>
              <Badge variant={results.success ? 'default' : 'destructive'}>
                {results.processingTime}ms
              </Badge>
            </div>

            {/* Detalhes da Configuração */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-blue-600" />
                <span className="font-medium">Instância:</span>
                <span>{results.instance.name}</span>
              </div>
              <div className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-purple-600" />
                <span className="font-medium">Fila:</span>
                <span>{results.queue.name}</span>
              </div>
              <div className="flex items-center gap-2">
                <Bot className="h-4 w-4 text-green-600" />
                <span className="font-medium">Assistente:</span>
                <span>{results.assistant.name}</span>
              </div>
            </div>

            {/* Resposta da IA */}
            {results.success && results.response && (
              <div className="space-y-2">
                <h4 className="font-medium">Resposta da IA:</h4>
                <div className="p-3 bg-background rounded border italic">
                  "{results.response}"
                </div>
              </div>
            )}

            {/* Erro da IA */}
            {!results.success && results.error && (
              <div className="space-y-2">
                <h4 className="font-medium text-red-600">Erro:</h4>
                <div className="p-3 bg-red-50 rounded border text-red-700">
                  {results.error}
                </div>
              </div>
            )}

            {/* Metadata */}
            {results.metadata && (
              <div className="text-xs text-muted-foreground">
                <div>Ticket ID: {results.ticket.id}</div>
                {results.confidence && <div>Confiança: {results.confidence}%</div>}
                {results.shouldHandoff && <div>⚠️ Solicitou transferência para humano</div>}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};