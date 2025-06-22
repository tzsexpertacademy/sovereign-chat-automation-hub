
import React from 'react';
import { Loader2, Mic, Wifi } from 'lucide-react';

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
  isOnline = true, // SEMPRE ONLINE POR PADRÃO
  userName = "🤖 Assistente IA",
  showOnlineStatus = true
}) => {
  return (
    <div className="flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-blue-50 to-green-50 border-t border-blue-200">
      {/* Status Online SEMPRE VISÍVEL */}
      {showOnlineStatus && (
        <div className="flex items-center space-x-2 text-green-600">
          <div className="relative">
            <Wifi className="w-4 h-4" />
            <div className="absolute -top-1 -right-1 w-2 h-2 bg-green-500 rounded-full animate-pulse" />
          </div>
          <span className="text-xs font-medium">Online</span>
        </div>
      )}
      
      {/* Indicador de Digitação */}
      {isTyping && (
        <>
          <div className="w-px h-4 bg-gray-300 mx-1" />
          <div className="flex items-center space-x-2 text-blue-600">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span className="text-sm font-medium">{userName} está digitando...</span>
            <div className="flex space-x-1">
              <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
              <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
              <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
          </div>
        </>
      )}

      {/* Indicador de Gravação */}
      {isRecording && (
        <>
          <div className="w-px h-4 bg-gray-300 mx-1" />
          <div className="flex items-center space-x-2 text-red-600">
            <Mic className="w-4 h-4 animate-pulse" />
            <span className="text-sm font-medium">{userName} está gravando áudio...</span>
            <div className="flex space-x-1">
              <div className="w-1 h-4 bg-red-500 rounded animate-pulse" style={{ animationDelay: '0ms' }} />
              <div className="w-1 h-6 bg-red-500 rounded animate-pulse" style={{ animationDelay: '100ms' }} />
              <div className="w-1 h-3 bg-red-500 rounded animate-pulse" style={{ animationDelay: '200ms' }} />
              <div className="w-1 h-5 bg-red-500 rounded animate-pulse" style={{ animationDelay: '300ms' }} />
              <div className="w-1 h-4 bg-red-500 rounded animate-pulse" style={{ animationDelay: '400ms' }} />
            </div>
          </div>
        </>
      )}

      {/* Mensagem padrão quando não está digitando nem gravando */}
      {!isTyping && !isRecording && (
        <>
          <div className="w-px h-4 bg-gray-300 mx-1" />
          <span className="text-sm text-gray-600">Pronto para responder</span>
        </>
      )}
    </div>
  );
};

export default TypingIndicator;
