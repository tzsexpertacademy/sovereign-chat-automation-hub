
import React from 'react';
import { Loader2, Mic } from 'lucide-react';

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
    <div className="flex items-center space-x-2 p-3 bg-gray-50 rounded-lg mb-2 animate-pulse">
      <div className="flex items-center space-x-2">
        {isRecording ? (
          <Mic className="w-4 h-4 text-red-500 animate-pulse" />
        ) : (
          <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />
        )}
        <span className="text-sm text-gray-600">
          {senderName} está {isRecording ? 'gravando áudio' : 'digitando'}...
        </span>
      </div>
      
      {!isRecording && (
        <div className="flex space-x-1">
          <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
          <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
          <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
        </div>
      )}
    </div>
  );
};

export default TypingIndicator;
