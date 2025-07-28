import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { unifiedMessageService } from '@/services/unifiedMessageService';
import { useToast } from '@/hooks/use-toast';
import { Send, MessageSquare, AlertTriangle, CheckCircle } from 'lucide-react';

export function ManualMessageTester() {
  const [instanceId, setInstanceId] = useState('35f36a03-39b2-412c-bba6-01fdd45c2dd3'); // Client ID padrão
  const [chatId, setChatId] = useState('556199999999@s.whatsapp.net');
  const [message, setMessage] = useState('🧪 Teste do serviço unificado de mensagens - funcionando!');
  const [isSending, setIsSending] = useState(false);
  const [lastResult, setLastResult] = useState<any>(null);
  const { toast } = useToast();

  const handleSendManual = async () => {
    if (!instanceId.trim() || !chatId.trim() || !message.trim()) {
      toast({
        title: "❌ Campos Obrigatórios",
        description: "Preencha todos os campos antes de enviar",
        variant: "destructive"
      });
      return;
    }

    setIsSending(true);
    
    try {
      console.log('🧪 [MANUAL-TESTER] Enviando mensagem manual via serviço unificado...');
      
      const result = await unifiedMessageService.sendManualMessage(
        instanceId,
        chatId,
        message,
        instanceId // Usando o mesmo ID como clientId para teste
      );
      
      setLastResult(result);
      
      if (result.success) {
        toast({
          title: "✅ Mensagem Enviada!",
          description: `Mensagem enviada com sucesso. ID: ${result.messageId}`,
        });
        
        console.log('✅ [MANUAL-TESTER] Sucesso:', result);
      } else {
        throw new Error(result.error || 'Erro desconhecido no envio');
      }
    } catch (error: any) {
      console.error('❌ [MANUAL-TESTER] Erro:', error);
      setLastResult({ success: false, error: error.message });
      
      toast({
        title: "❌ Erro no Envio",
        description: error.message || 'Erro ao enviar mensagem',
        variant: "destructive"
      });
    } finally {
      setIsSending(false);
    }
  };

  const handleSendAI = async () => {
    if (!instanceId.trim() || !chatId.trim() || !message.trim()) {
      toast({
        title: "❌ Campos Obrigatórios",
        description: "Preencha todos os campos antes de enviar",
        variant: "destructive"
      });
      return;
    }

    setIsSending(true);
    
    try {
      console.log('🧪 [AI-TESTER] Enviando mensagem AI via serviço unificado...');
      
      const result = await unifiedMessageService.sendAIMessage(
        instanceId,
        chatId,
        message,
        instanceId // Usando o mesmo ID como clientId para teste
      );
      
      setLastResult(result);
      
      if (result.success) {
        toast({
          title: "✅ Mensagem AI Enviada!",
          description: `Mensagem AI enviada com sucesso. ID: ${result.messageId}`,
        });
        
        console.log('✅ [AI-TESTER] Sucesso:', result);
      } else {
        throw new Error(result.error || 'Erro desconhecido no envio AI');
      }
    } catch (error: any) {
      console.error('❌ [AI-TESTER] Erro:', error);
      setLastResult({ success: false, error: error.message });
      
      toast({
        title: "❌ Erro no Envio AI",
        description: error.message || 'Erro ao enviar mensagem AI',
        variant: "destructive"
      });
    } finally {
      setIsSending(false);
    }
  };

  return (
    <Card className="w-full max-w-3xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5" />
          Testador Manual de Mensagens - Serviço Unificado
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Teste o serviço unificado com envio manual e AI
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        
        {/* Campos de Input */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium">Instance ID (Client ID):</label>
            <Input
              value={instanceId}
              onChange={(e) => setInstanceId(e.target.value)}
              placeholder="35f36a03-39b2-412c-bba6-01fdd45c2dd3"
              className="font-mono text-sm"
            />
          </div>
          
          <div>
            <label className="text-sm font-medium">Chat ID:</label>
            <Input
              value={chatId}
              onChange={(e) => setChatId(e.target.value)}
              placeholder="556199999999@s.whatsapp.net"
              className="font-mono text-sm"
            />
          </div>
        </div>

        <div>
          <label className="text-sm font-medium">Mensagem:</label>
          <Textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Digite sua mensagem de teste aqui..."
            rows={3}
          />
        </div>

        {/* Botões de Envio */}
        <div className="flex gap-2">
          <Button 
            onClick={handleSendManual}
            disabled={isSending}
            className="flex-1"
            variant="default"
          >
            {isSending ? (
              <>
                <Send className="h-4 w-4 mr-2 animate-pulse" />
                Enviando...
              </>
            ) : (
              <>
                <Send className="h-4 w-4 mr-2" />
                Enviar Manual
              </>
            )}
          </Button>

          <Button 
            onClick={handleSendAI}
            disabled={isSending}
            className="flex-1"
            variant="secondary"
          >
            {isSending ? (
              <>
                <Send className="h-4 w-4 mr-2 animate-pulse" />
                Enviando AI...
              </>
            ) : (
              <>
                <Send className="h-4 w-4 mr-2" />
                Enviar como AI
              </>
            )}
          </Button>
        </div>

        {/* Resultado */}
        {lastResult && (
          <div className={`p-4 rounded-lg border ${
            lastResult.success 
              ? 'bg-green-50 border-green-200' 
              : 'bg-red-50 border-red-200'
          }`}>
            <div className="flex items-center gap-2 mb-2">
              {lastResult.success ? (
                <Badge variant="outline" className="text-green-700 border-green-300">
                  <CheckCircle className="h-3 w-3 mr-1" />
                  Sucesso
                </Badge>
              ) : (
                <Badge variant="outline" className="text-red-700 border-red-300">
                  <AlertTriangle className="h-3 w-3 mr-1" />
                  Erro
                </Badge>
              )}
              <span className="text-xs text-muted-foreground">
                {new Date(lastResult.timestamp).toLocaleTimeString()}
              </span>
            </div>
            
            {lastResult.success ? (
              <div className="space-y-2 text-sm">
                <p><strong>Message ID:</strong> {lastResult.messageId}</p>
                <p><strong>Timestamp:</strong> {new Date(lastResult.timestamp).toLocaleString()}</p>
                <p className="text-green-700">✅ Mensagem enviada via serviço unificado!</p>
                {lastResult.details && (
                  <details className="text-xs">
                    <summary className="cursor-pointer">Ver detalhes</summary>
                    <pre className="mt-2 bg-green-100 p-2 rounded overflow-auto">
                      {JSON.stringify(lastResult.details, null, 2)}
                    </pre>
                  </details>
                )}
              </div>
            ) : (
              <div className="space-y-2 text-sm">
                <p className="text-red-700">
                  <strong>Erro:</strong> {lastResult.error}
                </p>
                {lastResult.details && (
                  <details className="text-xs">
                    <summary className="cursor-pointer">Ver detalhes do erro</summary>
                    <pre className="mt-2 bg-red-100 p-2 rounded overflow-auto">
                      {JSON.stringify(lastResult.details, null, 2)}
                    </pre>
                  </details>
                )}
              </div>
            )}
          </div>
        )}

        {/* Instruções */}
        <div className="flex items-start gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <AlertTriangle className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
          <div className="text-sm text-blue-800">
            <strong>Como usar:</strong>
            <ul className="mt-1 space-y-1 ml-4 list-disc">
              <li><strong>Enviar Manual:</strong> Simula envio feito pelo usuário manualmente</li>
              <li><strong>Enviar como AI:</strong> Simula envio feito pela IA (com configurações humanizadas)</li>
              <li>Ambos usam o mesmo serviço unificado para garantir consistência</li>
              <li>O teste ajuda a validar se as correções funcionaram</li>
            </ul>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}