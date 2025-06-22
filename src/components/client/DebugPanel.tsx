
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useTicketSystem } from '@/hooks/useTicketSystem';
import { useDebugWebSocket } from '@/hooks/useDebugWebSocket';
import { whatsappService } from '@/services/whatsappMultiClient';

interface DebugPanelProps {
  clientId: string;
}

const DebugPanel = ({ clientId }: DebugPanelProps) => {
  const [isVisible, setIsVisible] = useState(false);
  const { tickets, isConnected, debugSystem } = useTicketSystem(clientId);
  
  // Ativar debug do WebSocket
  useDebugWebSocket(clientId);

  const testWebSocket = () => {
    console.log('🧪 [TEST] Testando WebSocket...');
    const socket = whatsappService.connectSocket();
    
    socket.emit('test-message', { 
      clientId, 
      message: 'Teste de conectividade',
      timestamp: new Date().toISOString()
    });
    
    console.log('🧪 [TEST] Mensagem de teste enviada');
  };

  const simulateMessage = () => {
    console.log('🎭 [SIMULATE] Simulando mensagem...');
    
    // Simular uma mensagem real
    const mockMessage = {
      id: `test_${Date.now()}`,
      from: '5547964518860@c.us',
      chat_id: '5547964518860@c.us',
      body: 'Mensagem de teste para debug',
      timestamp: new Date().toISOString(),
      from_me: false,
      sender: 'Teste Debug',
      message_type: 'text'
    };
    
    // Disparar evento direto
    const socket = whatsappService.connectSocket();
    socket.emit(`message_${clientId}`, mockMessage);
    
    console.log('🎭 [SIMULATE] Mensagem simulada:', mockMessage);
  };

  if (!isVisible) {
    return (
      <Button 
        onClick={() => setIsVisible(true)}
        variant="outline"
        size="sm"
        className="fixed bottom-4 right-4 z-50"
      >
        🔧 Debug
      </Button>
    );
  }

  return (
    <Card className="fixed bottom-4 right-4 w-96 max-h-96 overflow-auto z-50 bg-white shadow-lg">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex justify-between items-center">
          Debug Panel
          <Button 
            onClick={() => setIsVisible(false)}
            variant="ghost"
            size="sm"
          >
            ✕
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-xs">
        <div className="flex items-center gap-2">
          <span>WebSocket:</span>
          <Badge variant={isConnected ? "default" : "destructive"}>
            {isConnected ? "Conectado" : "Desconectado"}
          </Badge>
        </div>
        
        <div className="flex items-center gap-2">
          <span>Tickets:</span>
          <Badge variant="secondary">{tickets.length}</Badge>
        </div>
        
        <div className="flex items-center gap-2">
          <span>Cliente:</span>
          <span className="font-mono text-xs">{clientId.slice(0, 8)}...</span>
        </div>
        
        <div className="space-y-1">
          <Button 
            onClick={debugSystem}
            variant="outline" 
            size="sm" 
            className="w-full text-xs"
          >
            🔍 Debug Sistema
          </Button>
          
          <Button 
            onClick={testWebSocket}
            variant="outline" 
            size="sm" 
            className="w-full text-xs"
          >
            🧪 Testar WebSocket
          </Button>
          
          <Button 
            onClick={simulateMessage}
            variant="outline" 
            size="sm" 
            className="w-full text-xs"
          >
            🎭 Simular Mensagem
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default DebugPanel;
