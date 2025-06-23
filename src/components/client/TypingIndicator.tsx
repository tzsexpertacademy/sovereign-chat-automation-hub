
import React from 'react';
import { Loader2, Mic } from 'lucide-react';

interface TypingIndicatorProps {
  isTyping?: boolean;
  isRecording?: boolean;
  isOnline?: boolean;
  userName?: string;
  showOnlineStatus?: boolean;
}

const TypingIndicator: React.FC<TypingIndicatorProps> = ({ 
  isTyping = false, 
  isRecording = false,
  isOnline = false,
  userName = "Assistente",
  showOnlineStatus = true
}) => {
  if (!isTyping && !isRecording && (!showOnlineStatus || !isOnline)) {
    return null;
  }

  return (
    <div className="flex items-center space-x-2 px-4 py-2 bg-gray-50 border-t">
      {/* Status Online */}
      {showOnlineStatus && isOnline && !isTyping && !isRecording && (
        <div className="flex items-center space-x-2 text-green-600">
          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
          <span className="text-xs font-medium">Online</span>
        </div>
      )}
      
      {/* Indicador de Digitação */}
      {isTyping && (
        <div className="flex items-center space-x-2 text-blue-600">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span className="text-sm">{userName} está digitando...</span>
          <div className="flex space-x-1">
            <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
            <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
            <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
          </div>
        </div>
      )}

      {/* Indicador de Gravação */}
      {isRecording && (
        <div className="flex items-center space-x-2 text-red-600">
          <Mic className="w-4 h-4 animate-pulse" />
          <span className="text-sm">{userName} está gravando áudio...</span>
          <div className="flex space-x-1">
            <div className="w-1 h-4 bg-red-500 rounded animate-pulse" style={{ animationDelay: '0ms' }} />
            <div className="w-1 h-6 bg-red-500 rounded animate-pulse" style={{ animationDelay: '100ms' }} />
            <div className="w-1 h-3 bg-red-500 rounded animate-pulse" style={{ animationDelay: '200ms' }} />
            <div className="w-1 h-5 bg-red-500 rounded animate-pulse" style={{ animationDelay: '300ms' }} />
          </div>
        </div>
      )}
    </div>
  );
};

export default TypingIndicator;
