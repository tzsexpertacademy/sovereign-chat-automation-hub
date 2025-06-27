
import React from 'react';
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Send } from "lucide-react";
import SimpleAudioRecorder from '@/components/chat/SimpleAudioRecorder';

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
  return (
    <div className="p-4 border-t bg-white">
      <div className="flex items-end space-x-2">
        <div className="flex-1">
          <Textarea
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyPress={onKeyPress}
            placeholder={connectedInstance ? "Digite sua mensagem..." : "Conecte uma instância para enviar mensagens"}
            className="min-h-[60px] max-h-[120px] resize-none"
            disabled={!connectedInstance || isSending}
          />
        </div>
        
        <div className="flex items-center space-x-1">
          <SimpleAudioRecorder
            onAudioReady={onAudioReady}
            maxDuration={60}
            className="h-10 w-10"
          />
          
          <Button
            onClick={onSendMessage}
            disabled={!newMessage.trim() || !connectedInstance || isSending}
            size="icon"
            className="h-10 w-10"
          >
            {isSending ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default MessageInput;
