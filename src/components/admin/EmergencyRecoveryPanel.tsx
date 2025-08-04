import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, Activity, RefreshCw, Zap } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface HealthStats {
  unprocessed_messages: number;
  pending_batches: number;
  stuck_batches: number;
  recent_messages_1h: number;
  recent_tickets_1h: number;
  last_webhook_activity: string;
}

interface RecoveryResult {
  recovered_messages: number;
  created_batches: number;
}

export const EmergencyRecoveryPanel = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [healthStats, setHealthStats] = useState<HealthStats | null>(null);
  const [lastRecovery, setLastRecovery] = useState<RecoveryResult | null>(null);

  const checkHealth = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('emergency-message-recovery', {
        body: { action: 'monitor' }
      });

      if (error) throw error;
      
      setHealthStats(data.health);
      toast.success('Status do sistema atualizado');
    } catch (error) {
      console.error('Erro ao verificar saúde:', error);
      toast.error('Erro ao verificar status do sistema');
    } finally {
      setIsLoading(false);
    }
  };

  const runEmergencyRecovery = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('emergency-message-recovery', {
        body: { action: 'recovery' }
      });

      if (error) throw error;
      
      setLastRecovery(data.recovery);
      setHealthStats(data.health);
      
      toast.success(
        `Recuperação concluída: ${data.recovery.recovered_messages} mensagens, ${data.recovery.created_batches} batches criados`
      );
    } catch (error) {
      console.error('Erro na recuperação:', error);
      toast.error('Erro na recuperação emergencial');
    } finally {
      setIsLoading(false);
    }
  };

  const forceBatchProcessing = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('emergency-message-recovery', {
        body: { action: 'force-batch-processing' }
      });

      if (error) throw error;
      
      toast.success('Processamento de batches forçado iniciado');
      
      // Atualizar saúde após 2 segundos
      setTimeout(checkHealth, 2000);
    } catch (error) {
      console.error('Erro no processamento forçado:', error);
      toast.error('Erro ao forçar processamento');
    } finally {
      setIsLoading(false);
    }
  };

  const getHealthStatus = () => {
    if (!healthStats) return 'unknown';
    
    const hasUnprocessed = healthStats.unprocessed_messages > 0;
    const hasStuck = healthStats.stuck_batches > 0;
    const recentActivity = healthStats.recent_messages_1h > 0;
    
    if (hasUnprocessed || hasStuck) return 'critical';
    if (!recentActivity) return 'warning';
    return 'healthy';
  };

  const statusColor = {
    healthy: 'bg-green-500',
    warning: 'bg-yellow-500',
    critical: 'bg-red-500',
    unknown: 'bg-gray-500'
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-orange-500" />
          🚨 Painel de Recuperação Emergencial
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Status da Saúde */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <div className="flex items-center gap-2">
            <div className={`w-3 h-3 rounded-full ${statusColor[getHealthStatus()]}`} />
            <span className="text-sm font-medium">
              Status: {getHealthStatus() === 'healthy' ? 'Saudável' : 
                       getHealthStatus() === 'warning' ? 'Atenção' : 
                       getHealthStatus() === 'critical' ? 'Crítico' : 'Desconhecido'}
            </span>
          </div>
          
          {healthStats && (
            <>
              <Badge variant="outline">
                Não processadas: {healthStats.unprocessed_messages}
              </Badge>
              <Badge variant="outline">
                Batches pendentes: {healthStats.pending_batches}
              </Badge>
              <Badge variant="outline">
                Batches travados: {healthStats.stuck_batches}
              </Badge>
              <Badge variant="outline">
                Mensagens 1h: {healthStats.recent_messages_1h}
              </Badge>
              <Badge variant="outline">
                Tickets 1h: {healthStats.recent_tickets_1h}
              </Badge>
            </>
          )}
        </div>

        {/* Última Recuperação */}
        {lastRecovery && (
          <div className="p-3 bg-green-50 rounded-lg border border-green-200">
            <p className="text-sm text-green-700">
              <strong>Última recuperação:</strong> {lastRecovery.recovered_messages} mensagens processadas, 
              {lastRecovery.created_batches} batches criados
            </p>
          </div>
        )}

        {/* Ações */}
        <div className="flex flex-wrap gap-2">
          <Button
            onClick={checkHealth}
            disabled={isLoading}
            variant="outline"
            size="sm"
            className="flex items-center gap-2"
          >
            <Activity className="w-4 h-4" />
            {isLoading ? 'Verificando...' : 'Verificar Saúde'}
          </Button>

          <Button
            onClick={runEmergencyRecovery}
            disabled={isLoading}
            variant="default"
            size="sm"
            className="flex items-center gap-2 bg-orange-600 hover:bg-orange-700"
          >
            <RefreshCw className="w-4 h-4" />
            {isLoading ? 'Recuperando...' : 'Recuperação Emergencial'}
          </Button>

          <Button
            onClick={forceBatchProcessing}
            disabled={isLoading}
            variant="destructive"
            size="sm"
            className="flex items-center gap-2"
          >
            <Zap className="w-4 h-4" />
            {isLoading ? 'Forçando...' : 'Forçar Processamento'}
          </Button>
        </div>

        {/* Instruções */}
        <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
          <h4 className="text-sm font-medium text-blue-900 mb-2">Como usar:</h4>
          <ol className="text-xs text-blue-700 space-y-1">
            <li>1. <strong>Verificar Saúde</strong> - Monitora o status atual do sistema</li>
            <li>2. <strong>Recuperação Emergencial</strong> - Processa mensagens perdidas desde 21:08:52</li>
            <li>3. <strong>Forçar Processamento</strong> - Force o processamento de todos os batches pendentes</li>
          </ol>
        </div>
      </CardContent>
    </Card>
  );
};