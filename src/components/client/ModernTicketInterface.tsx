import React, { useState, useEffect, useRef } from 'react';
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { 
  MessageSquare, 
  Phone, 
  Settings, 
  MoreVertical, 
  Clock, 
  User,
  Bot,
  Wifi,
  WifiOff,
  AlertCircle,
  CheckCircle,
  Loader2,
  Send,
  Mic,
  Paperclip
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useTicketMessages } from '@/hooks/useTicketMessages';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { useTicketData } from './chat/useTicketData';
import { useAudioHandling } from './chat/useAudioHandling';
import { whatsappService } from '@/services/whatsappMultiClient';
import { ticketsService } from '@/services/ticketsService';
import SmartTypingIndicator from './SmartTypingIndicator';
import { humanizedBehaviorService } from '@/services/humanizedBehaviorService';
import { realTimeNotificationService } from '@/services/realTimeNotificationService';

interface ModernTicketInterfaceProps {
  clientId: string;
  ticketId: string;
  onClose?: () => void;
}

interface Message {
  id: string;
  content: string;
  from_me: boolean;
  sender_name: string;
  message_type: string;
  timestamp: string;
  is_ai_response?: boolean;
  processing_status?: string;
}

const ModernTicketInterface: React.FC<ModernTicketInterfaceProps> = ({
  clientId,
  ticketId,
  onClose
}) => {
  const [newMessage, setNewMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [humanizedState, setHumanizedState] = useState({
    isProcessing: false,
    stage: 'ready' as 'reading' | 'thinking' | 'typing' | 'recording' | 'finishing' | 'ready',
    progress: 0,
    estimatedTime: 0
  });
  
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  const { messages, isLoading } = useTicketMessages(ticketId);
  const { toast } = useToast();
  const { markActivity, isOnline } = useOnlineStatus(clientId, true);
  const { ticket, queueInfo, connectedInstance, actualInstanceId } = useTicketData(ticketId, clientId);
  const { handleAudioReady: processAudioReady } = useAudioHandling(ticketId);
  
  // 🚫 REMOVIDO: useRealTimePresence - IA agora controla status online
  // Status online será controlado apenas pela IA durante processamento

  // Auto scroll para mensagens mais recentes
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Inicializar notificações quando ticket carrega
  useEffect(() => {
    if (ticketId) {
      realTimeNotificationService.initialize(clientId);
    }
  }, [ticketId, clientId]);

  // 🚫 REMOVIDO: Ativação automática de status online
  // Status online agora é controlado apenas pela IA

  // Detectar atividade do usuário na interface (simplificado)
  useEffect(() => {
    if (!ticket?.chat_id) return;

    const handleActivity = () => {
      if (connectedInstance) {
        console.log('👤 [ACTIVITY] Atividade detectada - IA controlará presença');
        markActivity();
      }
    };

    // Eventos de atividade
    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'];
    events.forEach(event => {
      document.addEventListener(event, handleActivity, { passive: true });
    });

    return () => {
      events.forEach(event => {
        document.removeEventListener(event, handleActivity);
      });
    };
  }, [ticket?.chat_id, connectedInstance, markActivity]);

  const getDisplayName = (ticket: any) => {
    if (ticket?.customer?.name && 
        ticket.customer.name !== `Contato ${ticket.customer.phone}` &&
        !ticket.customer.name.startsWith('Contato ') &&
        !ticket.customer.name.match(/^\(\d+\)/) &&
        !ticket.customer.name.match(/^\d+$/)) {
      return ticket.customer.name;
    }
    
    const phone = ticket?.customer?.phone || ticket?.chat_id;
    if (phone) {
      const cleanPhone = phone.replace(/\D/g, '');
      if (cleanPhone.length >= 10) {
        return cleanPhone.replace(/(\d{2})(\d{4,5})(\d{4})/, '($1) $2-$3');
      }
    }
    
    return 'Contato sem nome';
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !ticket || !connectedInstance || isSending) {
      return;
    }

    try {
      setIsSending(true);
      const messageId = `manual_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      console.log('📤 [MODERN-TICKET] Enviando mensagem:', {
        instanceId: connectedInstance,
        chatId: ticket.chat_id,
        content: newMessage.substring(0, 50) + '...'
      });

      // 🚫 REMOVIDO: setTyping - IA controlará presença

      // Simular comportamento humanizado antes do envio
      setHumanizedState({
        isProcessing: true,
        stage: 'thinking',
        progress: 10,
        estimatedTime: 3000
      });

      // Enviar mensagem com comportamento humanizado
      const result = await humanizedBehaviorService.sendHumanizedMessage(
        connectedInstance || '',
        ticket.chat_id,
        newMessage
      );

      if (!result.success) {
        console.error('❌ Erro ao enviar mensagem humanizada:', result.error);
        toast({
          title: "❌ Erro no Envio Humanizado", 
          description: result.error || 'Falha ao enviar mensagem',
          variant: "destructive"
        });
      } else {
        console.log(`✅ Mensagem enviada com ${result.chunks} chunks`);
        toast({
          title: "✅ Mensagem Humanizada Enviada",
          description: `Enviado em ${result.chunks} partes com comportamento natural`
        });
      }

      markActivity();

      // Primeiro salvar como "enviando"
      await ticketsService.addTicketMessage({
        ticket_id: ticketId,
        message_id: messageId,
        from_me: true,
        sender_name: 'Atendente',
        content: newMessage,
        message_type: 'text',
        is_internal_note: false,
        is_ai_response: false,
        processing_status: 'sending',
        timestamp: new Date().toISOString()
      });

      const response = await whatsappService.sendTextMessage({
        instanceId: connectedInstance,
        to: ticket.chat_id,
        message: newMessage
      });

      if (response.success) {
        // Atualizar para enviado
        await ticketsService.updateTicketMessage(messageId, {
          processing_status: 'sent',
          message_id: response.messageId || messageId
        });

        // 🚫 REMOVIDO: setOnline - IA controlará presença

        setNewMessage('');
        
        toast({
          title: "✅ Enviada",
          description: "Mensagem processada com sucesso"
        });
      } else {
        // Marcar como falha
        await ticketsService.updateTicketMessage(messageId, {
          processing_status: 'failed'
        });
        throw new Error(response.error || 'Falha no envio');
      }
    } catch (error) {
      console.error('❌ [MODERN-TICKET] Erro no envio:', error);
      
      toast({
        title: "❌ Erro no Envio",
        description: "Falha ao enviar mensagem. Tente novamente.",
        variant: "destructive"
      });
    } finally {
      setIsSending(false);
      setHumanizedState({
        isProcessing: false,
        stage: 'ready',
        progress: 0,
        estimatedTime: 0
      });
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const getStatusBadge = (status: string) => {
    const statusMap = {
      'open': { label: 'Aberto', color: 'bg-green-500', icon: CheckCircle },
      'pending': { label: 'Pendente', color: 'bg-yellow-500', icon: Clock },
      'resolved': { label: 'Resolvido', color: 'bg-blue-500', icon: CheckCircle },
      'closed': { label: 'Fechado', color: 'bg-gray-500', icon: CheckCircle }
    };
    
    const config = statusMap[status as keyof typeof statusMap] || statusMap.open;
    const IconComponent = config.icon;
    
    return (
      <Badge variant="outline" className="flex items-center gap-1">
        <div className={`w-2 h-2 rounded-full ${config.color}`} />
        <IconComponent className="w-3 h-3" />
        {config.label}
      </Badge>
    );
  };

  const getMessageStatus = (message: Message) => {
    if (!message.from_me) return null;
    
    const statusMap = {
      'sending': { icon: Loader2, color: 'text-gray-400', spinning: true },
      'sent': { icon: CheckCircle, color: 'text-blue-500', spinning: false },
      'delivered': { icon: CheckCircle, color: 'text-green-500', spinning: false },
      'read': { icon: CheckCircle, color: 'text-green-600', spinning: false },
      'failed': { icon: AlertCircle, color: 'text-red-500', spinning: false }
    };
    
    const config = statusMap[message.processing_status || 'sent'];
    const IconComponent = config.icon;
    
    return (
      <IconComponent 
        className={`w-3 h-3 ${config.color} ${config.spinning ? 'animate-spin' : ''}`} 
      />
    );
  };

  if (isLoading) {
    return (
      <Card className="h-full flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" />
          <p className="text-muted-foreground">Carregando conversa...</p>
        </div>
      </Card>
    );
  }

  return (
    <Card className="h-full flex flex-col overflow-hidden bg-gradient-to-b from-background to-muted/20">
      {/* Header moderno */}
      <div className="p-4 border-b bg-gradient-to-r from-background to-muted/30 backdrop-blur-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Avatar className="w-10 h-10 border-2 border-primary/20">
              <AvatarImage src={`https://api.dicebear.com/7.x/initials/svg?seed=${getDisplayName(ticket)}`} />
              <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                {getDisplayName(ticket).substring(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            
            <div className="space-y-1">
              <h3 className="font-semibold text-foreground">{getDisplayName(ticket)}</h3>
              
              <div className="flex items-center space-x-2">
                {getStatusBadge(ticket?.status || 'open')}
                
                {connectedInstance ? (
                  <Badge variant="outline" className="flex items-center gap-1 text-green-600">
                    <Wifi className="w-3 h-3" />
                    Conectado
                  </Badge>
                ) : (
                  <Badge variant="outline" className="flex items-center gap-1 text-red-600">
                    <WifiOff className="w-3 h-3" />
                    Desconectado
                  </Badge>
                )}
                
                {queueInfo && (
                  <Badge variant="outline" className="flex items-center gap-1">
                    <Bot className="w-3 h-3" />
                    {queueInfo.name}
                  </Badge>
                )}
              </div>
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            <Button variant="outline" size="sm">
              <Phone className="w-4 h-4" />
            </Button>
            <Button variant="outline" size="sm">
              <Settings className="w-4 h-4" />
            </Button>
            <Button variant="outline" size="sm">
              <MoreVertical className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Área de mensagens */}
      <ScrollArea className="flex-1 p-4" ref={scrollAreaRef}>
        <div className="space-y-4">
          {messages.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>Nenhuma mensagem ainda</p>
              <p className="text-sm">Inicie uma conversa enviando uma mensagem</p>
            </div>
          ) : (
            messages.map((message, index) => (
              <div
                key={message.id}
                className={`flex ${message.from_me ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg shadow-sm ${
                    message.from_me
                      ? 'bg-primary text-primary-foreground ml-12'
                      : 'bg-muted text-foreground mr-12'
                  }`}
                >
                  {!message.from_me && (
                    <div className="flex items-center space-x-2 mb-1">
                      {message.is_ai_response ? (
                        <Bot className="w-3 h-3 text-blue-500" />
                      ) : (
                        <User className="w-3 h-3 text-green-500" />
                      )}
                      <span className="text-xs font-medium">
                        {message.is_ai_response ? '🤖 IA' : message.sender_name}
                      </span>
                    </div>
                  )}
                  
                  <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                  
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-xs opacity-70">
                      {new Date(message.timestamp).toLocaleTimeString('pt-BR', {
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </span>
                    
                    {message.from_me && (
                      <div className="ml-2">
                        {getMessageStatus(message)}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>

      {/* Indicador de digitação inteligente */}
      {(humanizedState.isProcessing || isSending) && (
        <SmartTypingIndicator
          isTyping={humanizedState.stage === 'typing' || isSending}
          isRecording={humanizedState.stage === 'recording'}
          isOnline={isOnline}
          userName="🤖 Assistente IA"
          isAI={true}
          estimatedTime={humanizedState.estimatedTime}
          messageType="text"
          stage={humanizedState.stage}
          progress={humanizedState.progress}
        />
      )}

      <Separator />

      {/* Input de mensagem moderno */}
      <div className="p-4 bg-gradient-to-r from-background to-muted/20">
        <div className="flex items-end space-x-2">
          <div className="flex-1 min-h-[2.5rem] max-h-32 border rounded-lg bg-background/80 backdrop-blur-sm focus-within:ring-2 focus-within:ring-primary/20">
            <textarea
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Digite sua mensagem..."
              className="w-full p-3 bg-transparent border-0 resize-none focus:outline-none placeholder:text-muted-foreground"
              rows={1}
              disabled={isSending || !connectedInstance}
            />
          </div>
          
          <div className="flex space-x-1">
            <Button
              variant="outline"
              size="sm"
              disabled={isSending || !connectedInstance}
              className="h-10 w-10 p-0"
            >
              <Paperclip className="w-4 h-4" />
            </Button>
            
            <Button
              variant="outline"
              size="sm"
              disabled={isSending || !connectedInstance}
              className="h-10 w-10 p-0"
              onMouseDown={() => setIsRecording(true)}
              onMouseUp={() => setIsRecording(false)}
              onMouseLeave={() => setIsRecording(false)}
            >
              <Mic className={`w-4 h-4 ${isRecording ? 'text-red-500' : ''}`} />
            </Button>
            
            <Button
              onClick={handleSendMessage}
              disabled={!newMessage.trim() || isSending || !connectedInstance}
              className="h-10 px-4"
            >
              {isSending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </Button>
          </div>
        </div>
        
        {!connectedInstance && (
          <p className="text-xs text-destructive mt-2 flex items-center">
            <AlertCircle className="w-3 h-3 mr-1" />
            Nenhuma instância WhatsApp conectada
          </p>
        )}
      </div>
    </Card>
  );
};

export default ModernTicketInterface;