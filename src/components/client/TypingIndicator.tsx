
import React from 'react';
import { Loader2, Mic, MessageCircle } from 'lucide-react';

interface TypingIndicatorProps {
  isTyping: boolean;
  isRecording: boolean;
  senderName?: string;
}

const TypingIndicator: React.FC<TypingIndicatorProps> = ({ 
  isTyping, 
  isRecording, 
  senderName = "Assistente" 
}) => {
  if (!isTyping && !isRecording) return null;

  return (
    <div className="flex items-center space-x-3 p-3 bg-gray-100 rounded-2xl mb-3 max-w-xs animate-pulse">
      <div className="flex items-center space-x-2">
        {isRecording ? (
          <div className="flex items-center space-x-2">
            <Mic className="w-4 h-4 text-red-500 animate-pulse" />
            <div className="flex space-x-1">
              <div className="w-1 h-4 bg-red-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
              <div className="w-1 h-4 bg-red-400 rounded-full animate-bounce" style={{ animationDelay: '100ms' }}></div>
              <div className="w-1 h-4 bg-red-400 rounded-full animate-bounce" style={{ animationDelay: '200ms' }}></div>
            </div>
          </div>
        ) : (
          <div className="flex items-center space-x-2">
            <MessageCircle className="w-4 h-4 text-blue-500" />
            <div className="flex space-x-1">
              <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
              <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
              <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
            </div>
          </div>
        )}
      </div>
      <span className="text-xs text-gray-600 font-medium">
        {senderName} está {isRecording ? 'gravando áudio' : 'digitando'}...
      </span>
    </div>
  );
};

export default TypingIndicator;
