import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { RefreshCw, FileAudio, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { AudioRecoveryService } from '@/services/audioRecoveryService';

interface AudioRecoveryPanelProps {
  clientId: string;
}

export const AudioRecoveryPanel = ({ clientId }: AudioRecoveryPanelProps) => {
  const [stats, setStats] = useState({
    total: 0,
    withBase64: 0,
    withoutBase64: 0,
    needRecovery: 0
  });
  const [isLoading, setIsLoading] = useState(false);
  const [isRecovering, setIsRecovering] = useState(false);
  const [lastRecovery, setLastRecovery] = useState<any>(null);

  // Carregar estatísticas
  const loadStats = async () => {
    setIsLoading(true);
    try {
      const audioStats = await AudioRecoveryService.getAudioStatus(clientId);
      setStats(audioStats);
    } catch (error) {
      console.error('❌ Erro ao carregar stats:', error);
      toast.error('Erro ao carregar estatísticas de áudio');
    } finally {
      setIsLoading(false);
    }
  };

  // Executar recuperação
  const runRecovery = async () => {
    setIsRecovering(true);
    try {
      console.log('🎵 Iniciando recuperação de áudios...');
      
      const result = await AudioRecoveryService.recoverMissingAudioData(clientId, 10);
      setLastRecovery(result);
      
      if (result.recovered > 0) {
        toast.success(`✅ ${result.recovered} áudios recuperados com sucesso!`);
      } else if (result.processed === 0) {
        toast.info('ℹ️ Nenhum áudio precisando de recuperação');
      } else {
        toast.warning(`⚠️ Processados ${result.processed}, mas nenhum recuperado`);
      }
      
      // Recarregar estatísticas
      await loadStats();
      
    } catch (error) {
      console.error('❌ Erro na recuperação:', error);
      toast.error('Erro durante a recuperação de áudios');
    } finally {
      setIsRecovering(false);
    }
  };

  // Carregar stats na inicialização
  useEffect(() => {
    loadStats();
  }, [clientId]);

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <FileAudio className="h-5 w-5" />
          <span>Recuperação de Áudios</span>
          {isLoading && <Loader2 className="h-4 w-4 animate-spin ml-2" />}
        </CardTitle>
        <CardDescription>
          Sistema para recuperar áudios que ficaram sem dados base64
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Estatísticas */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-primary">{stats.total}</div>
            <div className="text-sm text-muted-foreground">Total de Áudios</div>
          </div>
          
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">{stats.withBase64}</div>
            <div className="text-sm text-muted-foreground">Funcionando</div>
            <Badge variant="outline" className="mt-1 text-green-600">
              <CheckCircle className="h-3 w-3 mr-1" />
              OK
            </Badge>
          </div>
          
          <div className="text-center">
            <div className="text-2xl font-bold text-orange-600">{stats.withoutBase64}</div>
            <div className="text-sm text-muted-foreground">Sem Base64</div>
            <Badge variant="outline" className="mt-1 text-orange-600">
              <AlertCircle className="h-3 w-3 mr-1" />
              Issue
            </Badge>
          </div>
          
          <div className="text-center">
            <div className="text-2xl font-bold text-destructive">{stats.needRecovery}</div>
            <div className="text-sm text-muted-foreground">Precisam Recuperação</div>
            <Badge variant="destructive" className="mt-1">
              ⚠️ Urgente
            </Badge>
          </div>
        </div>

        {/* Ações */}
        <div className="flex flex-wrap gap-2">
          <Button
            onClick={loadStats}
            disabled={isLoading}
            variant="outline"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Atualizar Stats
          </Button>
          
          <Button
            onClick={runRecovery}
            disabled={isRecovering || stats.needRecovery === 0}
            variant={stats.needRecovery > 0 ? "default" : "secondary"}
          >
            {isRecovering ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <FileAudio className="h-4 w-4 mr-2" />
            )}
            {isRecovering 
              ? 'Recuperando...' 
              : stats.needRecovery > 0 
                ? `Recuperar ${stats.needRecovery} Áudios`
                : 'Nada para Recuperar'
            }
          </Button>
        </div>

        {/* Resultado da última recuperação */}
        {lastRecovery && (
          <div className="bg-muted/50 p-4 rounded-lg">
            <h4 className="font-medium mb-2">Última Recuperação:</h4>
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div>
                <div className="font-medium">Processados:</div>
                <div className="text-muted-foreground">{lastRecovery.processed}</div>
              </div>
              <div>
                <div className="font-medium text-green-600">Recuperados:</div>
                <div className="text-green-600">{lastRecovery.recovered}</div>
              </div>
              <div>
                <div className="font-medium text-destructive">Falharam:</div>
                <div className="text-destructive">{lastRecovery.failed.length}</div>
              </div>
            </div>
            
            {lastRecovery.failed.length > 0 && (
              <div className="mt-2">
                <div className="text-sm font-medium text-destructive">IDs que falharam:</div>
                <div className="text-xs text-muted-foreground mt-1 break-all">
                  {lastRecovery.failed.join(', ')}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Informações do sistema */}
        <div className="bg-blue-50 dark:bg-blue-950/30 p-4 rounded-lg">
          <h4 className="font-medium text-blue-900 dark:text-blue-100 mb-2">
            ℹ️ Como funciona:
          </h4>
          <ul className="text-sm text-blue-800 dark:text-blue-200 space-y-1">
            <li>• Identifica áudios com <code>audio_base64</code> nulo</li>
            <li>• Tenta baixar via <code>directMediaDownloadService</code></li>
            <li>• Converte para base64 e salva no banco</li>
            <li>• Marca como <code>processing_status: completed</code></li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
};