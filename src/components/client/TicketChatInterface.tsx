
import { useState, useEffect, useRef, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Send, Paperclip, RefreshCw, MessageSquare, Mic, MicOff, Image, Video } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { ticketsService, type ConversationTicket } from "@/services/ticketsService";
import { whatsappService } from "@/services/whatsappMultiClient";
import { useTicketMessages } from "@/hooks/useTicketMessages";
import { useMessageStatus } from "@/hooks/useMessageStatus";
import { useTypingStatus } from "@/hooks/useTypingStatus";
import { useMessageMedia } from "@/hooks/useMessageMedia";
import { audioService } from "@/services/audioService";
import MessageStatus from './MessageStatus';

interface TicketChatInterfaceProps {
  clientId: string;
  ticketId: string;
}

const TicketChatInterface = ({ clientId, ticketId }: TicketChatInterfaceProps) => {
  const { toast } = useToast();
  
  const [selectedTicket, setSelectedTicket] = useState<ConversationTicket | null>(null);
  const [newMessage, setNewMessage] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const mountedRef = useRef(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Hooks para tempo real
  const { messages: ticketMessages, isLoading: loadingMessages } = useTicketMessages(ticketId || null);
  const { getMessageStatus, updateMessageStatus, markMessageAsRead, markMessageAsFailed } = useMessageStatus();
  const { isTyping, startTyping, stopTyping } = useTypingStatus();
  const { 
    isUploading, 
    handleImageUpload, 
    handleVideoUpload, 
    handleDocumentUpload,
    startRecording,
    stopRecording,
    sendAudioRecording,
    audioRecording
  } = useMessageMedia(clientId);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Scroll automático para o final - MELHORADO
  const scrollToBottom = useCallback(() => {
    if (mountedRef.current && messagesEndRef.current) {
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ 
          behavior: "smooth",
          block: "end"
        });
      }, 100);
    }
  }, []);

  // Scroll para o final sempre que mensagens mudarem ou quando selecionar chat
  useEffect(() => {
    scrollToBottom();
  }, [ticketMessages, ticketId, scrollToBottom]);

  useEffect(() => {
    if (ticketId && mountedRef.current) {
      loadTicketDetails();
    }
  }, [ticketId]);

  const loadTicketDetails = async () => {
    try {
      const ticket = await ticketsService.getTicketById(ticketId);
      if (mountedRef.current) {
        setSelectedTicket(ticket);
      }
    } catch (error) {
      console.error('Erro ao carregar detalhes do ticket:', error);
    }
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !selectedTicket || !clientId) return;

    const tempMessageId = `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    try {
      console.log('📤 Enviando mensagem:', newMessage);
      
      updateMessageStatus(tempMessageId, 'sending');
      stopTyping();
      
      await whatsappService.sendMessage(clientId, selectedTicket.chat_id, newMessage);
      
      updateMessageStatus(tempMessageId, 'sent');
      
      await ticketsService.addTicketMessage({
        ticket_id: selectedTicket.id,
        message_id: tempMessageId,
        from_me: true,
        sender_name: "Operador",
        content: newMessage,
        message_type: 'text',
        is_internal_note: false,
        is_ai_response: false,
        processing_status: 'sent',
        timestamp: new Date().toISOString()
      });

      setNewMessage("");
      
      setTimeout(() => {
        updateMessageStatus(tempMessageId, 'delivered');
      }, 2000);
      
      setTimeout(() => {
        markMessageAsRead(tempMessageId);
      }, 5000);
      
      toast({
        title: "Mensagem enviada",
        description: "Sua mensagem foi enviada com sucesso"
      });
    } catch (error: any) {
      updateMessageStatus(tempMessageId, 'failed');
      stopTyping();
      console.error('❌ Erro ao enviar mensagem:', error);
      toast({
        title: "Erro ao enviar",
        description: error.message || "Falha ao enviar mensagem",
        variant: "destructive"
      });
    }
  };

  // Gravação de áudio
  const handleStartRecording = async () => {
    try {
      const recorder = await startRecording();
      if (recorder) {
        setMediaRecorder(recorder);
        setIsRecording(true);
        toast({
          title: "Gravando",
          description: "Gravação de áudio iniciada"
        });
      }
    } catch (error: any) {
      toast({
        title: "Erro",
        description: "Não foi possível iniciar a gravação",
        variant: "destructive"
      });
    }
  };

  const handleStopRecording = () => {
    if (mediaRecorder && isRecording) {
      stopRecording(mediaRecorder);
      setIsRecording(false);
      setMediaRecorder(null);
      toast({
        title: "Gravação finalizada",
        description: "Áudio gravado com sucesso"
      });
    }
  };

  const handleSendAudio = async () => {
    if (!selectedTicket) return;

    try {
      const success = await sendAudioRecording(selectedTicket.chat_id);
      if (success) {
        toast({
          title: "Áudio enviado",
          description: "Mensagem de áudio enviada com sucesso"
        });
      }
    } catch (error: any) {
      toast({
        title: "Erro",
        description: "Falha ao enviar áudio",
        variant: "destructive"
      });
    }
  };

  // Upload de arquivos
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !selectedTicket) return;

    try {
      let success = false;
      
      if (file.type.startsWith('image/')) {
        success = await handleImageUpload(file, selectedTicket.chat_id);
      } else if (file.type.startsWith('video/')) {
        success = await handleVideoUpload(file, selectedTicket.chat_id);
      } else {
        success = await handleDocumentUpload(file, selectedTicket.chat_id);
      }

      if (success) {
        // Registrar no ticket
        await ticketsService.addTicketMessage({
          ticket_id: selectedTicket.id,
          message_id: `media_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          from_me: true,
          sender_name: "Operador",
          content: `[${file.type.startsWith('image/') ? 'Imagem' : file.type.startsWith('video/') ? 'Vídeo' : 'Documento'}] ${file.name}`,
          message_type: file.type.startsWith('image/') ? 'image' : file.type.startsWith('video/') ? 'video' : 'document',
          is_internal_note: false,
          is_ai_response: false,
          processing_status: 'sent',
          timestamp: new Date().toISOString()
        });
      }
    } catch (error) {
      console.error('Erro ao enviar arquivo:', error);
    }

    // Limpar input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString('pt-BR', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  const getDisplayName = (ticket: ConversationTicket) => {
    if (ticket.customer?.name && 
        ticket.customer.name !== `Contato ${ticket.customer.phone}` &&
        !ticket.customer.name.startsWith('Contato ')) {
      return ticket.customer.name;
    }
    
    if (ticket.title && ticket.title.includes('Conversa com ')) {
      const nameFromTitle = ticket.title.replace('Conversa com ', '').trim();
      if (nameFromTitle && 
          !nameFromTitle.startsWith('Contato ') && 
          nameFromTitle !== ticket.customer?.phone) {
        return nameFromTitle;
      }
    }
    
    const phone = ticket.customer?.phone || ticket.chat_id;
    if (phone) {
      const cleanPhone = phone.replace(/\D/g, '');
      if (cleanPhone.length >= 10) {
        const formattedPhone = cleanPhone.replace(/(\d{2})(\d{4,5})(\d{4})/, '($1) $2-$3');
        return formattedPhone;
      }
    }
    
    return 'Contato sem nome';
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden">
      {selectedTicket ? (
        <>
          {/* Input de arquivo oculto */}
          <input
            ref={fileInputRef}
            type="file"
            onChange={handleFileUpload}
            style={{ display: 'none' }}
            accept="image/*,video/*,.pdf,.doc,.docx,.txt"
          />

          {/* Área de Mensagens - com altura fixa calculada e scroll interno */}
          <div className="flex-1 min-h-0 overflow-hidden">
            <ScrollArea className="h-full">
              <div className="p-4 space-y-4">
                {loadingMessages ? (
                  <div className="text-center py-8">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2" />
                    <p className="text-sm text-gray-500">Carregando mensagens...</p>
                  </div>
                ) : ticketMessages.length === 0 ? (
                  <div className="text-center text-gray-500 py-8">
                    <MessageSquare className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                    <p className="text-sm">Nenhuma mensagem nesta conversa</p>
                    <p className="text-xs text-gray-400 mt-1">
                      Inicie a conversa enviando uma mensagem
                    </p>
                  </div>
                ) : (
                  ticketMessages.map((message) => (
                    <div
                      key={message.id}
                      className={`flex ${message.from_me ? 'justify-end' : 'justify-start'}`}
                    >
                      <div className={`max-w-md px-4 py-2 rounded-lg ${
                        message.from_me
                          ? 'bg-blue-500 text-white rounded-br-sm'
                          : 'bg-gray-100 text-gray-900 rounded-bl-sm'
                      }`}>
                        {!message.from_me && message.sender_name && (
                          <p className="text-xs font-medium mb-1 opacity-70">
                            {message.sender_name}
                          </p>
                        )}
                        
                        {/* Renderizar conteúdo baseado no tipo */}
                        {message.message_type === 'image' && (
                          <div className="mb-2">
                            <div className="w-full h-32 bg-gray-200 rounded flex items-center justify-center">
                              <Image className="w-8 h-8 text-gray-400" />
                            </div>
                          </div>
                        )}
                        
                        {message.message_type === 'video' && (
                          <div className="mb-2">
                            <div className="w-full h-32 bg-gray-200 rounded flex items-center justify-center">
                              <Video className="w-8 h-8 text-gray-400" />
                            </div>
                          </div>
                        )}
                        
                        {message.message_type === 'audio' && (
                          <div className="mb-2">
                            <div className="flex items-center space-x-2 p-2 bg-gray-200 rounded">
                              <div className="w-4 h-4 bg-blue-500 rounded-full"></div>
                              <div className="text-xs text-gray-600">Mensagem de áudio</div>
                            </div>
                          </div>
                        )}
                        
                        <p className="text-sm whitespace-pre-wrap break-words">{message.content}</p>
                        
                        {message.from_me && (
                          <MessageStatus 
                            status={getMessageStatus(message.message_id)}
                            timestamp={message.timestamp}
                            fromMe={message.from_me}
                          />
                        )}
                        
                        {message.is_ai_response && (
                          <div className="mt-1">
                            <Badge variant="secondary" className="text-xs">
                              🤖 IA
                            </Badge>
                          </div>
                        )}
                      </div>
                    </div>
                  ))
                )}
                
                <div ref={messagesEndRef} />
              </div>
            </ScrollArea>
          </div>

          {/* Área de Gravação de Áudio */}
          {audioRecording.audioBlob && (
            <div className="p-4 bg-yellow-50 border-t flex-shrink-0">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
                  <span className="text-sm text-gray-600">
                    Áudio gravado ({audioRecording.duration}s)
                  </span>
                </div>
                <div className="flex space-x-2">
                  <Button size="sm" variant="outline" onClick={() => window.location.reload()}>
                    Cancelar
                  </Button>
                  <Button size="sm" onClick={handleSendAudio} disabled={isUploading}>
                    {isUploading ? 'Enviando...' : 'Enviar Áudio'}
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Input de Mensagem - sempre fixo no final */}
          <div className="border-t p-4 flex-shrink-0 bg-white">
            <div className="flex space-x-2">
              {/* Botão de anexo */}
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
              >
                <Paperclip className="w-4 h-4" />
              </Button>

              {/* Botão de gravação */}
              <Button 
                variant="ghost" 
                size="sm"
                onClick={isRecording ? handleStopRecording : handleStartRecording}
                className={isRecording ? 'text-red-500' : ''}
              >
                {isRecording ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              </Button>

              <Input
                placeholder="Digite sua mensagem..."
                value={newMessage}
                onChange={(e) => {
                  setNewMessage(e.target.value);
                  if (e.target.value.trim() && !isTyping) {
                    startTyping();
                  } else if (!e.target.value.trim() && isTyping) {
                    stopTyping();
                  }
                }}
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    handleSendMessage();
                  }
                }}
                onBlur={() => {
                  setTimeout(() => stopTyping(), 1000);
                }}
                className="flex-1"
                disabled={isRecording}
              />
              
              <Button 
                onClick={handleSendMessage} 
                disabled={!newMessage.trim() || isRecording} 
                size="sm"
              >
                <Send className="w-4 h-4" />
              </Button>
            </div>
            
            {/* Indicadores de estado */}
            <div className="mt-2 flex items-center justify-between">
              <div>
                {isTyping && (
                  <div className="text-xs text-gray-500">
                    Digitando...
                  </div>
                )}
                {isRecording && (
                  <div className="text-xs text-red-500 flex items-center space-x-1">
                    <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
                    <span>Gravando áudio...</span>
                  </div>
                )}
              </div>
              
              {isUploading && (
                <div className="text-xs text-blue-500">
                  Enviando arquivo...
                </div>
              )}
            </div>
          </div>
        </>
      ) : (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center text-gray-500">
            <MessageSquare className="w-12 h-12 mx-auto mb-4 text-gray-400" />
            <h3 className="text-lg font-medium mb-2">Carregando conversa...</h3>
            <p className="text-sm">Aguarde enquanto carregamos as mensagens</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default TicketChatInterface;
