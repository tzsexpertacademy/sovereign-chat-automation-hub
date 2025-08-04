import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Play, RefreshCw, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';
import { audioRecoveryService } from '@/services/audioRecoveryService';

interface AudioProcessingDebugPanelProps {
  clientId: string;
}

export const AudioProcessingDebugPanel = ({ clientId }: AudioProcessingDebugPanelProps) => {
  const [orphanedAudios, setOrphanedAudios] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  // Carregar áudios órfãos
  const loadOrphanedAudios = async () => {
    setIsLoading(true);
    try {
      console.log('🔍 [DEBUG] Buscando áudios órfãos...');
      const audios = await audioRecoveryService.findOrphanedAudios(clientId);
      setOrphanedAudios(audios);
      
      if (audios.length > 0) {
        toast.info(`Encontrados ${audios.length} áudios órfãos`);
      } else {
        toast.success('Nenhum áudio órfão encontrado');
      }
    } catch (error) {
      console.error('❌ [DEBUG] Erro ao buscar áudios órfãos:', error);
      toast.error('Erro ao buscar áudios órfãos');
    } finally {
      setIsLoading(false);
    }
  };

  // Reprocessar todos os áudios órfãos
  const reprocessAllOrphaned = async () => {
    setIsProcessing(true);
    try {
      console.log('🔄 [DEBUG] Reprocessando todos os áudios órfãos...');
      const result = await audioRecoveryService.reprocessOrphanedAudios(clientId);
      
      if (result.updated > 0) {
        toast.success(`✅ ${result.updated} áudios marcados para reprocessamento!`);
        // Recarregar lista
        await loadOrphanedAudios();
      } else {
        toast.info('Nenhum áudio necessitando reprocessamento');
      }
      
      if (result.errors > 0) {
        toast.warning(`⚠️ ${result.errors} erros durante o processamento`);
      }
    } catch (error) {
      console.error('❌ [DEBUG] Erro no reprocessamento:', error);
      toast.error('Erro no reprocessamento');
    } finally {
      setIsProcessing(false);
    }
  };

  // Reprocessar um áudio específico
  const reprocessSingle = async (messageId: string) => {
    try {
      console.log(`🔧 [DEBUG] Reprocessando áudio: ${messageId}`);
      const success = await audioRecoveryService.reprocessSingleAudio(messageId);
      
      if (success) {
        toast.success(`Áudio ${messageId} marcado para reprocessamento`);
        await loadOrphanedAudios();
      } else {
        toast.error('Falha ao marcar áudio para reprocessamento');
      }
    } catch (error) {
      console.error(`❌ [DEBUG] Erro ao reprocessar ${messageId}:`, error);
      toast.error('Erro no reprocessamento individual');
    }
  };

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Play className="w-5 h-5" />
          Debug: Processamento de Áudio
        </CardTitle>
        <CardDescription>
          Ferramentas para debug e recuperação de áudios não processados
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Controles */}
        <div className="flex gap-2">
          <Button 
            onClick={loadOrphanedAudios}
            disabled={isLoading}
            variant="outline"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Buscar Áudios Órfãos
          </Button>
          
          <Button 
            onClick={reprocessAllOrphaned}
            disabled={isProcessing || orphanedAudios.length === 0}
            variant="default"
          >
            <CheckCircle className="w-4 h-4 mr-2" />
            Reprocessar Todos ({orphanedAudios.length})
          </Button>
        </div>

        {/* Estatísticas */}
        <div className="grid grid-cols-2 gap-4">
          <div className="p-3 border rounded">
            <div className="text-2xl font-bold text-orange-600">
              {orphanedAudios.length}
            </div>
            <div className="text-sm text-muted-foreground">Áudios Órfãos</div>
          </div>
          <div className="p-3 border rounded">
            <div className="text-2xl font-bold text-blue-600">
              {orphanedAudios.filter(a => a.media_key).length}
            </div>
            <div className="text-sm text-muted-foreground">Com Media Key</div>
          </div>
        </div>

        {/* Lista de áudios órfãos */}
        {orphanedAudios.length > 0 && (
          <div className="space-y-2">
            <h4 className="font-medium">Áudios Órfãos Encontrados:</h4>
            <div className="max-h-64 overflow-y-auto space-y-2">
              {orphanedAudios.slice(0, 10).map((audio) => (
                <div key={audio.id} className="p-3 border rounded-sm bg-orange-50 dark:bg-orange-950/20">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-mono text-sm">{audio.message_id}</div>
                      <div className="text-xs text-muted-foreground">
                        {new Date(audio.timestamp).toLocaleString('pt-BR')}
                      </div>
                      <div className="flex gap-1 mt-1">
                        <Badge variant={audio.media_key ? "default" : "secondary"} className="text-xs">
                          {audio.media_key ? "Com Key" : "Sem Key"}
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          {audio.processing_status}
                        </Badge>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => reprocessSingle(audio.message_id)}
                    >
                      Reprocessar
                    </Button>
                  </div>
                </div>
              ))}
              {orphanedAudios.length > 10 && (
                <div className="text-center text-sm text-muted-foreground p-2">
                  ... e mais {orphanedAudios.length - 10} áudios
                </div>
              )}
            </div>
          </div>
        )}

        {/* Instruções */}
        <div className="p-3 bg-blue-50 dark:bg-blue-950/20 rounded border-l-4 border-blue-500">
          <h4 className="font-medium text-blue-800 dark:text-blue-200 mb-2">Como Funciona:</h4>
          <ul className="text-sm text-blue-700 dark:text-blue-300 space-y-1">
            <li>• Áudios órfãos = status "processed" mas sem transcrição</li>
            <li>• Reprocessar marca como "received" para o hook detectar</li>
            <li>• useAudioAutoProcessor processa automaticamente</li>
            <li>• Console mostra logs detalhados do processamento</li>
          </ul>
        </div>

        {/* Comandos de console */}
        <div className="p-3 bg-gray-50 dark:bg-gray-900 rounded border">
          <h4 className="font-medium mb-2">Comandos do Console:</h4>
          <div className="font-mono text-sm space-y-1">
            <div>• <code>audioRecovery.findOrphanedAudios('{clientId}')</code></div>
            <div>• <code>audioRecovery.reprocessOrphanedAudios('{clientId}')</code></div>
            <div>• <code>testAudio()</code> - Teste manual</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};