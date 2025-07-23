
import React, { useState } from 'react';
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Send } from "lucide-react";
import SimpleAudioRecorder from '@/components/chat/SimpleAudioRecorder';
import MediaUploadButton from '@/components/ui/MediaUploadButton';
import MediaPreview from '@/components/ui/MediaPreview';
import { useMessageMedia } from '@/hooks/useMessageMedia';

interface MessageInputProps {
  newMessage: string;
  setNewMessage: (message: string) => void;
  onSendMessage: () => void;
  onAudioReady: (audioBlob: Blob, duration: number) => void;
  connectedInstance: string | null;
  isSending: boolean;
  onKeyPress: (e: React.KeyboardEvent) => void;
  chatId: string;
}

const MessageInput = ({
  newMessage,
  setNewMessage,
  onSendMessage,
  onAudioReady,
  connectedInstance,
  isSending,
  onKeyPress,
  chatId
}: MessageInputProps) => {
  const [selectedFile, setSelectedFile] = useState<{ file: File; type: 'image' | 'video' | 'audio' | 'document' } | null>(null);
  const { isUploading, handleImageUpload, handleVideoUpload, handleAudioUpload, handleDocumentUpload } = useMessageMedia(connectedInstance || '');

  const handleFileSelect = (file: File, type: 'image' | 'video' | 'audio' | 'document') => {
    setSelectedFile({ file, type });
  };

  const handleMediaSend = async () => {
    if (!selectedFile || !chatId) return;

    const { file, type } = selectedFile;
    let success = false;

    switch (type) {
      case 'image':
        success = await handleImageUpload(file, chatId);
        break;
      case 'video':
        success = await handleVideoUpload(file, chatId);
        break;
      case 'audio':
        success = await handleAudioUpload(file, chatId);
        break;
      case 'document':
        success = await handleDocumentUpload(file, chatId);
        break;
    }

    if (success) {
      setSelectedFile(null);
    }
  };

  const handleMediaCancel = () => {
    setSelectedFile(null);
  };
  return (
    <div className="p-4 border-t bg-white">
      {selectedFile && (
        <MediaPreview
          file={selectedFile.file}
          type={selectedFile.type}
          onCancel={handleMediaCancel}
          onSend={handleMediaSend}
          isUploading={isUploading}
        />
      )}
      
      <div className="flex items-end space-x-2">
        <div className="flex-1">
          <Textarea
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyPress={onKeyPress}
            placeholder={connectedInstance ? "Digite sua mensagem..." : "Conecte uma instância para enviar mensagens"}
            className="min-h-[60px] max-h-[120px] resize-none"
            disabled={!connectedInstance || isSending || selectedFile !== null}
          />
        </div>
        
        <div className="flex items-center space-x-1">
          <MediaUploadButton
            onFileSelect={handleFileSelect}
            disabled={!connectedInstance || isSending || selectedFile !== null}
          />
          
          <SimpleAudioRecorder
            onAudioReady={onAudioReady}
            maxDuration={60}
            className="h-10 w-10"
          />
          
          <Button
            onClick={onSendMessage}
            disabled={!newMessage.trim() || !connectedInstance || isSending || selectedFile !== null}
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
