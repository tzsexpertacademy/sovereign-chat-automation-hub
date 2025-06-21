
import React from 'react';
import { Check, CheckCheck, Clock, XCircle } from 'lucide-react';

interface MessageStatusProps {
  status: 'sending' | 'sent' | 'delivered' | 'read' | 'failed';
  timestamp: string;
  fromMe: boolean;
}

const MessageStatus: React.FC<MessageStatusProps> = ({ status, timestamp, fromMe }) => {
  if (!fromMe) return null;

  const getStatusIcon = () => {
    switch (status) {
      case 'sending':
        return <Clock className="w-3 h-3 text-gray-400" />;
      case 'sent':
        return <Check className="w-3 h-3 text-gray-400" />;
      case 'delivered':
        return <CheckCheck className="w-3 h-3 text-gray-400" />;
      case 'read':
        return <CheckCheck className="w-3 h-3 text-blue-500" />;
      case 'failed':
        return <XCircle className="w-3 h-3 text-red-500" />;
      default:
        return <Check className="w-3 h-3 text-gray-400" />;
    }
  };

  const getStatusText = () => {
    switch (status) {
      case 'sending':
        return 'Enviando';
      case 'sent':
        return 'Enviada';
      case 'delivered':
        return 'Entregue';
      case 'read':
        return 'Lida';
      case 'failed':
        return 'Falha';
      default:
        return 'Enviada';
    }
  };

  return (
    <div className="flex items-center space-x-1 mt-1" title={getStatusText()}>
      {getStatusIcon()}
      <span className="text-xs text-gray-500">
        {new Date(timestamp).toLocaleTimeString('pt-BR', { 
          hour: '2-digit', 
          minute: '2-digit' 
        })}
      </span>
    </div>
  );
};

export default MessageStatus;
