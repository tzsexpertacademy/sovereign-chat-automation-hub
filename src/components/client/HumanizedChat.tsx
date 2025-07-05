import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Send, Bot, User, Loader2, Mic, Image, FileText, MapPin, Phone, Heart, ThumbsUp, Smile } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useHumanizedWhatsApp } from "@/hooks/useHumanizedWhatsApp";
import { humanizedWhatsAppService } from "@/services/humanizedWhatsAppService";

interface Message {
  id: string;
  type: 'text' | 'media' | 'reaction' | 'typing' | 'recording';
  content: string;
  fromMe: boolean;
  timestamp: Date;
  humanizedMetadata?: {
    personality: string;
    emotionalTone: string;
    responseDelay: number;
    confidence: number;
  };
}

interface HumanizedChatProps {
  clientId: string;
  chatId: string;
  chatName: string;
}

const HumanizedChat = ({ clientId, chatId, chatName }: HumanizedChatProps) => {
  const { toast } = useToast();
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Initialize humanized WhatsApp
  const humanizedWhatsApp = useHumanizedWhatsApp(clientId, {
    enabled: true,
    personality: {
      name: 'Chat Assistant',
      tone: 'friendly',
      responseDelay: { min: 2000, max: 4000 },
      typingSpeed: 45,
      reactionProbability: 0.4,
      emotionalLevel: 0.7,
      contextAwareness: true,
      voiceCloning: false,
      audioProcessing: true
    }
  });

  const stats = humanizedWhatsApp.getHumanizationStats();

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Simulate receiving messages for demo
  useEffect(() => {
    const demoMessages: Message[] = [
      {
        id: "demo1",
        type: "text",
        content: "Oi! Como você está hoje? 😊",
        fromMe: false,
        timestamp: new Date(Date.now() - 300000),
        humanizedMetadata: {
          personality: "Chat Assistant",
          emotionalTone: "friendly",
          responseDelay: 2500,
          confidence: 0.95
        }
      },
      {
        id: "demo2",
        type: "text",
        content: "Estou bem, obrigado! E você?",
        fromMe: true,
        timestamp: new Date(Date.now() - 240000)
      },
      {
        id: "demo3",
        type: "text",
        content: "Ótimo! Posso ajudar você com alguma coisa? 🤔",
        fromMe: false,
        timestamp: new Date(Date.now() - 180000),
        humanizedMetadata: {
          personality: "Chat Assistant",
          emotionalTone: "helpful",
          responseDelay: 3200,
          confidence: 0.92
        }
      }
    ];

    setMessages(demoMessages);
  }, []);

  const sendMessage = async () => {
    if (!inputMessage.trim()) return;

    const userMessage: Message = {
      id: `msg_${Date.now()}`,
      type: "text",
      content: inputMessage,
      fromMe: true,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputMessage("");
    setIsLoading(true);

    try {
      // Process message through humanized system
      humanizedWhatsApp.processIncomingMessage({
        id: userMessage.id,
        from: chatId,
        body: inputMessage,
        fromMe: false,
        timestamp: Date.now()
      });

      // Simulate AI response after humanized delay
      setTimeout(async () => {
        const responses = [
          "Entendo! Isso é muito interessante 🤔",
          "Que legal! Conte-me mais sobre isso 😊",
          "Hmm, deixe-me pensar sobre isso... 💭",
          "Ótima pergunta! Vou te ajudar com isso 👍",
          "Perfeito! Vamos resolver isso juntos 🚀"
        ];

        const randomResponse = responses[Math.floor(Math.random() * responses.length)];

        const aiMessage: Message = {
          id: `ai_${Date.now()}`,
          type: "text",
          content: randomResponse,
          fromMe: false,
          timestamp: new Date(),
          humanizedMetadata: {
            personality: stats.personality.name,
            emotionalTone: "helpful",
            responseDelay: Math.random() * 2000 + 2000,
            confidence: 0.85 + Math.random() * 0.15
          }
        };

        setMessages(prev => [...prev, aiMessage]);
        setIsLoading(false);
      }, Math.random() * 3000 + 2000);

    } catch (error) {
      console.error('Erro ao processar mensagem:', error);
      toast({
        title: "Erro",
        description: "Erro ao processar mensagem",
        variant: "destructive"
      });
      setIsLoading(false);
    }
  };

  const sendReaction = async (emoji: string) => {
    const reaction: Message = {
      id: `reaction_${Date.now()}`,
      type: "reaction",
      content: emoji,
      fromMe: true,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, reaction]);
    
    // Auto-react back with humanized delay
    setTimeout(() => {
      const autoReaction: Message = {
        id: `auto_reaction_${Date.now()}`,
        type: "reaction",
        content: "❤️",
        fromMe: false,
        timestamp: new Date(),
        humanizedMetadata: {
          personality: stats.personality.name,
          emotionalTone: "appreciative",
          responseDelay: 1500,
          confidence: 0.9
        }
      };
      setMessages(prev => [...prev, autoReaction]);
    }, 1500 + Math.random() * 1000);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto h-[calc(100vh-200px)] flex flex-col">
      <Card className="flex-1 flex flex-col">
        <CardHeader className="flex-shrink-0">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Bot className="h-5 w-5" />
                Chat Humanizado - {chatName}
              </CardTitle>
              <CardDescription>
                Personalidade: {stats.personality.name} • Tom: {stats.personality.tone}
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Badge variant={stats.onlineStatus ? "default" : "secondary"}>
                {stats.onlineStatus ? "Online" : "Offline"}
              </Badge>
              <Badge variant={stats.isProcessing ? "default" : "outline"}>
                {stats.isProcessing ? "Processando" : "Pronto"}
              </Badge>
            </div>
          </div>
        </CardHeader>

        <CardContent className="flex-1 flex flex-col p-4 min-h-0">
          {/* Messages Area */}
          <ScrollArea className="flex-1 mb-4">
            <div className="space-y-4 pr-4">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex gap-3 ${
                    message.fromMe ? 'justify-end' : 'justify-start'
                  }`}
                >
                  <div
                    className={`flex gap-2 max-w-[80%] ${
                      message.fromMe ? 'flex-row-reverse' : 'flex-row'
                    }`}
                  >
                    <div className="flex-shrink-0">
                      {message.fromMe ? (
                        <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center">
                          <User className="h-4 w-4 text-primary-foreground" />
                        </div>
                      ) : (
                        <div className="w-8 h-8 bg-secondary rounded-full flex items-center justify-center">
                          <Bot className="h-4 w-4 text-secondary-foreground" />
                        </div>
                      )}
                    </div>
                    
                    <div className="space-y-1">
                      <div
                        className={`rounded-lg p-3 ${
                          message.type === 'reaction' 
                            ? 'bg-transparent text-2xl' 
                            : message.fromMe
                              ? 'bg-primary text-primary-foreground'
                              : 'bg-secondary text-secondary-foreground'
                        }`}
                      >
                        <p className="text-sm whitespace-pre-wrap break-words">
                          {message.content}
                        </p>
                      </div>
                      
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>{message.timestamp.toLocaleTimeString()}</span>
                        {message.humanizedMetadata && (
                          <>
                            <Badge variant="outline" className="text-xs">
                              {message.humanizedMetadata.personality}
                            </Badge>
                            <Badge variant="outline" className="text-xs">
                              {Math.round(message.humanizedMetadata.confidence * 100)}%
                            </Badge>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              
              {isLoading && (
                <div className="flex gap-3 justify-start">
                  <div className="flex gap-2">
                    <div className="w-8 h-8 bg-secondary rounded-full flex items-center justify-center">
                      <Bot className="h-4 w-4 text-secondary-foreground" />
                    </div>
                    <div className="bg-secondary rounded-lg p-3">
                      <div className="flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span className="text-sm">Assistente está digitando...</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
              
              <div ref={messagesEndRef} />
            </div>
          </ScrollArea>

          {/* Quick Reactions */}
          <div className="flex gap-2 mb-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => sendReaction("👍")}
            >
              <ThumbsUp className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => sendReaction("❤️")}
            >
              <Heart className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => sendReaction("😊")}
            >
              <Smile className="h-4 w-4" />
            </Button>
          </div>

          {/* Input Area */}
          <div className="flex gap-2">
            <div className="flex-1">
              <Textarea
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Digite sua mensagem..."
                disabled={isLoading}
                className="min-h-[44px] max-h-32 resize-none"
                rows={1}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Button
                onClick={sendMessage}
                disabled={!inputMessage.trim() || isLoading}
                size="icon"
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>

          {/* Stats Display */}
          <div className="mt-4 text-xs text-muted-foreground flex gap-4">
            <span>Conversas: {stats.conversationContexts}</span>
            <span>Logs: {stats.totalLogs}</span>
            <span>Lotes Ativos: {stats.activeBatches}</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default HumanizedChat;