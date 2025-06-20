import { useState, useEffect, useRef } from "react";
import { useParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Send, Paperclip, MoreVertical, Phone, Video, AlertCircle, Image, Mic, Download, Play, Pause, RefreshCw, Wifi, Settings, Check, CheckCheck } from "lucide-react";
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
  const [diagnosis, setDiagnosis] = useState<any>(null);
  const [showDiagnosis, setShowDiagnosis] = useState(false);
  const [readMessages, setReadMessages] = useState<Set<string>>(new Set());
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
      console.log(`🔄 Tentativa ${attempt + 1} de carregar chats para cliente: ${clientId}`);
      
      setError(null);
      
      // Executar diagnóstico na primeira tentativa
      if (attempt === 0) {
        console.log('🔍 Executando diagnóstico...');
        const diagnosisResult = await whatsappService.diagnoseClient(clientId);
        setDiagnosis(diagnosisResult);
        
        if (!diagnosisResult.serverConnected) {
          throw new Error('❌ Servidor WhatsApp não está respondendo. Verifique se o servidor está funcionando.');
        }
        
        if (diagnosisResult.clientStatus?.status !== 'connected') {
          throw new Error(`❌ WhatsApp não está conectado (status: ${diagnosisResult.clientStatus?.status}). Vá para "Conexão" primeiro.`);
        }
      }

      const chatsData = await whatsappService.getChats(clientId);
      console.log('✅ Chats carregados com sucesso:', chatsData);
      
      setChats(chatsData);
      setError(null);
      
      if (chatsData.length > 0 && !selectedChat) {
        setSelectedChat(chatsData[0].id);
      }
      
    } catch (err: any) {
      console.error(`❌ Erro na tentativa ${attempt + 1}:`, err);
      
      const errorMessage = err.message || 'Erro desconhecido';
      
      if (attempt < 2) {
        setError(`Tentativa ${attempt + 1}/3 falhou: ${errorMessage}. Tentando novamente...`);
        await new Promise(resolve => setTimeout(resolve, 3000));
        return loadChatsWithRetry(attempt + 1);
      } else {
        setError(`❌ Falha após 3 tentativas: ${errorMessage}`);
      }
    }
  };

  useEffect(() => {
    if (!clientId) return;

    const initializeChat = async () => {
      try {
        setLoading(true);
        setError(null);
        
        // Conectar ao WebSocket
        const socket = whatsappService.connectSocket();
        whatsappService.joinClientRoom(clientId);

        // Configurar listeners
        whatsappService.onClientMessage(clientId, (message: MessageData) => {
          console.log('Nova mensagem recebida:', message);
          setMessages(prev => [...prev, message]);
          
          // Marcar mensagem como lida pelo assistente após um delay (simulando processamento)
          if (!message.fromMe) {
            setTimeout(() => {
              setReadMessages(prev => new Set([...prev, message.id]));
              console.log('🤖 Assistente visualizou mensagem:', message.id);
            }, 2000); // 2 segundos de delay para simular processamento
          }
          
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
        
        // Marcar mensagens antigas do usuário como lidas pelo assistente
        const userMessages = messagesData.filter(msg => !msg.fromMe);
        const readMessageIds = new Set(userMessages.map(msg => msg.id));
        setReadMessages(readMessageIds);
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
    await loadChatsWithRetry();
    setLoading(false);
  };

  const handleSendMessage = async () => {
    if ((!newMessage.trim() && !selectedFile) || !selectedChat || !clientId) return;

    try {
      console.log('Enviando mensagem:', { to: selectedChat, message: newMessage, file: selectedFile?.name });
      
      if (selectedFile) {
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

  const renderMessageStatus = (message: MessageData) => {
    if (!message.fromMe) return null;
    
    const isRead = readMessages.has(message.id);
    
    return (
      <div className="flex items-center space-x-1 mt-1">
        {isRead ? (
          <CheckCheck className="w-3 h-3 text-blue-500" title="Lida pelo assistente" />
        ) : (
          <Check className="w-3 h-3 text-gray-400" title="Enviada" />
        )}
      </div>
    );
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

  const handleDiagnose = async () => {
    if (!clientId) return;
    
    try {
      setLoading(true);
      console.log('🔍 Executando diagnóstico manual...');
      const diagnosisResult = await whatsappService.diagnoseClient(clientId);
      setDiagnosis(diagnosisResult);
      setShowDiagnosis(true);
      
      toast({
        title: "Diagnóstico Completo",
        description: "Verifique os resultados na área de diagnóstico",
      });
    } catch (error: any) {
      toast({
        title: "Erro no Diagnóstico",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (loading && !error) {
    return (
      <div className="h-[calc(100vh-8rem)] flex items-center justify-center">
        <div className="text-center max-w-md">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Carregando conversas...</p>
          <p className="text-sm text-gray-500 mt-2">Verificando conexão WhatsApp...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-[calc(100vh-8rem)] flex items-center justify-center">
        <div className="text-center max-w-2xl">
          <div className="text-red-500 mb-4">
            <AlertCircle className="w-12 h-12 mx-auto mb-2" />
            <h3 className="font-semibold">Erro ao Carregar Conversas</h3>
          </div>
          <p className="text-gray-600 mb-4">{error}</p>
          
          <div className="space-y-3">
            <div className="flex justify-center space-x-2">
              <Button onClick={handleRetryLoadChats} disabled={loading}>
                <RefreshCw className="w-4 h-4 mr-2" />
                Tentar Novamente
              </Button>
              
              <Button variant="outline" onClick={handleDiagnose}>
                <Settings className="w-4 h-4 mr-2" />
                Diagnosticar
              </Button>
              
              <Button 
                variant="outline" 
                onClick={() => window.location.href = `/client/${clientId}/connect`}
              >
                <Wifi className="w-4 h-4 mr-2" />
                Ir para Conexão
              </Button>
            </div>
            
            {/* Área de Diagnóstico */}
            {showDiagnosis && diagnosis && (
              <div className="mt-6 p-4 bg-gray-50 border rounded-lg text-left">
                <h4 className="font-semibold mb-3 flex items-center">
                  <Settings className="w-4 h-4 mr-2" />
                  Diagnóstico do Sistema
                </h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span>Servidor WhatsApp:</span>
                    <Badge variant={diagnosis.serverConnected ? "default" : "destructive"}>
                      {diagnosis.serverConnected ? "✅ Conectado" : "❌ Desconectado"}
                    </Badge>
                  </div>
                  {diagnosis.clientStatus && (
                    <div className="flex justify-between">
                      <span>Status Cliente:</span>
                      <Badge variant={diagnosis.clientStatus.status === 'connected' ? "default" : "secondary"}>
                        {diagnosis.clientStatus.status}
                      </Badge>
                    </div>
                  )}
                  {diagnosis.clientStatus?.phoneNumber && (
                    <div className="flex justify-between">
                      <span>Número:</span>
                      <span className="font-mono">{diagnosis.clientStatus.phoneNumber}</span>
                    </div>
                  )}
                  {diagnosis.serverHealth && (
                    <div className="flex justify-between">
                      <span>Clientes Ativos:</span>
                      <span>{diagnosis.serverHealth.activeClients}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span>Timestamp:</span>
                    <span className="text-xs">{new Date(diagnosis.timestamp).toLocaleString()}</span>
                  </div>
                  {diagnosis.error && (
                    <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded">
                      <span className="text-red-700 text-xs">Erro: {diagnosis.error}</span>
                    </div>
                  )}
                </div>
                <Button 
                  size="sm" 
                  variant="ghost" 
                  onClick={() => setShowDiagnosis(false)}
                  className="mt-3"
                >
                  Fechar Diagnóstico
                </Button>
              </div>
            )}
          </div>
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
              Conversas ({chats.length})
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
                  <SelectItem value="1000">1K</SelectItem>
                  <SelectItem value="2000">2K</SelectItem>
                  <SelectItem value="5000">5K</SelectItem>
                </SelectContent>
              </Select>
              <Button 
                variant="ghost" 
                size="sm"
                onClick={handleRetryLoadChats}
                disabled={loading}
                title="Recarregar conversas"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
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
            {chats.length === 0 ? (
              <div className="p-4 text-center text-gray-500">
                <AlertCircle className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                <p>Nenhuma conversa encontrada</p>
                <p className="text-sm">Verifique se o WhatsApp está conectado</p>
                <Button 
                  size="sm" 
                  variant="outline" 
                  onClick={handleDiagnose}
                  className="mt-2"
                >
                  <Settings className="w-3 h-3 mr-1" />
                  Diagnosticar
                </Button>
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
                                <div className="flex items-center justify-between mt-1">
                                  <p className={`text-xs ${
                                    message.fromMe ? 'text-green-100' : 'text-gray-500'
                                  }`}>
                                    {formatTime(message.timestamp)}
                                  </p>
                                  {renderMessageStatus(message)}
                                </div>
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
