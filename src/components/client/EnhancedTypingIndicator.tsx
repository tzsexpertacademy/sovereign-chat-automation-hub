
import React from 'react';
import { Loader2, Mic, Bot, Wifi } from 'lucide-react';

interface EnhancedTypingIndicatorProps {
  isTyping?: boolean;
  isRecording?: boolean;
  isOnline?: boolean;
  userName?: string;
  showOnlineStatus?: boolean;
  showAIBranding?: boolean;
  estimatedDuration?: number;
}

const EnhancedTypingIndicator: React.FC<EnhancedTypingIndicatorProps> = ({ 
  isTyping = false, 
  isRecording = false,
  isOnline = false,
  userName = "Assistente IA",
  showOnlineStatus = true,
  showAIBranding = true,
  estimatedDuration
}) => {
  if (!isTyping && !isRecording && (!showOnlineStatus || !isOnline)) {
    return null;
  }

  return (
    <div className="flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-gray-50 to-blue-50 border-t">
      {/* Status Online Aprimorado */}
      {showOnlineStatus && isOnline && !isTyping && !isRecording && (
        <div className="flex items-center space-x-2 text-green-600">
          <div className="relative">
            <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse" />
            <div className="absolute inset-0 w-3 h-3 bg-green-400 rounded-full animate-ping opacity-50" />
          </div>
          <Wifi className="w-4 h-4" />
          <span className="text-sm font-medium">
            {showAIBranding ? "🤖 IA Online" : "Online"}
          </span>
        </div>
      )}
      
      {/* Indicador de Digitação Aprimorado */}
      {isTyping && (
        <div className="flex items-center space-x-2 text-blue-600">
          <Loader2 className="w-4 h-4 animate-spin" />
          {showAIBranding && <Bot className="w-4 h-4" />}
          <span className="text-sm font-medium">
            {userName} está digitando...
          </span>
          <div className="flex space-x-1">
            <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
            <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
            <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
          </div>
          {estimatedDuration && (
            <span className="text-xs text-blue-400">
              (~{Math.ceil(estimatedDuration / 1000)}s)
            </span>
          )}
        </div>
      )}

      {/* Indicador de Gravação Aprimorado */}
      {isRecording && (
        <div className="flex items-center space-x-2 text-red-600">
          <Mic className="w-4 h-4 animate-pulse" />
          {showAIBranding && <Bot className="w-4 h-4" />}
          <span className="text-sm font-medium">
            {userName} está gravando áudio...
          </span>
          <div className="flex space-x-1">
            <div className="w-1 h-4 bg-red-500 rounded animate-pulse" style={{ animationDelay: '0ms' }} />
            <div className="w-1 h-6 bg-red-500 rounded animate-pulse" style={{ animationDelay: '100ms' }} />
            <div className="w-1 h-3 bg-red-500 rounded animate-pulse" style={{ animationDelay: '200ms' }} />
            <div className="w-1 h-5 bg-red-500 rounded animate-pulse" style={{ animationDelay: '300ms' }} />
            <div className="w-1 h-4 bg-red-500 rounded animate-pulse" style={{ animationDelay: '400ms' }} />
          </div>
          {estimatedDuration && (
            <span className="text-xs text-red-400">
              (~{Math.ceil(estimatedDuration / 1000)}s)
            </span>
          )}
        </div>
      )}
    </div>
  );
};

export default EnhancedTypingIndicator;
