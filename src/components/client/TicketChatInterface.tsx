import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { 
  Send, 
  Paperclip, 
  Phone, 
  User, 
  Clock, 
  MessageCircle, 
  FileText,
  Image as ImageIcon,
  Video,
  Music,
  FileIcon,
  Download,
  ExternalLink,
  CheckCircle,
  AlertCircle,
  Loader2
} from 'lucide-react';
import { useParams } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { ticketsService, type ConversationTicket, type TicketMessage } from '@/services/ticketsService';
import { useTicketMessages } from '@/hooks/useTicketMessages';
import { usePresenceManager } from '@/hooks/usePresenceManager';
import { useHumanizedTyping } from '@/hooks/useHumanizedTyping';
import { useMessageStatus } from '@/hooks/useMessageStatus';
import whatsappService from '@/services/whatsappMultiClient';
import { whatsappInstancesService, type WhatsAppInstanceData } from '@/services/whatsappInstancesService';

interface TicketChatInterfaceProps {
  clientId?: string;
  ticketId?: string;
}

const TicketChatInterface = ({ clientId, ticketId }: TicketChatInterfaceProps) => {
  const params = useParams();
  const finalClientId = clientId || params.clientId;
  const finalTicketId = ticketId || params.ticketId;
  
  const { toast } = useToast();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  
  const [ticket, setTicket] = useState<ConversationTicket | null>(null);
  const [newMessage, setNewMessage] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [instances, setInstances] = useState<WhatsAppInstanceData[]>([]);
  const [showFilePreview, setShowFilePreview] = useState(false);

  // Hooks para funcionalidades avançadas
  const { messages, isLoading: messagesLoading, reloadMessages } = useTicketMessages(finalTicketId!);
  const { updatePresence, startTyping, stopTyping } = usePresenceManager(finalClientId!);
  const { showTypingIndicator, simulateTyping } = useHumanizedTyping();
  const { trackMessageStatus, getMessageStatus } = useMessageStatus();

  // Carregar dados do ticket e instâncias
  useEffect(() => {
    if (finalTicketId && finalClientId) {
      loadTicketData();
      loadInstances();
    }
  }, [finalTicketId, finalClientId]);

  // Auto-scroll para última mensagem
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  const loadTicketData = async () => {
    try {
      setLoading(true);
      console.log('📋 Carregando dados do ticket:', finalTicketId);
      
      const ticketData = await ticketsService.getTicketById(finalTicketId!);
      setTicket(ticketData);
      
      console.log('✅ Ticket carregado:', {
        id: ticketData.id,
        chatId: ticketData.chat_id,
        instanceId: ticketData.instance_id,
        customerPhone: ticketData.customer?.phone
      });
    } catch (error) {
      console.error('❌ Erro ao carregar ticket:', error);
      toast({
        title: "Erro",
        description: "Falha ao carregar dados da conversa",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const loadInstances = async () => {
    try {
      console.log('🔍 Carregando instâncias para cliente:', finalClientId);
      const instancesData = await whatsappInstancesService.getInstancesByClientId(finalClientId!);
      setInstances(instancesData);
      
      console.log('✅ Instâncias carregadas:', {
        total: instancesData.length,
        connected: instancesData.filter(i => i.status === 'connected').length,
        instances: instancesData.map(i => ({
          id: i.instance_id,
          status: i.status,
          phone: i.phone_number
        }))
      });
    } catch (error) {
      console.error('❌ Erro ao carregar instâncias:', error);
    }
  };

  // Função para extrair número do telefone de forma mais robusta
  const extractPhoneNumber = useCallback((chatId: string, customerPhone?: string): string => {
    console.log('📱 Extraindo número do telefone:', { chatId, customerPhone });
    
    // Priorizar customerPhone se disponível e válido
    if (customerPhone) {
      const cleanPhone = customerPhone.replace(/[^\d]/g, '');
      if (cleanPhone.length >= 10) {
        console.log('✅ Usando customerPhone limpo:', cleanPhone);
        return cleanPhone;
      }
    }
    
    // Extrair do chatId como fallback
    if (chatId) {
      // Remover sufixos do WhatsApp
      const cleanChatId = chatId.replace(/@c\.us|@g\.us/g, '');
      const numbersOnly = cleanChatId.replace(/[^\d]/g, '');
      
      if (numbersOnly.length >= 10) {
        console.log('✅ Extraído do chatId:', numbersOnly);
        return numbersOnly;
      }
    }
    
    console.warn('⚠️ Não foi possível extrair número válido');
    throw new Error('Número de telefone inválido');
  }, []);

  const handleSendMessage = async () => {
    if ((!newMessage.trim() && !selectedFile) || sending || !ticket) {
      return;
    }

    try {
      setSending(true);
      
      console.log('📤 Iniciando envio de mensagem:', {
        ticketId: ticket.id,
        chatId: ticket.chat_id,
        instanceId: ticket.instance_id,
        customerPhone: ticket.customer?.phone,
        messageLength: newMessage.length,
        hasFile: !!selectedFile
      });

      // Extrair número do telefone de forma segura
      const phoneNumber = extractPhoneNumber(ticket.chat_id, ticket.customer?.phone);
      
      // Buscar instância conectada específica do ticket
      let connectedInstance = instances.find(inst => 
        inst.status === 'connected' && inst.instance_id === ticket.instance_id
      );

      // Se não encontrar a instância específica, buscar qualquer conectada
      if (!connectedInstance) {
        connectedInstance = instances.find(inst => inst.status === 'connected');
      }

      if (!connectedInstance) {
        throw new Error('Nenhuma instância WhatsApp conectada encontrada. Conecte uma instância primeiro.');
      }

      console.log('📡 Usando instância:', {
        instanceId: connectedInstance.instance_id,
        status: connectedInstance.status,
        phone: connectedInstance.phone_number
      });

      // Mostrar indicador de digitação
      if (newMessage.trim()) {
        simulateTyping(phoneNumber, newMessage.length);
      }

      let response;
      
      if (selectedFile) {
        // Enviar arquivo
        console.log('📎 Enviando arquivo:', {
          fileName: selectedFile.name,
          fileSize: selectedFile.size,
          fileType: selectedFile.type
        });
        
        response = await whatsappService.sendMessage(
          connectedInstance.instance_id,
          phoneNumber,
          newMessage.trim(),
          undefined,
          selectedFile
        );
      } else {
        // Enviar mensagem de texto
        console.log('💬 Enviando mensagem de texto:', newMessage.substring(0, 100));
        
        response = await whatsappService.sendMessage(
          connectedInstance.instance_id,
          phoneNumber,
          newMessage.trim()
        );
      }

      console.log('📤 Resposta do envio:', response);

      if (response.success) {
        // Salvar mensagem no banco
        const messageData = {
          message_id: response.messageId || `msg_${Date.now()}`,
          content: newMessage.trim(),
          from_me: true,
          timestamp: new Date().toISOString(),
          message_type: selectedFile ? 'media' : 'text',
          media_url: selectedFile ? response.mediaUrl : null
        };

        console.log('💾 Salvando mensagem no banco:', messageData);

        await ticketsService.addMessageToTicket(ticket.id, messageData);

        // Rastrear status da mensagem
        if (response.messageId) {
          trackMessageStatus(response.messageId, 'sent');
        }

        // Limpar formulário
        setNewMessage('');
        setSelectedFile(null);
        setShowFilePreview(false);

        // Recarregar mensagens
        await reloadMessages();

        toast({
          title: "Mensagem Enviada",
          description: selectedFile ? "Arquivo enviado com sucesso" : "Mensagem enviada com sucesso",
        });

        // Focar no textarea
        if (textareaRef.current) {
          textareaRef.current.focus();
        }
      } else {
        throw new Error(response.error || 'Falha no envio da mensagem');
      }
    } catch (error: any) {
      console.error('❌ Erro ao enviar mensagem:', error);
      
      let errorMessage = 'Falha ao enviar mensagem';
      
      if (error.message.includes('Número de telefone inválido')) {
        errorMessage = 'Número de telefone inválido. Verifique os dados do cliente.';
      } else if (error.message.includes('não está conectado')) {
        errorMessage = 'WhatsApp não está conectado. Verifique a conexão na aba "Conexão".';
      } else if (error.message.includes('timeout')) {
        errorMessage = 'Timeout ao enviar mensagem. Tente novamente.';
      } else if (error.message.includes('Nenhuma instância')) {
        errorMessage = 'Nenhuma instância WhatsApp conectada. Conecte uma instância primeiro.';
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      toast({
        title: "Erro ao Enviar",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setSending(false);
      stopTyping();
    }
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.size > 16 * 1024 * 1024) {
        toast({
          title: "Arquivo muito grande",
          description: "O arquivo deve ter no máximo 16MB",
          variant: "destructive",
        });
        return;
      }

      setSelectedFile(file);
      setShowFilePreview(true);
    }
  };

  const removeFile = () => {
    setSelectedFile(null);
    setShowFilePreview(false);
  };

  const getFileIcon = (fileType: string) => {
    if (fileType.startsWith('image/')) return <ImageIcon className="w-4 h-4" />;
    if (fileType.startsWith('video/')) return <Video className="w-4 h-4" />;
    if (fileType.startsWith('audio/')) return <Music className="w-4 h-4" />;
    return <FileIcon className="w-4 h-4" />;
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2" />
          <p className="text-muted-foreground">Carregando conversa...</p>
        </div>
      </div>
    );
  }

  if (!ticket) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Conversa não encontrada</h3>
          <p className="text-gray-600">
            A conversa solicitada não foi encontrada ou foi removida.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full max-h-[calc(100vh-120px)]">
      {/* Header da conversa */}
      <Card className="flex-shrink-0">
        <CardHeader className="pb-3">
          <div className="flex justify-between items-start">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                <User className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <CardTitle className="text-lg">{ticket.title}</CardTitle>
                <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                  <Phone className="w-4 h-4" />
                  <span>{ticket.customer?.phone || 'Não informado'}</span>
                  <Badge variant={ticket.status === 'open' ? 'default' : 'secondary'}>
                    {ticket.status === 'open' ? 'Aberto' : 'Fechado'}
                  </Badge>
                </div>
              </div>
            </div>
            <div className="text-right text-sm text-muted-foreground">
              <div className="flex items-center space-x-1">
                <Clock className="w-4 h-4" />
                <span>
                  {ticket.last_message_at 
                    ? new Date(ticket.last_message_at).toLocaleString()
                    : 'Sem mensagens'
                  }
                </span>
              </div>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Área de mensagens */}
      <Card className="flex-1 flex flex-col min-h-0">
        <CardContent className="flex-1 flex flex-col min-h-0 p-0">
          <ScrollArea className="flex-1 p-4">
            <div className="space-y-4">
              {messagesLoading ? (
                <div className="text-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">Carregando mensagens...</p>
                </div>
              ) : messages.length === 0 ? (
                <div className="text-center py-8">
                  <MessageCircle className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                  <p className="text-sm text-muted-foreground">Nenhuma mensagem ainda</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Envie a primeira mensagem para iniciar a conversa
                  </p>
                </div>
              ) : (
                messages.map((message) => (
                  <div
                    key={message.id}
                    className={`flex ${message.from_me ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[70%] rounded-lg p-3 ${
                        message.from_me
                          ? 'bg-blue-500 text-white'
                          : 'bg-gray-100 text-gray-900'
                      }`}
                    >
                      {message.message_type === 'media' && message.media_url && (
                        <div className="mb-2">
                          {message.media_url.includes('image') ? (
                            <img 
                              src={message.media_url} 
                              alt="Mídia" 
                              className="max-w-full h-auto rounded"
                            />
                          ) : (
                            <div className="flex items-center space-x-2 p-2 bg-black/10 rounded">
                              {getFileIcon(message.message_type)}
                              <span className="text-sm">Arquivo anexado</span>
                              <Button size="sm" variant="ghost">
                                <Download className="w-4 h-4" />
                              </Button>
                            </div>
                          )}
                        </div>
                      )}
                      
                      {message.content && (
                        <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                      )}
                      
                      <div className="flex items-center justify-between mt-2">
                        <span className="text-xs opacity-70">
                          {new Date(message.timestamp).toLocaleTimeString()}
                        </span>
                        
                        {message.from_me && (
                          <div className="flex items-center space-x-1">
                            {getMessageStatus(message.message_id) === 'sent' && (
                              <CheckCircle className="w-3 h-3" />
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
              
              {/* Indicador de digitação */}
              {showTypingIndicator && (
                <div className="flex justify-start">
                  <div className="bg-gray-100 rounded-lg p-3">
                    <div className="flex space-x-1">
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                    </div>
                  </div>
                </div>
              )}
              
              <div ref={messagesEndRef} />
            </div>
          </ScrollArea>

          {/* Área de input */}
          <div className="border-t p-4">
            {selectedFile && (
              <div className="mb-3 p-3 bg-gray-50 rounded-lg border">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    {getFileIcon(selectedFile.type)}
                    <div>
                      <p className="text-sm font-medium">{selectedFile.name}</p>
                      <p className="text-xs text-gray-500">{formatFileSize(selectedFile.size)}</p>
                    </div>
                  </div>
                  <Button size="sm" variant="ghost" onClick={removeFile}>
                    <AlertCircle className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            )}

            <div className="flex space-x-2">
              <input
                type="file"
                id="file-input"
                className="hidden"
                onChange={handleFileSelect}
                accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.txt"
              />
              
              <Button
                size="sm"
                variant="outline"
                onClick={() => document.getElementById('file-input')?.click()}
                disabled={sending}
              >
                <Paperclip className="w-4 h-4" />
              </Button>

              <Textarea
                ref={textareaRef}
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="Digite sua mensagem..."
                className="flex-1 min-h-[40px] max-h-[120px] resize-none"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage();
                  }
                }}
                disabled={sending}
              />

              <Button
                onClick={handleSendMessage}
                disabled={(!newMessage.trim() && !selectedFile) || sending}
                size="sm"
              >
                {sending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default TicketChatInterface;
