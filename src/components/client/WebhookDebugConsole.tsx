import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Webhook, MessageSquare, TestTube, Database } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import unifiedYumerService from '@/services/unifiedYumerService';

interface WebhookDebugConsoleProps {
  instanceId: string;
  clientId: string;
}

export const WebhookDebugConsole: React.FC<WebhookDebugConsoleProps> = ({
  instanceId,
  clientId
}) => {
  const [isRunning, setIsRunning] = useState(false);
  const [debugStatus, setDebugStatus] = useState<{
    webhook: 'unknown' | 'configured' | 'error';
    database: 'unknown' | 'connected' | 'error';
    messages: number;
    tickets: number;
  }>({
    webhook: 'unknown',
    database: 'unknown',
    messages: 0,
    tickets: 0
  });
  const { toast } = useToast();

  const runDebugTests = async () => {
    setIsRunning(true);
    console.log(`🔧 [DEBUG] Iniciando testes para instância: ${instanceId}`);

    try {
      // 1. Verificar webhook
      const webhookResult = await unifiedYumerService.getWebhookConfig(instanceId);
      setDebugStatus(prev => ({
        ...prev,
        webhook: webhookResult.success && webhookResult.data?.enabled ? 'configured' : 'error'
      }));

      // 2. Verificar conexão com banco
      const { supabase } = await import('@/integrations/supabase/client');
      
      // Verificar instância no banco
      const { data: instance, error: instanceError } = await supabase
        .from('whatsapp_instances')
        .select('*')
        .eq('instance_id', instanceId)
        .single();

      if (instanceError) {
        console.error('❌ [DEBUG] Erro ao buscar instância:', instanceError);
        setDebugStatus(prev => ({ ...prev, database: 'error' }));
      } else {
        console.log('✅ [DEBUG] Instância encontrada:', instance);
        setDebugStatus(prev => ({ ...prev, database: 'connected' }));
      }

      // 3. Contar mensagens recentes (últimas 24h)
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      
      const { data: messages, error: messagesError } = await supabase
        .from('whatsapp_messages')
        .select('*')
        .eq('instance_id', instanceId)
        .gte('created_at', yesterday.toISOString());

      if (!messagesError) {
        setDebugStatus(prev => ({ ...prev, messages: messages?.length || 0 }));
        console.log(`📨 [DEBUG] Mensagens encontradas (24h): ${messages?.length || 0}`);
      }

      // 4. Contar tickets
      const { data: tickets, error: ticketsError } = await supabase
        .from('conversation_tickets')
        .select('*')
        .eq('client_id', clientId)
        .eq('instance_id', instanceId);

      if (!ticketsError) {
        setDebugStatus(prev => ({ ...prev, tickets: tickets?.length || 0 }));
        console.log(`🎫 [DEBUG] Tickets encontrados: ${tickets?.length || 0}`);
      }

      // 5. Tentar configurar webhook se necessário
      if (!webhookResult.success || !webhookResult.data?.enabled) {
        console.log('🔧 [DEBUG] Configurando webhook...');
        const configResult = await unifiedYumerService.configureWebhook(instanceId);
        
        if (configResult.success) {
          setDebugStatus(prev => ({ ...prev, webhook: 'configured' }));
          toast({
            title: "🔧 Webhook Configurado",
            description: "Webhook foi configurado durante o teste!"
          });
        } else {
          toast({
            title: "❌ Erro no Webhook", 
            description: `Falha ao configurar webhook: ${configResult.error}`,
            variant: "destructive"
          });
        }
      }

      // 6. Teste de envio de mensagem
      try {
        console.log('📤 [DEBUG] Testando envio de mensagem...');
        const testResult = await unifiedYumerService.sendMessage(instanceId, '5547996451886', '🧪 Teste de envio automático do sistema CRM');
        
        if (testResult.success) {
          toast({
            title: "✅ Teste de Envio",
            description: "Mensagem de teste enviada com sucesso!"
          });
        } else {
          toast({
            title: "❌ Erro no Envio",
            description: `Falha no teste de envio: ${testResult.error}`,
            variant: "destructive"
          });
        }
      } catch (sendError) {
        console.error('❌ [DEBUG] Erro no teste de envio:', sendError);
      }

      toast({
        title: "✅ Testes Concluídos",
        description: "Veja os resultados nos cards acima. Agora envie uma mensagem de teste no WhatsApp!"
      });

    } catch (error) {
      console.error('❌ [DEBUG] Erro nos testes:', error);
      toast({
        title: "❌ Erro nos Testes",
        description: "Verifique o console para mais detalhes",
        variant: "destructive"
      });
    } finally {
      setIsRunning(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'configured':
      case 'connected':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'error':
        return 'bg-red-100 text-red-800 border-red-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TestTube className="h-5 w-5" />
          Debug Console - Webhook
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center">
            <Badge className={getStatusColor(debugStatus.webhook)}>
              <Webhook className="h-3 w-3 mr-1" />
              Webhook
            </Badge>
            <p className="text-xs text-muted-foreground mt-1">
              {debugStatus.webhook === 'configured' ? 'Configurado' : 
               debugStatus.webhook === 'error' ? 'Não configurado' : 'Verificando...'}
            </p>
          </div>

          <div className="text-center">
            <Badge className={getStatusColor(debugStatus.database)}>
              <Database className="h-3 w-3 mr-1" />
              Banco
            </Badge>
            <p className="text-xs text-muted-foreground mt-1">
              {debugStatus.database === 'connected' ? 'Conectado' : 
               debugStatus.database === 'error' ? 'Erro' : 'Verificando...'}
            </p>
          </div>

          <div className="text-center">
            <Badge variant="outline">
              <MessageSquare className="h-3 w-3 mr-1" />
              {debugStatus.messages}
            </Badge>
            <p className="text-xs text-muted-foreground mt-1">Mensagens (24h)</p>
          </div>

          <div className="text-center">
            <Badge variant="outline">
              🎫 {debugStatus.tickets}
            </Badge>
            <p className="text-xs text-muted-foreground mt-1">Tickets</p>
          </div>
        </div>

        <Button 
          onClick={runDebugTests} 
          disabled={isRunning}
          className="w-full"
          variant="outline"
        >
          {isRunning ? 'Executando Testes...' : 'Executar Testes de Debug'}
        </Button>

        <div className="text-xs text-muted-foreground bg-muted p-3 rounded">
          <strong>Como testar:</strong>
          <br />
          1. Clique em "Executar Testes de Debug"
          <br />
          2. Aguarde a configuração do webhook
          <br />
          3. Envie uma mensagem para o WhatsApp da instância conectada
          <br />
          4. Verifique se a mensagem aparece no dashboard em tempo real
        </div>
      </CardContent>
    </Card>
  );
};