import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Activity, RefreshCw } from 'lucide-react';

interface SimpleRealtimeStatusProps {
  lastUpdateSource: 'supabase' | 'polling';
  messagesCount: number;
  onReload?: () => void;
  className?: string;
}

const SimpleRealtimeStatus = ({ 
  lastUpdateSource, 
  messagesCount,
  onReload,
  className = '' 
}: SimpleRealtimeStatusProps) => {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {/* Status Principal - Supabase sempre ativo */}
      <Badge 
        variant="secondary" 
        className="text-white text-xs flex items-center gap-1 bg-green-500"
      >
        <Activity className="h-3 w-3" />
        Supabase Ativo
      </Badge>
      
      {/* Método de Envio - REST */}
      <Badge variant="outline" className="text-xs text-blue-600">
        REST • Enviando
      </Badge>
      
      {/* Última Atualização */}
      <Badge variant="outline" className="text-xs">
        Via: {lastUpdateSource === 'supabase' ? 'Realtime' : 'Polling'}
      </Badge>
      
      {/* Contador de Mensagens */}
      {messagesCount > 0 && (
        <Badge variant="outline" className="text-xs">
          {messagesCount} msgs
        </Badge>
      )}
      
      {/* Botão de Reload */}
      {onReload && (
        <button
          onClick={onReload}
          className="text-xs text-muted-foreground hover:text-foreground p-1"
          title="Recarregar mensagens"
        >
          <RefreshCw className="h-3 w-3" />
        </button>
      )}
    </div>
  );
};

export default SimpleRealtimeStatus;