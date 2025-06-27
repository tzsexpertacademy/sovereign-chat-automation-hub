
import React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Send } from 'lucide-react';
import AudioRecorder from '../../chat/AudioRecorder';
import { getServerConfig, getAlternativeServerConfig } from '@/config/environment';

interface MessageInputProps {
  newMessage: string;
  setNewMessage: (message: string) => void;
  onSendMessage: () => void;
  onAudioReady: (audioBlob: Blob, duration: number) => void;
  connectedInstance: string | null;
  isSending: boolean;
  onKeyPress: (e: React.KeyboardEvent) => void;
}

const MessageInput = ({
  newMessage,
  setNewMessage,
  onSendMessage,
  onAudioReady,
  connectedInstance,
  isSending,
  onKeyPress
}: MessageInputProps) => {
  const currentConfig = getServerConfig();
  const hasAlternative = !!getAlternativeServerConfig();

  return (
    <div className="p-4 border-t bg-white">
      <div className="flex gap-2 items-end">
        <Input
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          onKeyPress={onKeyPress}
          placeholder={
            connectedInstance 
              ? "Digite sua mensagem..." 
              : "Conecte uma instância WhatsApp para enviar mensagens"
          }
          disabled={!connectedInstance || isSending}
          className="flex-1"
        />
        
        <AudioRecorder 
          onAudioReady={onAudioReady}
          maxDuration={60}
          className="flex-shrink-0"
        />
        
        <Button
          onClick={onSendMessage}
          disabled={!newMessage.trim() || !connectedInstance || isSending}
          size="sm"
          className="flex-shrink-0"
        >
          {isSending ? (
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <Send className="w-4 h-4" />
          )}
        </Button>
      </div>
      
      {/* Informações de debug melhoradas */}
      {process.env.NODE_ENV === 'development' && (
        <div className="mt-2 text-xs text-gray-500 space-y-1">
          <div>🌍 {currentConfig.environment}: {currentConfig.serverUrl}</div>
          <div>📱 Instância: {connectedInstance || 'Nenhuma'}</div>
          {hasAlternative && <div>🔄 Fallback disponível</div>}
        </div>
      )}
    </div>
  );
};

export default MessageInput;
