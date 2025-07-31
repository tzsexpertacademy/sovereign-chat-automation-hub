import React from 'react';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface FinalSimpleStatusProps {
  lastUpdateSource: string;
  messagesCount: number;
  onReload?: () => void;
  className?: string;
}

const FinalSimpleStatus = ({ 
  lastUpdateSource, 
  messagesCount,
  onReload,
  className = '' 
}: FinalSimpleStatusProps) => {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {/* Status Principal - Sempre Supabase */}
      <Badge variant="secondary" className="text-white text-xs flex items-center gap-1 bg-green-500">
        <CheckCircle className="h-3 w-3" />
        Sistema Ativo
      </Badge>
      
      {/* Método de Recebimento */}
      <Badge variant="outline" className="text-xs text-blue-600">
        {lastUpdateSource === 'polling' ? 'Polling' : 'Supabase'} • {messagesCount}
      </Badge>
      
      {/* Método de Envio */}
      <Badge variant="outline" className="text-xs text-green-600">
        REST • Enviando
      </Badge>
      
      {/* Reload opcional */}
      {onReload && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onReload}
          className="h-6 px-2 text-xs"
        >
          <RefreshCw className="h-3 w-3" />
        </Button>
      )}
    </div>
  );
};

export default FinalSimpleStatus;