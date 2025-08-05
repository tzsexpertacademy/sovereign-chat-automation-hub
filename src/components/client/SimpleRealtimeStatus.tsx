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
      {/* Status Principal - Online sempre */}
      <Badge 
        variant="secondary" 
        className="text-white text-xs flex items-center gap-1 bg-emerald-500"
      >
        <Activity className="h-3 w-3" />
        Online
      </Badge>
      
      {/* Contador de Mensagens */}
      {messagesCount > 0 && (
        <Badge variant="outline" className="text-xs text-muted-foreground">
          {messagesCount} msgs
        </Badge>
      )}
      
      {/* Botão de Reload */}
      {onReload && (
        <button
          onClick={onReload}
          className="text-xs text-muted-foreground hover:text-foreground p-1 transition-colors"
          title="Recarregar mensagens"
        >
          <RefreshCw className="h-3 w-3" />
        </button>
      )}
    </div>
  );
};

export default SimpleRealtimeStatus;