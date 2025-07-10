
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
  getMessageStatus: (messageId: string) => MessageStatusType;
}

const MessagesList = ({ messages, scrollAreaRef, getMessageStatus }: MessagesListProps) => {
  const renderMessageContent = (message: any) => {
    if (message.message_type === 'audio' && message.audio_base64) {
      return (
        <div className="space-y-2 max-w-sm">
          <AudioPlayer 
            audioUrl=""
            audioData={message.audio_base64}
            duration={message.media_duration}
            fileName={`audio_${message.id}.wav`}
          />
          {message.media_transcription && (
            <div className="text-xs opacity-75 bg-white/10 rounded p-2 mt-2">
              <strong>💬 Transcrição:</strong> {message.media_transcription}
            </div>
          )}
        </div>
      );
    }

    if (message.message_type === 'audio') {
      return (
        <div className="flex items-center gap-2 p-3 bg-gradient-to-r from-blue-50 to-blue-100 rounded-lg border border-blue-200">
          <Mic className="w-4 h-4 text-blue-600" />
          <div className="flex-1">
            <span className="text-sm font-medium text-blue-800">Mensagem de áudio</span>
            {message.media_duration && (
              <span className="text-xs text-blue-600 ml-2">({message.media_duration}s)</span>
            )}
            {message.media_transcription && (
              <div className="text-xs text-blue-700 mt-1 opacity-90">
                💬 {message.media_transcription}
              </div>
            )}
          </div>
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
