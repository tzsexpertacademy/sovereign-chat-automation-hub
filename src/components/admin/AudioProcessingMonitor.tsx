import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { RefreshCw, AlertTriangle, CheckCircle, Clock, Play } from 'lucide-react';

interface AudioStats {
  total_audio_messages: number;
  processed_audio: number;
  pending_decryption: number;
  pending_transcription: number;
  orphaned_audio: number;
  processing_rate: number;
}

export function AudioProcessingMonitor() {
  const [stats, setStats] = useState<AudioStats | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isReprocessing, setIsReprocessing] = useState(false);
  const { toast } = useToast();

  const clientId = window.location.pathname.split('/')[2]; // Extrair do URL

  const fetchStats = async () => {
    if (!clientId) return;
    
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .rpc('get_audio_processing_stats', { p_client_id: clientId });

      if (error) throw error;

      if (data && data.length > 0) {
        setStats(data[0]);
      }
    } catch (error: any) {
      console.error('❌ Erro ao buscar estatísticas:', error);
      toast({
        title: "Erro",
        description: "Falha ao carregar estatísticas de áudio",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const reprocessOrphanedAudio = async () => {
    if (!clientId) return;
    
    setIsReprocessing(true);
    try {
      const { data, error } = await supabase
        .rpc('reprocess_orphaned_audio', { p_client_id: clientId });

      if (error) throw error;

      if (data && data.length > 0) {
        const result = data[0];
        toast({
          title: "Reprocessamento Concluído",
          description: `${result.reprocessed_count} áudios reprocessados, ${result.error_count} erros`,
        });
        
        // Atualizar estatísticas
        setTimeout(fetchStats, 2000);
      }
    } catch (error: any) {
      console.error('❌ Erro ao reprocessar áudios:', error);
      toast({
        title: "Erro",
        description: "Falha ao reprocessar áudios órfãos",
        variant: "destructive"
      });
    } finally {
      setIsReprocessing(false);
    }
  };

  const triggerMediaProcessing = async () => {
    try {
      const { error } = await supabase.functions.invoke('process-received-media');
      
      if (error) throw error;
      
      toast({
        title: "Processamento Disparado",
        description: "Processamento de mídia iniciado manualmente",
      });
      
      // Atualizar estatísticas após delay
      setTimeout(fetchStats, 3000);
    } catch (error: any) {
      console.error('❌ Erro ao disparar processamento:', error);
      toast({
        title: "Erro",
        description: "Falha ao disparar processamento de mídia",
        variant: "destructive"
      });
    }
  };

  useEffect(() => {
    fetchStats();
    
    // Auto refresh a cada 30 segundos
    const interval = setInterval(fetchStats, 30000);
    return () => clearInterval(interval);
  }, [clientId]);

  const getStatusColor = (rate: number) => {
    if (rate >= 90) return 'text-green-600';
    if (rate >= 70) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getStatusIcon = (rate: number) => {
    if (rate >= 90) return <CheckCircle className="h-4 w-4 text-green-600" />;
    if (rate >= 70) return <Clock className="h-4 w-4 text-yellow-600" />;
    return <AlertTriangle className="h-4 w-4 text-red-600" />;
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              🎵 Monitor de Processamento de Áudio
              {stats && getStatusIcon(stats.processing_rate)}
            </CardTitle>
            <CardDescription>
              Monitoramento em tempo real do processamento de áudios WhatsApp
            </CardDescription>
          </div>
          <Button
            onClick={fetchStats}
            disabled={isLoading}
            size="sm"
            variant="outline"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {stats ? (
          <>
            {/* Estatísticas Principais */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div className="text-center p-3 bg-blue-50 rounded-lg">
                <div className="text-2xl font-bold text-blue-600">
                  {stats.total_audio_messages}
                </div>
                <div className="text-sm text-gray-600">Total (24h)</div>
              </div>
              
              <div className="text-center p-3 bg-green-50 rounded-lg">
                <div className="text-2xl font-bold text-green-600">
                  {stats.processed_audio}
                </div>
                <div className="text-sm text-gray-600">Processados</div>
              </div>
              
              <div className="text-center p-3 bg-yellow-50 rounded-lg">
                <div className="text-2xl font-bold text-yellow-600">
                  {stats.pending_decryption}
                </div>
                <div className="text-sm text-gray-600">Pendente Decrypt</div>
              </div>
              
              <div className="text-center p-3 bg-orange-50 rounded-lg">
                <div className="text-2xl font-bold text-orange-600">
                  {stats.pending_transcription}
                </div>
                <div className="text-sm text-gray-600">Pendente Transcrição</div>
              </div>
              
              <div className="text-center p-3 bg-red-50 rounded-lg">
                <div className="text-2xl font-bold text-red-600">
                  {stats.orphaned_audio}
                </div>
                <div className="text-sm text-gray-600">Órfãos</div>
              </div>
            </div>

            <Separator />

            {/* Taxa de Processamento */}
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
              <div className="flex items-center gap-3">
                {getStatusIcon(stats.processing_rate)}
                <div>
                  <div className="font-semibold">Taxa de Processamento</div>
                  <div className="text-sm text-gray-600">
                    Percentual de áudios processados com sucesso
                  </div>
                </div>
              </div>
              <div className={`text-3xl font-bold ${getStatusColor(stats.processing_rate)}`}>
                {stats.processing_rate}%
              </div>
            </div>

            {/* Status Badges */}
            <div className="flex flex-wrap gap-2">
              {stats.processing_rate >= 90 && (
                <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                  ✅ Sistema Saudável
                </Badge>
              )}
              {stats.pending_decryption > 0 && (
                <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">
                  🔐 {stats.pending_decryption} Aguardando Descriptografia
                </Badge>
              )}
              {stats.pending_transcription > 0 && (
                <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                  🎙️ {stats.pending_transcription} Aguardando Transcrição
                </Badge>
              )}
              {stats.orphaned_audio > 0 && (
                <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
                  ⚠️ {stats.orphaned_audio} Áudios Órfãos
                </Badge>
              )}
            </div>

            <Separator />

            {/* Ações de Recovery */}
            <div className="space-y-3">
              <h4 className="font-semibold text-gray-800">🔧 Ações de Recovery</h4>
              <div className="flex flex-wrap gap-3">
                <Button
                  onClick={triggerMediaProcessing}
                  size="sm"
                  variant="outline"
                  className="flex items-center gap-2"
                >
                  <Play className="h-4 w-4" />
                  Processar Mídia Manualmente
                </Button>
                
                {stats.orphaned_audio > 0 && (
                  <Button
                    onClick={reprocessOrphanedAudio}
                    disabled={isReprocessing}
                    size="sm"
                    variant="outline"
                    className="flex items-center gap-2 text-red-600 border-red-200 hover:bg-red-50"
                  >
                    <RefreshCw className={`h-4 w-4 ${isReprocessing ? 'animate-spin' : ''}`} />
                    Reprocessar Órfãos ({stats.orphaned_audio})
                  </Button>
                )}
              </div>
            </div>

            {/* Informações Técnicas */}
            <div className="text-xs text-gray-500 p-3 bg-gray-50 rounded">
              <div className="font-semibold mb-1">🔍 Informações Técnicas:</div>
              <div>• Job de descriptografia: a cada 30 segundos</div>
              <div>• Job de processamento: a cada 1 minuto</div>
              <div>• Timeout de órfãos: 5 minutos</div>
              <div>• Última atualização: {new Date().toLocaleTimeString()}</div>
            </div>
          </>
        ) : (
          <div className="text-center py-8">
            <div className="text-gray-500">Carregando estatísticas...</div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}