import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { 
  Send, 
  Paperclip, 
  MoreVertical, 
  Clock, 
  Check, 
  CheckCheck,
  Mic,
  MicOff,
  Play,
  Pause,
  Download,
  Eye,
  EyeOff,
  User,
  Bot,
  Phone,
  Mail,
  Calendar,
  MessageSquare,
  Archive,
  AlertCircle,
  ArrowDown,
  Reply
} from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { ticketsService, type TicketMessage } from '@/services/ticketsService';
import { whatsappService } from '@/services/whatsappMultiClient';
import { useTicketMessages } from '@/hooks/useTicketMessages';
import { useMessageMedia } from '@/hooks/useMessageMedia';
import { audioService } from '@/services/audioService';
import TypingIndicator from './TypingIndicator';
import MessageStatus from './MessageStatus';

interface TicketChatInterfaceProps {
  clientId: string;
  ticketId: string;
}

interface ChatMessageProps {
  message: TicketMessage;
  isLastMessage: boolean;
}

const ChatMessage: React.FC<ChatMessageProps> = ({ message, isLastMessage }) => {
  const [showFullText, setShowFullText] = useState(false);
  const [mediaUrl, setMediaUrl] = useState<string | null>(null);
  const [mediaType, setMediaType] = useState<'image' | 'video' | 'audio' | 'document' | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMediaVisible, setIsMediaVisible] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);
  const { toast } = useToast();
  const { getMediaUrl } = useMessageMedia();

  const toggleTextVisibility = () => {
    setShowFullText(!showFullText);
  };

  const toggleMediaVisibility = () => {
    setIsMediaVisible(!isMediaVisible);
  };

  const handleDownload = async () => {
    try {
      if (!mediaUrl) {
        toast({
          title: "Erro ao baixar mídia",
          description: "URL da mídia não disponível.",
          variant: "destructive",
        });
        return;
      }

      const link = document.createElement('a');
      link.href = mediaUrl;
      link.setAttribute('download', message.message_id);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast({
        title: "Download iniciado",
        description: "O download da mídia foi iniciado.",
      });
    } catch (error) {
      console.error("Erro ao iniciar o download:", error);
      toast({
        title: "Erro ao baixar mídia",
        description: "Ocorreu um erro ao iniciar o download.",
        variant: "destructive",
      });
    }
  };

  const handlePlayPause = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  useEffect(() => {
    const loadMedia = async () => {
      if (message.media_url) {
        try {
          const { url, type } = await getMediaUrl(message.media_url);
          setMediaUrl(url);
          setMediaType(type);
        } catch (error) {
          console.error("Erro ao carregar mídia:", error);
          toast({
            title: "Erro ao carregar mídia",
            description: "Não foi possível carregar a mídia.",
            variant: "destructive",
          });
        }
      }
    };

    loadMedia();
  }, [message.media_url, getMediaUrl, toast]);

  return (
    <div className={`mb-2 flex ${message.from_me ? 'items-end justify-end' : 'items-start'}`}>
      <div className="flex flex-col space-y-1 text-sm max-w-[75%]">
        <div className={`flex flex-col ${message.from_me ? 'items-end' : 'items-start'}`}>
          <div className={`px-3 py-2 rounded-lg ${message.from_me ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-900'}`}>
            {/* Header da mensagem */}
            <div className="flex items-center justify-between">
              <span className="font-medium">{message.sender_name}</span>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="h-8 w-8 p-0">
                    <span className="sr-only">Abrir menu</span>
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => {
                    navigator.clipboard.writeText(message.content);
                    toast({
                      title: "Copiado para a área de transferência",
                      description: "O texto da mensagem foi copiado.",
                    });
                  }}>
                    Copiar texto
                  </DropdownMenuItem>
                  {mediaUrl && (
                    <DropdownMenuItem onClick={handleDownload}>
                      Baixar mídia
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem>
                    Marcar como não lida
                  </DropdownMenuItem>
                  <DropdownMenuItem className="text-red-600">
                    Reportar
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {/* Conteúdo da mensagem */}
            {message.message_type === 'text' && (
              <p className="break-words">
                {showFullText ? message.content : `${message.content.substring(0, 200)}${message.content.length > 200 ? '...' : ''}`}
                {message.content.length > 200 && (
                  <Button variant="link" onClick={toggleTextVisibility} className="p-0">
                    {showFullText ? "Mostrar menos" : "Mostrar mais"}
                  </Button>
                )}
              </p>
            )}

            {/* Tipos de mídia */}
            {mediaUrl && mediaType === 'image' && (
              <div>
                <Button variant="link" onClick={toggleMediaVisibility} className="p-0">
                  {isMediaVisible ? <EyeOff className="w-4 h-4 mr-2" /> : <Eye className="w-4 h-4 mr-2" />}
                  {isMediaVisible ? "Ocultar Imagem" : "Mostrar Imagem"}
                </Button>
                {isMediaVisible && (
                  <img src={mediaUrl} alt="Imagem" className="max-w-full h-auto rounded-md" />
                )}
              </div>
            )}

            {mediaUrl && mediaType === 'video' && (
              <div>
                <Button variant="link" onClick={toggleMediaVisibility} className="p-0">
                  {isMediaVisible ? <EyeOff className="w-4 h-4 mr-2" /> : <Eye className="w-4 h-4 mr-2" />}
                  {isMediaVisible ? "Ocultar Vídeo" : "Mostrar Vídeo"}
                </Button>
                {isMediaVisible && (
                  <video src={mediaUrl} controls className="max-w-full h-auto rounded-md" />
                )}
              </div>
            )}

            {mediaUrl && mediaType === 'audio' && (
              <div>
                <audio ref={audioRef} src={mediaUrl} />
                <Button variant="link" onClick={handlePlayPause} className="p-0">
                  {isPlaying ? <Pause className="w-4 h-4 mr-2" /> : <Play className="w-4 h-4 mr-2" />}
                  {isPlaying ? "Pausar Áudio" : "Reproduzir Áudio"}
                </Button>
              </div>
            )}

            {mediaUrl && mediaType === 'document' && (
              <div>
                <Button variant="link" onClick={handleDownload} className="p-0">
                  <Download className="w-4 h-4 mr-2" />
                  Baixar Documento
                </Button>
              </div>
            )}

            {/* Rodapé da mensagem */}
            <div className="flex items-center justify-between text-xs mt-1">
              <span className="text-gray-400">
                {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
              {message.from_me && isLastMessage && (
                <MessageStatus status={message.processing_status} />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const TicketChatInterface = ({ clientId, ticketId }: TicketChatInterfaceProps) => {
  const [inputMessage, setInputMessage] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [audioChunks, setAudioChunks] = useState<Blob[]>([]);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [isTyping, setIsTyping] = useState(false);
  const [selectedAttachment, setSelectedAttachment] = useState<File | null>(null);
  const chatBottomRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const { messages, isLoading, sendMessage, reloadMessages } = useTicketMessages(clientId, ticketId);

  const scrollToBottom = useCallback(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputMessage(e.target.value);
  };

  const handleSendMessage = async () => {
    if (inputMessage.trim() !== '') {
      setIsTyping(true);
      try {
        await sendMessage(inputMessage);
        setInputMessage('');
      } catch (error) {
        toast({
          title: "Erro ao enviar mensagem",
          description: "Por favor, tente novamente.",
          variant: "destructive",
        });
      } finally {
        setIsTyping(false);
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      setMediaRecorder(recorder);
      setIsRecording(true);
      setAudioChunks([]);

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          setAudioChunks((prev) => [...prev, event.data]);
        }
      };

      recorder.onstop = () => {
        setIsRecording(false);
        stream.getTracks().forEach(track => track.stop());
      };

      recorder.start();
    } catch (error) {
      console.error("Erro ao iniciar gravação:", error);
      toast({
        title: "Erro ao gravar áudio",
        description: "Permissão negada ou nenhum microfone encontrado.",
        variant: "destructive",
      });
      setIsRecording(false);
    }
  };

  const stopRecording = () => {
    if (mediaRecorder && mediaRecorder.state === 'recording') {
      mediaRecorder.stop();
    }
  };

  const sendAudioMessage = async () => {
    if (audioChunks.length > 0) {
      setIsTyping(true);
      try {
        const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
        const audioFile = new File([audioBlob], "audio_message.webm", { type: 'audio/webm' });
        await sendMessage('', audioFile);
        setAudioChunks([]);
      } catch (error) {
        console.error("Erro ao enviar áudio:", error);
        toast({
          title: "Erro ao enviar áudio",
          description: "Por favor, tente novamente.",
          variant: "destructive",
        });
      } finally {
        setIsTyping(false);
      }
    }
  };

  const handleAttachmentChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedAttachment(file);
    }
  };

  const handleSendAttachment = async () => {
    if (selectedAttachment) {
      setIsTyping(true);
      try {
        await sendMessage('', selectedAttachment);
        setSelectedAttachment(null);
      } catch (error) {
        console.error("Erro ao enviar anexo:", error);
        toast({
          title: "Erro ao enviar anexo",
          description: "Por favor, tente novamente.",
          variant: "destructive",
        });
      } finally {
        setIsTyping(false);
      }
    }
  };

  return (
    <div className="flex h-full">
      {/* Barra lateral (removida) */}

      {/* Área principal do chat */}
      <div className="flex-1 flex flex-col">
        {/* Cabeçalho */}
        <div className="border-b p-4">
          <div className="font-semibold">Chat</div>
        </div>

        {/* Área de mensagens */}
        <div className="flex-1 overflow-y-auto p-4">
          <ScrollArea className="h-full">
            {isLoading ? (
              <div className="text-center text-gray-500">Carregando mensagens...</div>
            ) : (
              messages.map((message, index) => (
                <ChatMessage
                  key={message.message_id}
                  message={message}
                  isLastMessage={index === messages.length - 1}
                />
              ))
            )}
            <div ref={chatBottomRef} />
          </ScrollArea>
        </div>

        {/* Indicadores de status */}
        {(isRecording || isTyping) && (
          <div className="px-4 py-2 border-t bg-gray-50">
            {isRecording && (
              <TypingIndicator 
                isTyping={true}
                isRecording={false}
                userName="Você"
              />
            )}
            {isTyping && (
              <TypingIndicator 
                isTyping={true}
                isRecording={isRecording}
                userName="Você"
              />
            )}
          </div>
        )}

        {/* Área de entrada de mensagem */}
        <div className="p-4 border-t bg-gray-50">
          <div className="flex items-center space-x-2">
            {/* Input de texto */}
            <Input
              type="text"
              placeholder="Digite sua mensagem..."
              value={inputMessage}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              disabled={isRecording}
              className="flex-1"
            />

            {/* Botão de anexo */}
            <div className="relative">
              <input
                type="file"
                id="attachment-input"
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                onChange={handleAttachmentChange}
                disabled={isRecording}
              />
              <label htmlFor="attachment-input" className="cursor-pointer">
                <Button variant="outline" size="icon" disabled={isRecording}>
                  <Paperclip className="w-4 h-4" />
                </Button>
              </label>
            </div>

            {/* Botão de enviar anexo */}
            {selectedAttachment && (
              <Button variant="secondary" size="sm" onClick={handleSendAttachment} disabled={isRecording}>
                Enviar Anexo
              </Button>
            )}

            {/* Botão de gravar áudio / enviar mensagem */}
            {isRecording ? (
              <Button variant="destructive" size="icon" onClick={stopRecording}>
                <MicOff className="w-4 h-4" />
              </Button>
            ) : (
              <Button variant="primary" size="icon" onClick={inputMessage.trim() ? handleSendMessage : startRecording}>
                {inputMessage.trim() ? <Send className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              </Button>
            )}

            {/* Botão de enviar áudio (se houver gravação) */}
            {audioChunks.length > 0 && !isRecording && (
              <Button variant="secondary" size="sm" onClick={sendAudioMessage}>
                Enviar Áudio
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default TicketChatInterface;
