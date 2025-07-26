
import React from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Bot, User, Mic } from 'lucide-react';
import MessageStatus from '../MessageStatus';
import AudioPlayer from '../AudioPlayer';
import { MessageStatus as MessageStatusType } from '@/hooks/useMessageStatus';

interface MessagesListProps {
  messages: any[];
  scrollAreaRef: React.RefObject<HTMLDivElement>;
  getMessageStatus: (messageId: string) => 'sending' | 'sent' | 'delivered' | 'read' | 'failed';
}

const MessagesList = ({ messages, scrollAreaRef, getMessageStatus }: MessagesListProps) => {
const renderMessageContent = (message: any) => {
    if (message.message_type === 'audio') {
      return (
        <div className="space-y-3 max-w-sm">
          {/* Player de áudio híbrido - URL + Base64 */}
          <AudioPlayer 
            audioUrl={message.media_url}
            audioData={message.audio_base64}
            duration={message.media_duration}
            fileName={`audio_${message.message_id || message.id}.ogg`}
            messageId={message.message_id}
            mediaKey={message.media_key}
            fileEncSha256={message.file_enc_sha256}
          />
          
          {/* Informações do áudio */}
          <div className="flex items-center gap-2 text-xs text-gray-600">
            <Mic className="w-3 h-3" />
            <span>Mensagem de áudio</span>
            {message.media_duration && (
              <span>• {message.media_duration}s</span>
            )}
          </div>
          
          {/* Status de processamento da transcrição */}
          {message.processing_status && ['pending_transcription', 'processing_transcription'].includes(message.processing_status) && (
            <div className="flex items-center gap-2 text-xs">
              <div className="w-3 h-3 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
              <span className="text-blue-600">
                {message.processing_status === 'pending_transcription' ? 'Preparando transcrição...' : 'Transcrevendo áudio...'}
              </span>
            </div>
          )}
          
          {/* Transcrição bem-sucedida */}
          {(message.transcription || message.media_transcription) && 
           !(message.transcription || message.media_transcription).includes('Erro') && 
           !(message.transcription || message.media_transcription).includes('não disponível') && (
            <div className="text-xs bg-blue-50 p-3 rounded-lg border-l-4 border-blue-300">
              <div className="flex items-start gap-2">
                <span className="text-blue-600">💬</span>
                <div>
                  <strong className="text-blue-800">Transcrição:</strong>
                  <p className="text-blue-700 mt-1">{message.transcription || message.media_transcription}</p>
                </div>
              </div>
            </div>
          )}
          
          {/* Status de erro na transcrição (player sempre funciona) */}
          {message.processing_status === 'transcription_failed' && (
            <div className="text-xs text-amber-600 bg-amber-50 p-2 rounded border border-amber-200 flex items-center gap-2">
              <span className="text-amber-500">⚠️</span> 
              <span>Transcrição indisponível</span>
              <button 
                className="text-amber-700 hover:text-amber-800 underline ml-auto"
                onClick={() => {/* Implementar retry se necessário */}}
              >
                Tentar novamente
              </button>
            </div>
          )}
          
          {/* Erro geral de transcrição */}
          {(message.transcription || message.media_transcription) && 
           ((message.transcription || message.media_transcription).includes('Erro') || 
            (message.transcription || message.media_transcription).includes('não disponível')) && (
            <div className="text-xs text-red-600 bg-red-50 p-2 rounded border border-red-200">
              <span className="text-red-500">❌</span> Problema na transcrição - áudio pode ser reproduzido
            </div>
          )}
        </div>
      );
    }

    let content = message.content;
    
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const parts = content.split(urlRegex);
    
    return parts.map((part: string, index: number) => {
      if (urlRegex.test(part)) {
        return (
          <a
            key={index}
            href={part}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-500 hover:text-blue-700 underline"
          >
            {part}
          </a>
        );
      }
      return part;
    });
  };

  if (messages.length === 0) {
    return (
      <ScrollArea ref={scrollAreaRef} className="flex-1 p-4">
        <div className="text-center text-gray-500 py-8">
          <p>Nenhuma mensagem nesta conversa</p>
          <p className="text-sm">Inicie uma conversa enviando uma mensagem</p>
        </div>
      </ScrollArea>
    );
  }

  return (
    <ScrollArea ref={scrollAreaRef} className="flex-1 p-4">
      <div className="space-y-4">
        {messages.map((message) => (
          <div
            key={`${message.id}-${message.timestamp}`}
            className={`flex gap-3 ${message.from_me ? 'justify-end' : 'justify-start'}`}
          >
            {!message.from_me && (
              <Avatar className="w-8 h-8 flex-shrink-0">
                <AvatarFallback>
                  {message.is_ai_response ? <Bot className="w-4 h-4" /> : <User className="w-4 h-4" />}
                </AvatarFallback>
              </Avatar>
            )}
            
            <div className={`max-w-[70%] ${message.from_me ? 'order-1' : 'order-2'}`}>
              <div
                className={`rounded-lg px-3 py-2 ${
                  message.from_me
                    ? 'bg-blue-500 text-white'
                    : message.is_ai_response
                    ? 'bg-green-100 text-green-900 border border-green-200'
                    : 'bg-gray-100 text-gray-900'
                }`}
              >
                {!message.from_me && (
                  <div className="flex items-center gap-1 mb-1">
                    <span className="text-xs font-medium">
                      {message.sender_name}
                    </span>
                    {message.is_ai_response && (
                      <Bot className="w-3 h-3" />
                    )}
                  </div>
                )}
                
                <div className="text-sm break-words whitespace-pre-wrap">
                  {renderMessageContent(message)}
                </div>
              </div>
              
              <div className="mt-1">
                <MessageStatus 
                  status={getMessageStatus(message.message_id)}
                  timestamp={message.timestamp}
                  fromMe={message.from_me}
                  isAiResponse={message.is_ai_response}
                />
              </div>
            </div>
            
            {message.from_me && (
              <Avatar className="w-8 h-8 flex-shrink-0">
                <AvatarFallback>
                  <User className="w-4 h-4" />
                </AvatarFallback>
              </Avatar>
            )}
          </div>
        ))}
      </div>
    </ScrollArea>
  );
};

export default MessagesList;
