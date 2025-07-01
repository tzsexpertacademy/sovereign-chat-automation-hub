
import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  QrCode, 
  RefreshCw, 
  AlertCircle, 
  CheckCircle, 
  Trash2,
  Timer,
  Activity,
  Bug
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import whatsappService from "@/services/whatsappMultiClient";

const QRCodeDebugger = () => {
  const [instanceId, setInstanceId] = useState("35f36a03-39b2-412c-bba6-01fdd45c2dd3");
  const [status, setStatus] = useState<any>(null);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const { toast } = useToast();

  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs(prev => [`[${timestamp}] ${message}`, ...prev.slice(0, 19)]);
    console.log(`🔧 [DEBUGGER] ${message}`);
  };

  const checkStatus = async () => {
    try {
      setLoading(true);
      addLog(`🔍 Verificando status de ${instanceId}`);
      
      const response = await whatsappService.getClientStatus(instanceId);
      setStatus(response);
      
      if (response.qrCode) {
        setQrCode(response.qrCode);
        addLog(`📱 QR Code encontrado (${response.qrCode.length} chars)`);
      } else {
        setQrCode(null);
        addLog(`❌ QR Code não disponível`);
      }
      
      addLog(`📊 Status: ${response.status} | Phone: ${response.phoneNumber || 'N/A'}`);
      
      // Se conectado, parar auto-refresh
      if (response.status === 'connected' && response.phoneNumber) {
        setAutoRefresh(false);
        addLog(`🎉 CONECTADO! Telefone: ${response.phoneNumber}`);
        toast({
          title: "WhatsApp Conectado!",
          description: `Instância conectada: ${response.phoneNumber}`,
        });
      }
      
    } catch (error: any) {
      addLog(`❌ Erro: ${error.message}`);
      console.error('Erro no debugger:', error);
    } finally {
      setLoading(false);
    }
  };

  const forceReconnect = async () => {
    try {
      setLoading(true);
      addLog(`🔄 Forçando reconexão de ${instanceId}`);
      
      // Primeiro desconectar (limpar sessão)
      await whatsappService.disconnectClient(instanceId);
      addLog(`🔌 Desconectado - aguardando 3 segundos...`);
      
      // Aguardar 3 segundos
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // Reconectar
      await whatsappService.connectClient(instanceId);
      addLog(`🚀 Reconectando... novo QR deve aparecer`);
      
      // Verificar status após 2 segundos
      setTimeout(() => {
        checkStatus();
      }, 2000);
      
      toast({
        title: "Reconexão Iniciada",
        description: "Aguarde o novo QR Code aparecer",
      });
      
    } catch (error: any) {
      addLog(`❌ Erro na reconexão: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const clearLogs = () => {
    setLogs([]);
    addLog("🧹 Logs limpos");
  };

  // Auto-refresh com countdown
  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (autoRefresh) {
      interval = setInterval(() => {
        setCountdown(prev => {
          if (prev <= 1) {
            checkStatus();
            return 5; // Reset para 5 segundos
          }
          return prev - 1;
        });
      }, 1000);
      
      // Iniciar countdown
      setCountdown(5);
    }
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [autoRefresh, instanceId]);

  // Verificar se está preso em qr_ready por muito tempo
  const isStuckInQrReady = status?.status === 'qr_ready' && status?.hasQrCode;
  
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Bug className="w-5 h-5" />
            <CardTitle>Diagnóstico QR Code</CardTitle>
          </div>
          <div className="flex items-center space-x-2">
            {autoRefresh && (
              <Badge variant="secondary" className="animate-pulse">
                <Timer className="w-3 h-3 mr-1" />
                Auto-refresh em {countdown}s
              </Badge>
            )}
            <Badge variant={status?.status === 'connected' ? 'default' : 'secondary'}>
              {status?.status || 'Desconhecido'}
            </Badge>
          </div>
        </div>
        <CardDescription>
          Ferramenta de debug para diagnosticar problemas de conexão WhatsApp
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        
        {/* Input Instance ID */}
        <div className="space-y-2">
          <Label htmlFor="instanceId">Instance ID</Label>
          <Input
            id="instanceId"
            value={instanceId}
            onChange={(e) => setInstanceId(e.target.value)}
            placeholder="Digite o Instance ID"
          />
        </div>

        {/* Control Buttons */}
        <div className="flex space-x-2 flex-wrap gap-2">
          <Button 
            onClick={checkStatus} 
            disabled={loading}
            size="sm"
          >
            {loading ? (
              <RefreshCw className="w-4 h-4 mr-1 animate-spin" />
            ) : (
              <Activity className="w-4 h-4 mr-1" />
            )}
            Verificar Status
          </Button>
          
          <Button 
            onClick={forceReconnect} 
            disabled={loading}
            variant="outline"
            size="sm"
          >
            <RefreshCw className="w-4 h-4 mr-1" />
            Forçar Reconexão
          </Button>
          
          <Button 
            onClick={() => setAutoRefresh(!autoRefresh)}
            variant={autoRefresh ? "default" : "outline"}
            size="sm"
          >
            <Timer className="w-4 h-4 mr-1" />
            Auto-refresh
          </Button>
          
          <Button 
            onClick={clearLogs}
            variant="outline"
            size="sm"
          >
            <Trash2 className="w-4 h-4 mr-1" />
            Limpar Logs
          </Button>
        </div>

        {/* Status Alert */}
        {isStuckInQrReady && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <div className="space-y-2">
                <p><strong>⚠️ Status Travado Detectado!</strong></p>
                <p>A instância está há muito tempo em "qr_ready" mas não conecta após escanear o QR.</p>
                <p><strong>Soluções:</strong></p>
                <ul className="list-disc list-inside text-sm space-y-1">
                  <li>1. Clique em "Forçar Reconexão" para limpar a sessão</li>
                  <li>2. Escaneie o NOVO QR Code que aparecer</li>
                  <li>3. Ative "Auto-refresh" para monitorar</li>
                </ul>
              </div>
            </AlertDescription>
          </Alert>
        )}

        {/* Current Status Display */}
        {status && (
          <div className="p-3 bg-gray-50 rounded border">
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>Status: <strong>{status.status}</strong></div>
              <div>Phone: <strong>{status.phoneNumber || 'N/A'}</strong></div>
              <div>QR Disponível: <strong>{status.hasQrCode ? 'SIM' : 'NÃO'}</strong></div>
              <div>Client ID: <strong>{status.clientId}</strong></div>
              <div>Timestamp: <strong>{status.timestamp || 'N/A'}</strong></div>
              <div>QR Length: <strong>{status.qrCode?.length || 0} chars</strong></div>
            </div>
          </div>
        )}

        {/* QR Code Display */}
        {qrCode && (
          <div className="text-center p-4 bg-white border rounded">
            <h4 className="font-medium mb-2 text-green-600">📱 QR Code Ativo</h4>
            <img 
              src={qrCode} 
              alt="QR Code WhatsApp"
              className="mx-auto max-w-[250px] border"
            />
            <p className="text-xs text-gray-600 mt-2">
              Escaneie com seu WhatsApp para conectar
            </p>
          </div>
        )}

        {/* Logs Display */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>Logs de Debug ({logs.length}/20)</Label>
            {logs.length > 0 && (
              <Button onClick={clearLogs} size="sm" variant="ghost">
                <Trash2 className="w-3 h-3" />
              </Button>
            )}
          </div>
          <div className="bg-black text-green-400 p-3 rounded font-mono text-xs max-h-60 overflow-y-auto">
            {logs.length === 0 ? (
              <div className="text-gray-500">Nenhum log ainda... Clique em "Verificar Status"</div>
            ) : (
              logs.map((log, index) => (
                <div key={index} className="mb-1">{log}</div>
              ))
            )}
          </div>
        </div>

        {/* Help Text */}
        <div className="text-xs text-gray-600 space-y-1">
          <p><strong>Como usar:</strong></p>
          <p>1. Digite o Instance ID e clique "Verificar Status"</p>
          <p>2. Se aparecer QR, escaneie com WhatsApp</p>
          <p>3. Se ficar preso, use "Forçar Reconexão"</p>
          <p>4. Ative "Auto-refresh" para monitorar automaticamente</p>
        </div>
      </CardContent>
    </Card>
  );
};

export default QRCodeDebugger;
