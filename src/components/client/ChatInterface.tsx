
import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Search, Send, Paperclip, MoreVertical, Phone, Video } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { whatsappService, type ChatData, type MessageData } from "@/services/whatsappMultiClient";

const ChatInterface = () => {
  const { clientId } = useParams<{ clientId: string }>();
  const [selectedChat, setSelectedChat] = useState<string>("");
  const [newMessage, setNewMessage] = useState("");
  const [chats, setChats] = useState<ChatData[]>([]);
  const [messages, setMessages] = useState<MessageData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!clientId) return;

    const loadChats = async () => {
      try {
        setLoading(true);
        setError(null);
        console.log('Carregando chats para cliente:', clientId);
        
        const chatsData = await whatsappService.getChats(clientId);
        console.log('Chats carregados:', chatsData);
        
        setChats(chatsData);
        
        // Seleciona o primeiro chat automaticamente
        if (chatsData.length > 0) {
          setSelectedChat(chatsData[0].id);
        }
      } catch (err) {
        console.error('Erro ao carregar chats:', err);
        setError('Erro ao carregar conversas. Verifique se o WhatsApp está conectado.');
      } finally {
        setLoading(false);
      }
    };

    loadChats();

    // Conecta ao WebSocket para atualizações em tempo real
    const socket = whatsappService.connectSocket();
    whatsappService.joinClientRoom(clientId);

    // Escuta novas mensagens
    whatsappService.onClientMessage(clientId, (message: MessageData) => {
      console.log('Nova mensagem recebida:', message);
      setMessages(prev => [...prev, message]);
    });

    return () => {
      whatsappService.removeListener(`message_${clientId}`);
    };
  }, [clientId]);

  useEffect(() => {
    if (!selectedChat || !clientId) return;

    const loadMessages = async () => {
      try {
        console.log('Carregando mensagens para chat:', selectedChat);
        const messagesData = await whatsappService.getChatMessages(clientId, selectedChat);
        console.log('Mensagens carregadas:', messagesData);
        setMessages(messagesData);
      } catch (err) {
        console.error('Erro ao carregar mensagens:', err);
      }
    };

    loadMessages();
  }, [selectedChat, clientId]);

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !selectedChat || !clientId) return;

    try {
      console.log('Enviando mensagem:', { to: selectedChat, message: newMessage });
      await whatsappService.sendMessage(clientId, selectedChat, newMessage);
      setNewMessage("");
    } catch (err) {
      console.error('Erro ao enviar mensagem:', err);
    }
  };

  const currentChat = chats.find(chat => chat.id === selectedChat);

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString('pt-BR', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  if (loading) {
    return (
      <div className="h-[calc(100vh-8rem)] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Carregando conversas...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-[calc(100vh-8rem)] flex items-center justify-center">
        <div className="text-center max-w-md">
          <div className="text-red-500 mb-4">
            <AlertCircle className="w-12 h-12 mx-auto mb-2" />
            <h3 className="font-semibold">Erro ao Carregar Conversas</h3>
          </div>
          <p className="text-gray-600 mb-4">{error}</p>
          <Button onClick={() => window.location.reload()}>
            Tentar Novamente
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-8rem)] grid grid-cols-12 gap-6">
      {/* Chat List */}
      <Card className="col-span-4 flex flex-col">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Conversas ({chats.length})</CardTitle>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input placeholder="Buscar conversas..." className="pl-10" />
          </div>
        </CardHeader>
        <CardContent className="flex-1 p-0">
          <ScrollArea className="h-full">
            {chats.length === 0 ? (
              <div className="p-4 text-center text-gray-500">
                <p>Nenhuma conversa encontrada</p>
                <p className="text-sm">Verifique se o WhatsApp está conectado</p>
              </div>
            ) : (
              chats.map((chat) => (
                <div
                  key={chat.id}
                  onClick={() => setSelectedChat(chat.id)}
                  className={`p-4 border-b cursor-pointer hover:bg-gray-50 ${
                    selectedChat === chat.id ? 'bg-green-50 border-r-2 border-r-green-500' : ''
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    <div className="relative">
                      <Avatar className="w-12 h-12">
                        <AvatarFallback>{chat.name.charAt(0)}</AvatarFallback>
                      </Avatar>
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
                          {chat.lastMessage?.body || 'Nenhuma mensagem'}
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
                      {currentChat.isGroup ? 'Grupo' : 'Contato'}
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
              <ScrollArea className="h-96">
                <div className="space-y-4">
                  {messages.length === 0 ? (
                    <div className="text-center text-gray-500 py-8">
                      <p>Nenhuma mensagem nesta conversa</p>
                    </div>
                  ) : (
                    messages.map((message) => (
                      <div
                        key={message.id}
                        className={`flex ${message.fromMe ? 'justify-end' : 'justify-start'}`}
                      >
                        <div
                          className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                            message.fromMe
                              ? 'bg-green-500 text-white'
                              : 'bg-gray-100 text-gray-900'
                          }`}
                        >
                          <p className="text-sm">{message.body}</p>
                          <p className={`text-xs mt-1 ${
                            message.fromMe ? 'text-green-100' : 'text-gray-500'
                          }`}>
                            {formatTime(message.timestamp)}
                          </p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </ScrollArea>
            </CardContent>

            {/* Message Input */}
            <div className="border-t p-4">
              <div className="flex space-x-2">
                <Button variant="ghost" size="sm">
                  <Paperclip className="w-4 h-4" />
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
                  disabled={!newMessage.trim()}
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
