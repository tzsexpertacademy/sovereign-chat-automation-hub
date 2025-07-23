import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  Loader2, 
  CheckCircle, 
  XCircle, 
  AlertTriangle,
  RefreshCw,
  Trash2,
  Play
} from "lucide-react";
import { codechatQRService } from '@/services/codechatQRService';
import { useToast } from '@/hooks/use-toast';

interface InstanceDiagnostic {
  instanceName: string;
  realId?: string;
  status?: string;
  connectionStatus?: string;
  state?: string;
  hasQr?: boolean;
  isStuck?: boolean;
  needsRecreation?: boolean;
  whatsappState?: string;
}

const AdvancedQRDiagnostic = () => {
  const [instanceName, setInstanceName] = useState(`advanced_test_${Date.now()}`);
  const [diagnostic, setDiagnostic] = useState<InstanceDiagnostic | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const { toast } = useToast();

  const addLog = (message: string) => {
    setLogs(prev => [...prev, `${new Date().toLocaleTimeString()}: ${message}`]);
    console.log(`[ADVANCED-QR] ${message}`);
  };

  const analyzeInstance = async (name: string): Promise<InstanceDiagnostic> => {
    addLog(`Analisando instância: ${name}`);
    
    const result: InstanceDiagnostic = { instanceName: name };
    
    try {
      // 1. Buscar detalhes completos
      const details = await codechatQRService.getInstanceDetails(name);
      result.realId = details.id;
      result.connectionStatus = details.connectionStatus;
      
      // 2. Buscar status da conexão
      try {
        const status = await codechatQRService.getInstanceStatus(name);
        result.state = status.state;
        result.status = status.statusReason;
      } catch (statusError) {
        addLog(`Erro ao buscar status: ${statusError}`);
      }
      
      // 3. Verificar estado interno do WhatsApp
      if (details.Whatsapp?.connection) {
        result.whatsappState = details.Whatsapp.connection.state;
        addLog(`Estado WhatsApp interno: ${result.whatsappState}`);
      }
      
      // 4. Detectar se está travada
      const isConnecting = result.state === 'connecting' || result.whatsappState === 'connecting';
      const isOffline = result.connectionStatus === 'OFFLINE';
      const hasNoQr = !details.qrCode && !details.base64 && !details.Whatsapp?.qrCode;
      
      result.isStuck = isConnecting && isOffline && hasNoQr;
      result.needsRecreation = result.isStuck;
      
      if (result.isStuck) {
        addLog(`🚨 INSTÂNCIA TRAVADA DETECTADA!`);
        addLog(`- Estado: ${result.state}`);
        addLog(`- Connection Status: ${result.connectionStatus}`);
        addLog(`- WhatsApp State: ${result.whatsappState}`);
        addLog(`- Tem QR: ${!hasNoQr}`);
      }
      
      // 5. Verificar se tem QR code
      const qr = details.qrCode || details.base64 || details.Whatsapp?.qrCode;
      if (qr) {
        result.hasQr = true;
        setQrCode(qr);
        addLog(`✅ QR Code encontrado!`);
      }
      
    } catch (error) {
      addLog(`Erro na análise: ${error}`);
      result.needsRecreation = true;
    }
    
    return result;
  };

  const recreateStuckInstance = async (name: string): Promise<boolean> => {
    try {
      addLog(`🔄 Iniciando recriação da instância travada: ${name}`);
      
      // 1. Deletar instância atual
      addLog(`🗑️ Deletando instância atual...`);
      await codechatQRService.deleteInstance(name);
      
      // 2. Aguardar limpeza
      addLog(`⏳ Aguardando limpeza (3s)...`);
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // 3. Criar nova instância
      addLog(`📝 Criando nova instância...`);
      const createResult = await codechatQRService.createInstance(name, `Advanced QR Diagnostic ${name}`);
      
      if (!createResult.success) {
        addLog(`❌ Falha na criação: ${createResult.error}`);
        return false;
      }
      
      // 4. Aguardar estabilização
      addLog(`⏳ Aguardando estabilização (2s)...`);
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // 5. Conectar
      addLog(`📡 Conectando instância...`);
      const connectResult = await codechatQRService.connectInstance(name);
      
      if (connectResult.success && connectResult.qrCode) {
        addLog(`🎉 QR Code obtido na recriação!`);
        setQrCode(connectResult.qrCode);
        return true;
      } else if (connectResult.success) {
        addLog(`⚠️ Conectado mas sem QR imediato - iniciando polling...`);
        return await pollForQRAfterRecreation(name);
      } else {
        addLog(`❌ Falha na conexão: ${connectResult.error}`);
        return false;
      }
      
    } catch (error) {
      addLog(`❌ Erro na recriação: ${error}`);
      return false;
    }
  };

  const pollForQRAfterRecreation = async (name: string): Promise<boolean> => {
    addLog(`🔍 Iniciando polling otimizado pós-recriação...`);
    
    for (let i = 1; i <= 10; i++) {
      addLog(`Polling ${i}/10...`);
      
      try {
        const details = await codechatQRService.getInstanceDetails(name);
        const qr = details.qrCode || details.base64 || details.Whatsapp?.qrCode;
        
        if (qr) {
          addLog(`✅ QR encontrado no polling ${i}!`);
          setQrCode(qr);
          return true;
        }
        
        // Verificar se conectou
        if (details.ownerJid) {
          addLog(`✅ Instância conectada durante polling!`);
          return true;
        }
        
        // Verificar se travou novamente
        const status = await codechatQRService.getInstanceStatus(name);
        if (status.state === 'connecting' && details.connectionStatus === 'OFFLINE' && i > 5) {
          addLog(`⚠️ Instância travando novamente - parando polling`);
          return false;
        }
        
      } catch (error) {
        addLog(`Erro no polling ${i}: ${error}`);
      }
      
      if (i < 10) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
    
    addLog(`⏰ Polling finalizado sem QR`);
    return false;
  };

  const runAdvancedDiagnostic = async () => {
    setIsRunning(true);
    setDiagnostic(null);
    setQrCode(null);
    setLogs([]);
    
    try {
      addLog(`🚀 Iniciando diagnóstico avançado para: ${instanceName}`);
      
      // Fase 1: Análise inicial
      addLog(`📊 Fase 1: Análise inicial`);
      let analysis = await analyzeInstance(instanceName);
      setDiagnostic(analysis);
      
      if (analysis.hasQr) {
        addLog(`✅ QR Code já disponível - diagnóstico concluído`);
        toast({
          title: "QR Code Disponível",
          description: "QR Code encontrado na análise inicial",
        });
        return;
      }
      
      // Fase 2: Tentar conectar se não estiver travada
      if (!analysis.isStuck) {
        addLog(`📡 Fase 2: Tentando conexão normal`);
        const connectResult = await codechatQRService.connectInstance(instanceName);
        
        if (connectResult.success && connectResult.qrCode) {
          addLog(`✅ QR obtido na conexão normal`);
          setQrCode(connectResult.qrCode);
          analysis.hasQr = true;
          setDiagnostic({...analysis});
          return;
        }
      }
      
      // Fase 3: Recriação se necessária
      if (analysis.needsRecreation) {
        addLog(`🔧 Fase 3: Recriação necessária`);
        const recreated = await recreateStuckInstance(instanceName);
        
        if (recreated) {
          // Re-analisar após recriação
          analysis = await analyzeInstance(instanceName);
          analysis.hasQr = !!qrCode;
          setDiagnostic({...analysis});
          
          toast({
            title: "Instância Recriada",
            description: "Instância travada foi recriada com sucesso",
          });
        } else {
          addLog(`❌ Falha na recriação - QR Code não obtido`);
          toast({
            title: "Recriação Falhou",
            description: "Não foi possível obter QR Code após recriação",
            variant: "destructive"
          });
        }
      }
      
    } finally {
      setIsRunning(false);
    }
  };

  const cleanupInstance = async () => {
    try {
      await codechatQRService.deleteInstance(instanceName);
      setDiagnostic(null);
      setQrCode(null);
      addLog(`🗑️ Instância ${instanceName} removida`);
      toast({
        title: "Instância Removida",
        description: "Instância de teste removida com sucesso",
      });
    } catch (error) {
      addLog(`Erro ao remover: ${error}`);
    }
  };

  const getStatusBadge = (diag: InstanceDiagnostic) => {
    if (diag.hasQr) return <Badge className="bg-green-500">QR Disponível</Badge>;
    if (diag.isStuck) return <Badge variant="destructive">Travada</Badge>;
    if (diag.state === 'connecting') return <Badge className="bg-yellow-500">Conectando</Badge>;
    if (diag.state === 'open') return <Badge className="bg-green-500">Conectada</Badge>;
    return <Badge variant="outline">Desconhecida</Badge>;
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            🔬 Diagnóstico Avançado de QR Code
            <div className="flex items-center space-x-2">
              <Button onClick={cleanupInstance} variant="outline" size="sm">
                <Trash2 className="w-4 h-4 mr-2" />
                Limpar
              </Button>
              <Button onClick={runAdvancedDiagnostic} disabled={isRunning}>
                {isRunning ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Analisando...
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 mr-2" />
                    Executar
                  </>
                )}
              </Button>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center space-x-2">
            <input
              className="flex-1 px-3 py-2 border rounded"
              placeholder="Nome da instância"
              value={instanceName}
              onChange={(e) => setInstanceName(e.target.value)}
            />
            <Button 
              onClick={() => setInstanceName(`advanced_test_${Date.now()}`)} 
              variant="outline"
            >
              <RefreshCw className="w-4 h-4" />
            </Button>
          </div>

          {diagnostic && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between text-sm">
                    Estado da Instância
                    {getStatusBadge(diagnostic)}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div>ID Real: {diagnostic.realId || 'N/A'}</div>
                  <div>Estado: {diagnostic.state || 'N/A'}</div>
                  <div>Status Conexão: {diagnostic.connectionStatus || 'N/A'}</div>
                  <div>WhatsApp State: {diagnostic.whatsappState || 'N/A'}</div>
                  <div>Tem QR: {diagnostic.hasQr ? '✅' : '❌'}</div>
                  {diagnostic.isStuck && (
                    <Alert>
                      <AlertTriangle className="h-4 w-4" />
                      <AlertDescription>
                        Instância travada detectada - recriação necessária
                      </AlertDescription>
                    </Alert>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">QR Code</CardTitle>
                </CardHeader>
                <CardContent>
                  {qrCode ? (
                    <div className="text-center">
                      <img 
                        src={qrCode} 
                        alt="QR Code" 
                        className="max-w-full max-h-48 mx-auto border rounded"
                      />
                      <p className="text-xs text-green-600 mt-2">
                        QR Code disponível!
                      </p>
                    </div>
                  ) : (
                    <div className="text-center text-gray-500 py-8">
                      Nenhum QR Code disponível
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}

          {logs.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Logs do Diagnóstico</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="max-h-40 overflow-y-auto bg-gray-50 p-3 rounded text-xs font-mono">
                  {logs.map((log, index) => (
                    <div key={index} className="mb-1">
                      {log}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AdvancedQRDiagnostic;