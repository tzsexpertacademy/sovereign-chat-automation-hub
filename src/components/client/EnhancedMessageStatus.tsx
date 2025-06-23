
import React from 'react';
import { Check, CheckCheck, Clock, XCircle, Bot } from 'lucide-react';

interface EnhancedMessageStatusProps {
  status: 'sending' | 'sent' | 'delivered' | 'read' | 'ai_read' | 'failed';
  timestamp: string;
  fromMe: boolean;
  isAIRead?: boolean;
  showAIIndicator?: boolean;
}

const EnhancedMessageStatus: React.FC<EnhancedMessageStatusProps> = ({ 
  status, 
  timestamp, 
  fromMe,
  isAIRead = false,
  showAIIndicator = true
}) => {
  if (!fromMe) return null;

  const getStatusIcon = () => {
    switch (status) {
      case 'sending':
        return <Clock className="w-3 h-3 text-gray-400 animate-pulse" />;
      case 'sent':
        return <Check className="w-3 h-3 text-gray-500" />;
      case 'delivered':
        return <CheckCheck className="w-3 h-3 text-gray-500" />;
      case 'read':
        return <CheckCheck className="w-3 h-3 text-blue-500" />;
      case 'ai_read':
        return (
          <div className="flex items-center space-x-1">
            <CheckCheck className="w-3 h-3 text-blue-500" />
            {showAIIndicator && <Bot className="w-3 h-3 text-blue-500" />}
          </div>
        );
      case 'failed':
        return <XCircle className="w-3 h-3 text-red-500" />;
      default:
        return <Check className="w-3 h-3 text-gray-500" />;
    }
  };

  const getStatusText = () => {
    switch (status) {
      case 'sending':
        return 'Enviando...';
      case 'sent':
        return 'Enviada';
      case 'delivered':
        return 'Entregue';
      case 'read':
        return 'Lida ✓✓';
      case 'ai_read':
        return showAIIndicator ? 'IA ✓✓' : 'Lida ✓✓';
      case 'failed':
        return 'Falha no envio';
      default:
        return 'Enviada';
    }
  };

  const formatTime = (timestamp: string) => {
    try {
      return new Date(timestamp).toLocaleTimeString('pt-BR', { 
        hour: '2-digit', 
        minute: '2-digit' 
      });
    } catch {
      return '--:--';
    }
  };

  return (
    <div className="flex items-center justify-end space-x-1 mt-1 opacity-75" title={getStatusText()}>
      <span className="text-xs text-white">
        {formatTime(timestamp)}
      </span>
      {getStatusIcon()}
      {isAIRead && showAIIndicator && (
        <span className="text-xs text-blue-400 font-medium">IA</span>
      )}
    </div>
  );
};

export default EnhancedMessageStatus;
