
import { useState, useEffect, useRef } from "react";
import { useParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Search, Send, MessageSquare, Clock, User, Bot, AlertCircle, RefreshCw, Upload, Mic, Phone } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { whatsappService, type ChatData, type MessageData } from "@/services/whatsappMultiClient";
import { customersService, type Customer } from "@/services/customersService";
import { queuesService } from "@/services/queuesService";
import { assistantsService } from "@/services/assistantsService";
import { aiConfigService } from "@/services/aiConfigService";

const ChatInterface = () => {
  const { clientId } = useParams<{ clientId: string }>();
  const { toast } = useToast();
  
  // Estados principais
  const [chats, setChats] = useState<ChatData[]>([]);
  const [selectedChat, setSelectedChat] = useState<string>("");
  const [messages, setMessages] = useState<MessageData[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  
  // Estados para gestão de contatos e automação
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [queues, setQueues] = useState<any[]>([]);
  const [aiConfig, setAiConfig] = useState<any>(null);
  const [isProcessingMessage, setIsProcessingMessage] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (clientId) {
      initializeChat();
      loadCustomers();
      loadQueuesAndAI();
    }
  }, [clientId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const initializeChat = async () => {
    try {
      setIsLoading(true);
      
      // Testar conexão primeiro
      const isHealthy = await whatsappService.testConnection();
      if (!isHealthy) {
        toast({
          title: "Erro de Conexão",
          description: "Servidor WhatsApp não está respondendo",
          variant: "destructive",
        });
        return;
      }

      // Conectar WebSocket
      const socket = whatsappService.connectSocket();
      
      socket.on('connect', () => {
        console.log('✅ WebSocket conectado');
        setIsConnected(true);
        whatsappService.joinClientRoom(clientId!);
        loadChats();
      });

      socket.on('disconnect', () => {
        console.log('❌ WebSocket desconectado');
        setIsConnected(false);
      });

      // Listener para novas mensagens
      whatsappService.onClientMessage(clientId!, handleNewMessage);
      
      // Carregar chats se já conectado
      if (socket.connected) {
        setIsConnected(true);
        whatsappService.joinClientRoom(clientId!);
        loadChats();
      }

    } catch (error) {
      console.error('Erro ao inicializar chat:', error);
      toast({
        title: "Erro",
        description: "Erro ao conectar com o WhatsApp",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const loadCustomers = async () => {
    try {
      const customersList = await customersService.getClientCustomers(clientId!);
      setCustomers(customersList);
    } catch (error) {
      console.error('Erro ao carregar clientes:', error);
    }
  };

  const loadQueuesAndAI = async () => {
    try {
      const [queuesList, aiConfiguration] = await Promise.all([
        queuesService.getClientQueues(clientId!),
        aiConfigService.getClientConfig(clientId!)
      ]);
      
      setQueues(queuesList);
      setAiConfig(aiConfiguration);
    } catch (error) {
      console.error('Erro ao carregar configurações:', error);
    }
  };

  const loadChats = async () => {
    try {
      const chatsList = await whatsappService.getChats(clientId!);
      setChats(chatsList);
      console.log(`📱 ${chatsList.length} conversas carregadas`);
    } catch (error) {
      console.error('Erro ao carregar chats:', error);
      toast({
        title: "Erro",
        description: "Erro ao carregar conversas",
        variant: "destructive",
      });
    }
  };

  const loadChatMessages = async (chatId: string) => {
    try {
      setLoadingMessages(true);
      const messagesList = await whatsappService.getChatMessages(clientId!, chatId, 50);
      setMessages(messagesList);
      
      // Marcar como lido
      await whatsappService.markAsRead(clientId!, chatId);
      
      // Atualizar contagem não lida no chat
      setChats(prev => prev.map(chat => 
        chat.id === chatId ? { ...chat, unreadCount: 0 } : chat
      ));
      
    } catch (error) {
      console.error('Erro ao carregar mensagens:', error);
      toast({
        title: "Erro",
        description: "Erro ao carregar mensagens",
        variant: "destructive",
      });
    } finally {
      setLoadingMessages(false);
    }
  };

  const handleNewMessage = async (message: MessageData) => {
    console.log('📨 Nova mensagem recebida:', message);
    
    // Atualizar lista de chats
    await loadChats();
    
    // Se é da conversa selecionada, adicionar à lista de mensagens
    if (selectedChat === message.from || selectedChat === message.to) {
      setMessages(prev => [...prev, message]);
      
      // Marcar como lido automaticamente se conversa está aberta
      if (!message.fromMe) {
        await whatsappService.markAsRead(clientId!, selectedChat);
      }
    }
    
    // Processar com assistente se não for nossa mensagem
    if (!message.fromMe && message.type === 'text') {
      await processMessageWithAssistant(message);
    }
  };

  const processMessageWithAssistant = async (message: MessageData) => {
    if (!aiConfig || isProcessingMessage) return;
    
    try {
      setIsProcessingMessage(true);
      
      // Buscar fila ativa com assistente
      const activeQueue = queues.find(queue => 
        queue.is_active && 
        queue.assistants && 
        queue.assistants.is_active
      );
      
      if (!activeQueue || !activeQueue.assistants) {
        console.log('Nenhuma fila ativa com assistente encontrada');
        return;
      }
      
      const assistant = activeQueue.assistants;
      console.log('🤖 Processando com assistente:', assistant.name);
      
      // Preparar configurações
      let settings = {
        temperature: 0.7,
        max_tokens: 1000
      };
      
      try {
        if (assistant.advanced_settings) {
          const parsed = typeof assistant.advanced_settings === 'string' 
            ? JSON.parse(assistant.advanced_settings)
            : assistant.advanced_settings;
          
          settings = {
            temperature: Number(parsed.temperature) || 0.7,
            max_tokens: Number(parsed.max_tokens) || 1000
          };
        }
      } catch (error) {
        console.error('Erro ao parse configurações:', error);
      }
      
      // Buscar histórico recente
      const recentMessages = messages.slice(-10).map(msg => ({
        role: msg.fromMe ? 'assistant' : 'user',
        content: msg.body || ''
      }));
      
      // Chamar OpenAI
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${aiConfig.openai_api_key}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: assistant.model || aiConfig.default_model || 'gpt-4o-mini',
          messages: [
            {
              role: 'system',
              content: assistant.prompt || 'Você é um assistente útil.'
            },
            ...recentMessages,
            {
              role: 'user',
              content: message.body || ''
            }
          ],
          temperature: settings.temperature,
          max_tokens: settings.max_tokens,
        }),
      });
      
      if (!response.ok) {
        throw new Error(`Erro da API: ${response.status}`);
      }
      
      const data = await response.json();
      const assistantResponse = data.choices?.[0]?.message?.content;
      
      if (assistantResponse && assistantResponse.trim()) {
        // Simular digitação
        await whatsappService.sendPresence(clientId!, message.from, 'typing');
        
        // Delay para parecer mais humano
        await new Promise(resolve => setTimeout(resolve, 2000 + Math.random() * 3000));
        
        // Enviar resposta
        await whatsappService.sendMessage(clientId!, message.from, assistantResponse);
        
        console.log('✅ Resposta do assistente enviada');
      }
      
    } catch (error) {
      console.error('❌ Erro ao processar com assistente:', error);
    } finally {
      setIsProcessingMessage(false);
    }
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !selectedChat || !isConnected) return;

    try {
      await whatsappService.sendMessage(clientId!, selectedChat, newMessage);
      setNewMessage("");
      
      // Recarregar mensagens após um pequeno delay
      setTimeout(() => {
        loadChatMessages(selectedChat);
      }, 500);
      
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !selectedChat) return;

    try {
      await whatsappService.sendMedia(clientId!, selectedChat, file, newMessage);
      setNewMessage("");
      
      setTimeout(() => {
        loadChatMessages(selectedChat);
      }, 500);
      
      toast({
        title: "Sucesso",
        description: "Mídia enviada com sucesso",
      });
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const getContactName = (chatId: string) => {
    const customer = customers.find(c => c.whatsapp_chat_id === chatId);
    if (customer) return customer.name;
    
    const chat = chats.find(c => c.id === chatId);
    if (chat && chat.name) return chat.name;
    
    // Formatar número do telefone se não tiver nome
    const phone = chatId.replace(/\D/g, '');
    if (phone.length >= 10) {
      return phone.replace(/(\d{2})(\d{4,5})(\d{4})/, '($1) $2-$3');
    }
    
    return 'Contato Desconhecido';
  };

  const filteredChats = chats.filter(chat => {
    const contactName = getContactName(chat.id);
    return contactName.toLowerCase().includes(searchTerm.toLowerCase()) ||
           chat.lastMessage?.body?.toLowerCase().includes(searchTerm.toLowerCase());
  });

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const selectedChatData = chats.find(c => c.id === selectedChat);

  if (isLoading) {
    return (
      <div className="h-[calc(100vh-8rem)] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Conectando ao WhatsApp...</p>
        </div>
      </div>
    );
  }

  if (!isConnected) {
    return (
      <div className="h-[calc(100vh-8rem)] flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h3 className="text-lg font-medium mb-2">Conexão Perdida</h3>
          <p className="text-muted-foreground mb-4">Não foi possível conectar ao WhatsApp</p>
          <Button onClick={initializeChat}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Reconectar
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-8rem)] grid grid-cols-12 gap-6">
      {/* Lista de Conversas */}
      <Card className="col-span-4 flex flex-col">
        <CardHeader className="pb-3">
          <div className="flex justify-between items-center">
            <CardTitle className="text-lg flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              Conversas ({filteredChats.length})
              {isProcessingMessage && (
                <Bot className="h-4 w-4 text-blue-500 animate-pulse" />
              )}
            </CardTitle>
            <div className="flex gap-2">
              <Badge variant={isConnected ? "default" : "destructive"} className="text-xs">
                {isConnected ? "Online" : "Offline"}
              </Badge>
              <Button 
                variant="outline" 
                size="sm"
                onClick={loadChats}
                disabled={isLoading}
              >
                <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </div>
          
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input 
              placeholder="Buscar conversas..." 
              className="pl-10"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </CardHeader>
        
        <CardContent className="flex-1 p-0">
          <ScrollArea className="h-full">
            {filteredChats.length === 0 ? (
              <div className="p-4 text-center text-gray-500">
                <MessageSquare className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                <p>Nenhuma conversa encontrada</p>
              </div>
            ) : (
              filteredChats.map((chat) => {
                const contactName = getContactName(chat.id);
                
                return (
                  <div
                    key={chat.id}
                    onClick={() => {
                      setSelectedChat(chat.id);
                      loadChatMessages(chat.id);
                    }}
                    className={`p-4 border-b cursor-pointer hover:bg-gray-50 transition-colors ${
                      selectedChat === chat.id ? 'bg-blue-50 border-r-2 border-r-blue-500' : ''
                    }`}
                  >
                    <div className="flex items-start space-x-3">
                      <Avatar className="w-10 h-10 flex-shrink-0">
                        <AvatarFallback>
                          {contactName.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      
                      <div className="flex-1 min-w-0 space-y-1">
                        <div className="flex justify-between items-start">
                          <h3 className="font-medium text-gray-900 truncate">
                            {contactName}
                          </h3>
                          <div className="flex flex-col items-end gap-1">
                            <span className="text-xs text-gray-500">
                              {formatTime(chat.lastMessage?.timestamp || chat.timestamp)}
                            </span>
                            {chat.unreadCount > 0 && (
                              <Badge variant="default" className="text-xs min-w-[20px] h-5 rounded-full">
                                {chat.unreadCount}
                              </Badge>
                            )}
                          </div>
                        </div>
                        
                        <p className="text-sm text-gray-600 truncate">
                          {chat.lastMessage?.fromMe && "Você: "}
                          {chat.lastMessage?.body || 'Sem mensagens'}
                        </p>
                        
                        <div className="flex items-center justify-between text-xs text-gray-500">
                          <div className="flex items-center gap-1">
                            {chat.isGroup && (
                              <Badge variant="outline" className="text-xs">
                                Grupo
                              </Badge>
                            )}
                            {chat.pinned && (
                              <Badge variant="outline" className="text-xs">
                                Fixado
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Área de Chat */}
      <Card className="col-span-8 flex flex-col">
        {selectedChatData ? (
          <>
            {/* Header do Chat */}
            <CardHeader className="border-b">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <Avatar className="w-8 h-8">
                    <AvatarFallback>
                      {getContactName(selectedChatData.id).charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <h3 className="font-medium">
                      {getContactName(selectedChatData.id)}
                    </h3>
                    <p className="text-sm text-gray-500">
                      {selectedChatData.id.replace('@c.us', '')}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {isProcessingMessage && (
                    <Badge variant="outline" className="text-xs">
                      <Bot className="w-3 h-3 mr-1" />
                      Assistente processando...
                    </Badge>
                  )}
                  <Button variant="outline" size="sm">
                    <Phone className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>

            {/* Mensagens */}
            <CardContent className="flex-1 flex flex-col p-4">
              <ScrollArea className="flex-1 mb-4">
                {loadingMessages ? (
                  <div className="flex items-center justify-center h-32">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {messages.map((message) => (
                      <div
                        key={message.id}
                        className={`flex ${message.fromMe ? 'justify-end' : 'justify-start'}`}
                      >
                        <div className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                          message.fromMe
                            ? 'bg-blue-500 text-white'
                            : 'bg-gray-100 text-gray-900'
                        }`}>
                          <p className="text-sm whitespace-pre-wrap">{message.body}</p>
                          <p className={`text-xs mt-1 ${
                            message.fromMe ? 'text-blue-100' : 'text-gray-500'
                          }`}>
                            {formatTime(message.timestamp)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                <div ref={messagesEndRef} />
              </ScrollArea>

              {/* Input de Mensagem */}
              <div className="flex space-x-2">
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                  accept="image/*,video/*,audio/*,.pdf,.doc,.docx"
                  className="hidden"
                />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="w-4 h-4" />
                </Button>
                <Input
                  placeholder="Digite sua mensagem..."
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      handleSendMessage();
                    }
                  }}
                />
                <Button 
                  onClick={handleSendMessage}
                  disabled={!newMessage.trim() || !isConnected}
                >
                  <Send className="w-4 h-4" />
                </Button>
              </div>
            </CardContent>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center text-muted-foreground">
              <MessageSquare className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <h3 className="text-lg font-medium mb-2">Selecione uma conversa</h3>
              <p>Escolha uma conversa da lista para começar</p>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
};

export default ChatInterface;
