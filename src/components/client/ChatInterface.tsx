import { useState, useEffect, useRef } from "react";
import { useParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Send, Paperclip, MoreVertical, Phone, Video, AlertCircle, Image, Mic, Download, Play, Pause, RefreshCw, Wifi } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { whatsappService, type ChatData, type MessageData } from "@/services/whatsappMultiClient";
import { useToast } from "@/hooks/use-toast";

const ChatInterface = () => {
  const { clientId } = useParams<{ clientId: string }>();
  const { toast } = useToast();
  const [selectedChat, setSelectedChat] = useState<string>("");
  const [newMessage, setNewMessage] = useState("");
  const [chats, setChats] = useState<ChatData[]>([]);
  const [messages, setMessages] = useState<MessageData[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [messageLimit, setMessageLimit] = useState<number>(50);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [isRetrying, setIsRetrying] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const [audioChunks, setAudioChunks] = useState<Blob[]>([]);

  const MAX_RETRY_ATTEMPTS = 3;
  const RETRY_DELAY = 2000;

  const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  const checkConnectionStatus = async () => {
    if (!clientId) return false;
    
    try {
      const clientStatus = await whatsappService.getClientStatus(clientId);
      console.log('Status da conexão:', clientStatus);
      return clientStatus.status === 'connected';
    } catch (error) {
      console.error('Erro ao verificar status:', error);
      return false;
    }
  };

  const loadChatsWithRetry = async (attempt = 0): Promise<void> => {
    if (!clientId) return;

    try {
      console.log(`Tentativa ${attempt + 1} de carregar chats para cliente:`, clientId);
      
      // Verificar se o cliente está conectado antes de tentar carregar chats
      const isConnected = await checkConnectionStatus();
      if (!isConnected) {
        throw new Error('WhatsApp não está conectado. Por favor, conecte primeiro na aba "Conexão".');
      }

      const chatsData = await whatsappService.getChats(clientId);
      console.log('Chats carregados com sucesso:', chatsData);
      
      setChats(chatsData);
      setError(null);
      setRetryCount(0);
      
      if (chatsData.length > 0 && !selectedChat) {
        setSelectedChat(chatsData[0].id);
      }
    } catch (err: any) {
      console.error(`Erro na tentativa ${attempt + 1}:`, err);
      
      const errorMessage = err.message || 'Erro desconhecido';
      
      // Se o erro é de serialização, isso indica problema no backend
      if (errorMessage.includes('_serialized') || errorMessage.includes('Evaluation failed')) {
        if (attempt < MAX_RETRY_ATTEMPTS - 1) {
          setRetryCount(attempt + 1);
          setIsRetrying(true);
          setError(`Erro no servidor WhatsApp. Tentando novamente... (${attempt + 1}/${MAX_RETRY_ATTEMPTS})`);
          
          await delay(RETRY_DELAY * (attempt + 1)); // Backoff exponencial
          return loadChatsWithRetry(attempt + 1);
        } else {
          setError('Erro persistente no servidor WhatsApp. O backend está com problemas na serialização dos dados de chat. Tente reconectar o WhatsApp ou contate o suporte.');
        }
      } else if (errorMessage.includes('não está conectado')) {
        setError('WhatsApp não conectado. Vá para a aba "Conexão" para conectar seu WhatsApp primeiro.');
      } else {
        setError(`Erro ao carregar conversas: ${errorMessage}`);
      }
      
      setRetryCount(attempt);
      setIsRetrying(false);
    }
  };

  useEffect(() => {
    if (!clientId) return;

    const initializeChat = async () => {
      try {
        setLoading(true);
        setError(null);
        setIsRetrying(false);
        
        // Conectar ao WebSocket
        const socket = whatsappService.connectSocket();
        whatsappService.joinClientRoom(clientId);

        // Configurar listeners
        whatsappService.onClientMessage(clientId, (message: MessageData) => {
          console.log('Nova mensagem recebida:', message);
          setMessages(prev => [...prev, message]);
          
          // Atualizar preview do chat
          setChats(prev => prev.map(chat => 
            chat.id === message.from || chat.id === message.to
              ? { 
                  ...chat, 
                  lastMessage: {
                    body: message.body,
                    type: message.type,
                    timestamp: message.timestamp,
                    fromMe: message.fromMe
                  },
                  timestamp: message.timestamp
                }
              : chat
          ));
        });

        // Carregar chats
        await loadChatsWithRetry();
        
      } catch (err: any) {
        console.error('Erro ao inicializar chat:', err);
        setError(err.message || 'Erro ao inicializar interface de chat');
      } finally {
        setLoading(false);
      }
    };

    initializeChat();

    return () => {
      whatsappService.removeListener(`message_${clientId}`);
    };
  }, [clientId]);

  useEffect(() => {
    if (!selectedChat || !clientId) return;

    const loadMessages = async () => {
      try {
        setLoadingMessages(true);
        console.log(`Carregando ${messageLimit} mensagens para chat:`, selectedChat);
        const messagesData = await whatsappService.getChatMessages(clientId, selectedChat, messageLimit);
        console.log('Mensagens carregadas:', messagesData);
        setMessages(messagesData);
      } catch (err) {
        console.error('Erro ao carregar mensagens:', err);
      } finally {
        setLoadingMessages(false);
      }
    };

    loadMessages();
  }, [selectedChat, clientId, messageLimit]);

  const handleRetryLoadChats = async () => {
    setLoading(true);
    setError(null);
    setRetryCount(0);
    await loadChatsWithRetry();
    setLoading(false);
  };

  const handleSendMessage = async () => {
    if ((!newMessage.trim() && !selectedFile) || !selectedChat || !clientId) return;

    try {
      console.log('Enviando mensagem:', { to: selectedChat, message: newMessage, file: selectedFile?.name });
      
      if (selectedFile) {
        // Para arquivos de mídia
        const formData = new FormData();
        formData.append('file', selectedFile);
        formData.append('to', selectedChat);
        formData.append('caption', newMessage || '');

        // Determinar o tipo de mídia
        let mediaType = 'document';
        if (selectedFile.type.startsWith('image/')) {
          mediaType = 'image';
        } else if (selectedFile.type.startsWith('audio/')) {
          mediaType = 'audio';
        }

        await whatsappService.sendMessage(clientId, selectedChat, newMessage || `📎 ${selectedFile.name}`, undefined, selectedFile);
        setSelectedFile(null);
      } else {
        await whatsappService.sendMessage(clientId, selectedChat, newMessage);
      }
      
      setNewMessage("");
      
      toast({
        title: "Mensagem enviada",
        description: "Sua mensagem foi enviada com sucesso",
      });
      
    } catch (err: any) {
      console.error('Erro ao enviar mensagem:', err);
      toast({
        title: "Erro ao enviar",
        description: err.message || "Falha ao enviar mensagem",
        variant: "destructive",
      });
    }
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      setAudioChunks([]);

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          setAudioChunks(prev => [...prev, event.data]);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunks, { type: 'audio/wav' });
        const audioFile = new File([audioBlob], 'audio.wav', { type: 'audio/wav' });
        setSelectedFile(audioFile);
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (err) {
      console.error('Erro ao iniciar gravação:', err);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const renderMessageContent = (message: MessageData) => {
    switch (message.type) {
      case 'image':
        return (
          <div className="space-y-2">
            <div className="bg-gray-200 rounded-lg p-2 max-w-xs">
              <Image className="w-4 h-4 inline mr-2" />
              <span className="text-sm">Imagem</span>
            </div>
            {message.body && <p className="text-sm">{message.body}</p>}
          </div>
        );
      case 'audio':
      case 'ptt':
        return (
          <div className="space-y-2">
            <div className="bg-gray-200 rounded-lg p-2 max-w-xs flex items-center space-x-2">
              <Mic className="w-4 h-4" />
              <span className="text-sm">Áudio</span>
              <Button size="sm" variant="ghost">
                <Play className="w-3 h-3" />
              </Button>
            </div>
            {message.body && <p className="text-sm">{message.body}</p>}
          </div>
        );
      case 'document':
        return (
          <div className="space-y-2">
            <div className="bg-gray-200 rounded-lg p-2 max-w-xs flex items-center space-x-2">
              <Paperclip className="w-4 h-4" />
              <span className="text-sm">Documento</span>
              <Button size="sm" variant="ghost">
                <Download className="w-3 h-3" />
              </Button>
            </div>
            {message.body && <p className="text-sm">{message.body}</p>}
          </div>
        );
      default:
        return <p className="text-sm">{message.body}</p>;
    }
  };

  const currentChat = chats.find(chat => chat.id === selectedChat);
  const filteredChats = chats.filter(chat =>
    chat.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString('pt-BR', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString('pt-BR');
  };

  if (loading && !isRetrying) {
    return (
      <div className="h-[calc(100vh-8rem)] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Carregando conversas...</p>
          <p className="text-sm text-gray-500 mt-2">Conectando ao WhatsApp...</p>
        </div>
      </div>
    );
  }

  if (error && !isRetrying) {
    return (
      <div className="h-[calc(100vh-8rem)] flex items-center justify-center">
        <div className="text-center max-w-md">
          <div className="text-red-500 mb-4">
            <AlertCircle className="w-12 h-12 mx-auto mb-2" />
            <h3 className="font-semibold">Erro ao Carregar Conversas</h3>
          </div>
          <p className="text-gray-600 mb-4">{error}</p>
          <div className="space-y-2">
            <Button onClick={handleRetryLoadChats} disabled={loading}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Tentar Novamente
            </Button>
            {error.includes('não está conectado') && (
              <Button 
                variant="outline" 
                onClick={() => window.location.href = `/client/${clientId}/connect`}
              >
                <Wifi className="w-4 h-4 mr-2" />
                Ir para Conexão
              </Button>
            )}
          </div>
          {retryCount > 0 && (
            <p className="text-sm text-gray-500 mt-2">
              Tentativas realizadas: {retryCount}/{MAX_RETRY_ATTEMPTS}
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-8rem)] grid grid-cols-12 gap-6">
      {/* Chat List */}
      <Card className="col-span-4 flex flex-col">
        <CardHeader className="pb-3">
          <div className="flex justify-between items-center">
            <CardTitle className="text-lg">
              Conversas ({filteredChats.length})
              {isRetrying && (
                <span className="ml-2 text-sm text-yellow-600">
                  <RefreshCw className="w-3 h-3 inline animate-spin mr-1" />
                  Tentando...
                </span>
              )}
            </CardTitle>
            <div className="flex items-center space-x-2">
              <Select value={messageLimit.toString()} onValueChange={(value) => setMessageLimit(Number(value))}>
                <SelectTrigger className="w-20">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="10">10</SelectItem>
                  <SelectItem value="25">25</SelectItem>
                  <SelectItem value="50">50</SelectItem>
                  <SelectItem value="100">100</SelectItem>
                  <SelectItem value="200">200</SelectItem>
                  <SelectItem value="500">500</SelectItem>
                  <SelectItem value="1000">1000</SelectItem>
                </SelectContent>
              </Select>
              <Button 
                variant="ghost" 
                size="sm"
                onClick={handleRetryLoadChats}
                disabled={loading || isRetrying}
                title="Recarregar conversas"
              >
                <RefreshCw className={`w-4 h-4 ${(loading || isRetrying) ? 'animate-spin' : ''}`} />
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
                {chats.length === 0 ? (
                  <>
                    <AlertCircle className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                    <p>Nenhuma conversa encontrada</p>
                    <p className="text-sm">Verifique se o WhatsApp está conectado</p>
                    {isRetrying && (
                      <p className="text-sm text-yellow-600 mt-2">
                        <RefreshCw className="w-3 h-3 inline animate-spin mr-1" />
                        Carregando conversas...
                      </p>
                    )}
                  </>
                ) : (
                  <>
                    <Search className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                    <p>Nenhuma conversa encontrada para "{searchTerm}"</p>
                  </>
                )}
              </div>
            ) : (
              filteredChats.map((chat) => (
                <div
                  key={chat.id}
                  onClick={() => setSelectedChat(chat.id)}
                  className={`p-4 border-b cursor-pointer hover:bg-gray-50 transition-colors ${
                    selectedChat === chat.id ? 'bg-green-50 border-r-2 border-r-green-500' : ''
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    <div className="relative">
                      <Avatar className="w-12 h-12">
                        <AvatarFallback>{chat.name.charAt(0)}</AvatarFallback>
                      </Avatar>
                      {chat.isGroup && (
                        <Badge className="absolute -top-1 -right-1 text-xs px-1">G</Badge>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-center">
                        <h3 className="font-medium text-gray-900 truncate">{chat.name}</h3>
                        <span className="text-xs text-gray-500">
                          {formatTime(chat.timestamp)}
                        </span>
                      </div>
                      <div className="flex justify-between items-center mt-1">
                        <p className="text-sm text-gray-600 truncate">
                          {chat.lastMessage?.type === 'image' && '📷 Imagem'}
                          {chat.lastMessage?.type === 'audio' && '🎵 Áudio'}
                          {chat.lastMessage?.type === 'document' && '📄 Documento'}
                          {(!chat.lastMessage?.type || chat.lastMessage?.type === 'chat') && 
                           (chat.lastMessage?.body || 'Nenhuma mensagem')}
                        </p>
                        {chat.unreadCount > 0 && (
                          <Badge className="bg-green-500 text-white text-xs rounded-full px-2 py-1">
                            {chat.unreadCount}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Chat Messages */}
      <Card className="col-span-8 flex flex-col">
        {currentChat ? (
          <>
            {/* Chat Header */}
            <CardHeader className="border-b">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="relative">
                    <Avatar className="w-10 h-10">
                      <AvatarFallback>{currentChat.name.charAt(0)}</AvatarFallback>
                    </Avatar>
                  </div>
                  <div>
                    <h3 className="font-medium text-gray-900">{currentChat.name}</h3>
                    <p className="text-sm text-gray-500">
                      {currentChat.isGroup ? 'Grupo' : 'Contato'} • {messages.length} mensagens
                    </p>
                  </div>
                </div>
                <div className="flex space-x-2">
                  <Button variant="ghost" size="sm">
                    <Phone className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="sm">
                    <Video className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="sm">
                    <MoreVertical className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>

            {/* Messages Area */}
            <CardContent className="flex-1 p-4">
              {loadingMessages ? (
                <div className="flex items-center justify-center h-full">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-green-500"></div>
                </div>
              ) : (
                <ScrollArea className="h-96">
                  <div className="space-y-4">
                    {messages.length === 0 ? (
                      <div className="text-center text-gray-500 py-8">
                        <p>Nenhuma mensagem nesta conversa</p>
                        <p className="text-sm">As mensagens aparecerão aqui conforme você conversa</p>
                      </div>
                    ) : (
                      messages.map((message, index) => {
                        const showDate = index === 0 || 
                          formatDate(message.timestamp) !== formatDate(messages[index - 1].timestamp);
                        
                        return (
                          <div key={message.id}>
                            {showDate && (
                              <div className="text-center my-4">
                                <span className="bg-gray-100 px-3 py-1 rounded-full text-xs text-gray-600">
                                  {formatDate(message.timestamp)}
                                </span>
                              </div>
                            )}
                            <div className={`flex ${message.fromMe ? 'justify-end' : 'justify-start'}`}>
                              <div className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                                message.fromMe
                                  ? 'bg-green-500 text-white'
                                  : 'bg-gray-100 text-gray-900'
                              }`}>
                                {!message.fromMe && currentChat.isGroup && message.author && (
                                  <p className="text-xs font-medium mb-1 opacity-70">
                                    {message.author}
                                  </p>
                                )}
                                {renderMessageContent(message)}
                                <p className={`text-xs mt-1 ${
                                  message.fromMe ? 'text-green-100' : 'text-gray-500'
                                }`}>
                                  {formatTime(message.timestamp)}
                                </p>
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </ScrollArea>
              )}
            </CardContent>

            {/* Message Input */}
            <div className="border-t p-4">
              {selectedFile && (
                <div className="mb-3 p-2 bg-gray-50 rounded-lg flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    {selectedFile.type.startsWith('image/') && <Image className="w-4 h-4" />}
                    {selectedFile.type.startsWith('audio/') && <Mic className="w-4 h-4" />}
                    {!selectedFile.type.startsWith('image/') && !selectedFile.type.startsWith('audio/') && <Paperclip className="w-4 h-4" />}
                    <span className="text-sm">{selectedFile.name}</span>
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => setSelectedFile(null)}>
                    ✕
                  </Button>
                </div>
              )}
              
              <div className="flex space-x-2">
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileSelect}
                  accept="image/*,audio/*,.pdf,.doc,.docx"
                  className="hidden"
                />
                
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Paperclip className="w-4 h-4" />
                </Button>
                
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={isRecording ? stopRecording : startRecording}
                  className={isRecording ? 'text-red-500' : ''}
                >
                  <Mic className="w-4 h-4" />
                </Button>
                
                <Input
                  placeholder="Digite sua mensagem..."
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                  className="flex-1"
                />
                
                <Button 
                  onClick={handleSendMessage}
                  disabled={!newMessage.trim() && !selectedFile}
                  className="bg-green-500 hover:bg-green-600"
                >
                  <Send className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center text-gray-500">
              <h3 className="text-lg font-medium mb-2">Selecione uma conversa</h3>
              <p>Escolha uma conversa da lista para começar a chatear</p>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
};

export default ChatInterface;
