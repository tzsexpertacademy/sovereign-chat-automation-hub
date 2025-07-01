
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  RefreshCw, 
  Trash2, 
  CheckCircle, 
  XCircle, 
  AlertTriangle,
  Zap,
  Database,
  Server
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useWhatsAppSessionCleaner } from "@/hooks/useWhatsAppSessionCleaner";
import { useWhatsAppConnectionVerifier } from "@/hooks/useWhatsAppConnectionVerifier";
import { useWhatsAppStatusSynchronizer } from "@/hooks/useWhatsAppStatusSynchronizer";

interface WhatsAppMasterControllerProps {
  clientId: string;
  instanceIds: string[];
  onStatusUpdate: () => void;
}

const WhatsAppMasterController = ({ clientId, instanceIds, onStatusUpdate }: WhatsAppMasterControllerProps) => {
  const [isRunningDiagnostic, setIsRunningDiagnostic] = useState(false);
  const { toast } = useToast();
  
  const { cleanAllSessions, isCleaningSession } = useWhatsAppSessionCleaner();
  const { verifyAllConnections, verificationResults, isVerifying } = useWhatsAppConnectionVerifier();
  const { syncAllInstances, syncResults, isSyncing, lastSync } = useWhatsAppStatusSynchronizer(clientId);

  const runCompleteDiagnostic = async () => {
    try {
      setIsRunningDiagnostic(true);
      console.log('🔍 [MASTER] Iniciando diagnóstico completo...');

      toast({
        title: "Diagnóstico Iniciado",
        description: "Executando verificação completa do sistema...",
      });

      // 1. Verificar conexões reais
      console.log('🔍 [MASTER] Fase 1: Verificando conexões reais...');
      await verifyAllConnections(instanceIds);

      // 2. Sincronizar com banco
      console.log('🔍 [MASTER] Fase 2: Sincronizando com banco...');
      await syncAllInstances();

      // 3. Atualizar interface
      console.log('🔍 [MASTER] Fase 3: Atualizando interface...');
      onStatusUpdate();

      console.log('✅ [MASTER] Diagnóstico completo concluído');
      
      toast({
        title: "Diagnóstico Concluído",
        description: "Verificação completa do sistema finalizada",
      });

    } catch (error: any) {
      console.error('❌ [MASTER] Erro no diagnóstico:', error);
      toast({
        title: "Erro no Diagnóstico",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsRunningDiagnostic(false);
    }
  };

  const runCompleteReset = async () => {
    if (!confirm('⚠️ ATENÇÃO: Isso irá desconectar TODAS as instâncias WhatsApp. Confirma?')) {
      return;
    }

    try {
      console.log('🔄 [MASTER] Iniciando reset completo...');
      
      toast({
        title: "Reset Iniciado",
        description: "Limpando todas as sessões WhatsApp...",
      });

      // 1. Limpar todas as sessões
      const success = await cleanAllSessions();
      
      if (success) {
        // 2. Aguardar 3 segundos
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        // 3. Sincronizar banco
        await syncAllInstances();
        
        // 4. Atualizar interface
        onStatusUpdate();
        
        toast({
          title: "Reset Concluído",
          description: "Sistema limpo e pronto para novas conexões",
        });
      }
    } catch (error: any) {
      console.error('❌ [MASTER] Erro no reset:', error);
      toast({
        title: "Erro no Reset",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const getVerificationSummary = () => {
    const results = Object.values(verificationResults);
    if (results.length === 0) return null;

    const connected = results.filter(r => r.reallyConnected).length;
    const inconsistent = results.filter(r => r.serverStatus === 'qr_ready' && r.reallyConnected).length;
    const total = results.length;

    return { connected, inconsistent, total };
  };

  const getSyncSummary = () => {
    if (syncResults.length === 0) return null;

    const updated = syncResults.filter(r => r.wasUpdated).length;
    const errors = syncResults.filter(r => r.error).length;
    const total = syncResults.length;

    return { updated, errors, total };
  };

  const summary = getVerificationSummary();
  const syncSummary = getSyncSummary();

  return (
    <Card className="border-blue-200 bg-blue-50">
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Zap className="w-5 h-5 text-blue-600" />
          <span>WhatsApp Master Controller</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        
        {/* Status Summary */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-3 bg-white rounded border">
            <div className="flex items-center space-x-2">
              <Server className="w-4 h-4 text-blue-600" />
              <span className="text-sm font-medium">Verificação</span>
            </div>
            {summary ? (
              <div className="mt-1 text-xs text-gray-600">
                {summary.connected}/{summary.total} conectadas
                {summary.inconsistent > 0 && (
                  <span className="text-red-600 ml-1">
                    ({summary.inconsistent} inconsistentes)
                  </span>
                )}
              </div>
            ) : (
              <div className="mt-1 text-xs text-gray-500">Não executada</div>
            )}
          </div>

          <div className="p-3 bg-white rounded border">
            <div className="flex items-center space-x-2">
              <Database className="w-4 h-4 text-green-600" />
              <span className="text-sm font-medium">Sincronização</span>
            </div>
            {syncSummary ? (
              <div className="mt-1 text-xs text-gray-600">
                {syncSummary.updated} atualizadas
                {syncSummary.errors > 0 && (
                  <span className="text-red-600 ml-1">
                    ({syncSummary.errors} erros)
                  </span>
                )}
              </div>
            ) : (
              <div className="mt-1 text-xs text-gray-500">
                {lastSync ? `Última: ${lastSync.toLocaleTimeString()}` : 'Não executada'}
              </div>
            )}
          </div>

          <div className="p-3 bg-white rounded border">
            <div className="flex items-center space-x-2">
              <CheckCircle className="w-4 h-4 text-purple-600" />
              <span className="text-sm font-medium">Instâncias</span>
            </div>
            <div className="mt-1 text-xs text-gray-600">
              {instanceIds.length} registradas
            </div>
          </div>
        </div>

        {/* Inconsistency Alert */}
        {summary && summary.inconsistent > 0 && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <strong>⚠️ Inconsistências Detectadas:</strong> {summary.inconsistent} instâncias 
              estão conectadas no WhatsApp mas aparecem como "qr_ready" no sistema.
            </AlertDescription>
          </Alert>
        )}

        {/* Action Buttons */}
        <div className="flex space-x-2 flex-wrap gap-2">
          <Button 
            onClick={runCompleteDiagnostic}
            disabled={isRunningDiagnostic || isVerifying || isSyncing}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {isRunningDiagnostic ? (
              <>
                <RefreshCw className="w-4 h-4 mr-1 animate-spin" />
                Diagnosticando...
              </>
            ) : (
              <>
                <CheckCircle className="w-4 h-4 mr-1" />
                Diagnóstico Completo
              </>
            )}
          </Button>

          <Button 
            onClick={syncAllInstances}
            disabled={isSyncing || isRunningDiagnostic}
            variant="outline"
            className="bg-green-50 hover:bg-green-100 border-green-300"
          >
            {isSyncing ? (
              <>
                <RefreshCw className="w-4 h-4 mr-1 animate-spin" />
                Sincronizando...
              </>
            ) : (
              <>
                <Database className="w-4 h-4 mr-1" />
                Sincronizar Banco
              </>
            )}
          </Button>

          <Button 
            onClick={runCompleteReset}
            disabled={isCleaningSession || isRunningDiagnostic}
            variant="outline"
            className="bg-red-50 hover:bg-red-100 border-red-300 text-red-700"
          >
            {isCleaningSession ? (
              <>
                <RefreshCw className="w-4 h-4 mr-1 animate-spin" />
                Limpando...
              </>
            ) : (
              <>
                <Trash2 className="w-4 h-4 mr-1" />
                Reset Completo
              </>
            )}
          </Button>
        </div>

        {/* Results */}
        {Object.keys(verificationResults).length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium">Resultados da Verificação:</h4>
            <div className="space-y-1 max-h-32 overflow-y-auto">
              {Object.values(verificationResults).map((result) => (
                <div key={result.instanceId} className="flex items-center space-x-2 text-xs">
                  <Badge variant={result.reallyConnected ? "default" : "secondary"} className="text-xs">
                    {result.instanceId.slice(0, 8)}
                  </Badge>
                  <span className={result.reallyConnected ? "text-green-600" : "text-gray-600"}>
                    {result.serverStatus} {result.reallyConnected && "✅"}
                  </span>
                  {result.serverStatus === 'qr_ready' && result.reallyConnected && (
                    <Badge variant="destructive" className="text-xs">INCONSISTENTE</Badge>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default WhatsAppMasterController;
