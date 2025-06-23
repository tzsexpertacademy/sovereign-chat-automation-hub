
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AlertCircle, CheckCircle, Activity, RefreshCw } from 'lucide-react';
import { assistantMonitoringService } from '@/services/assistantMonitoringService';

const AssistantHealthMonitor = () => {
  const [healthStatus, setHealthStatus] = useState<any>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const refreshStatus = async () => {
    setIsRefreshing(true);
    try {
      const status = assistantMonitoringService.getDetailedReport();
      setHealthStatus(status);
    } catch (error) {
      console.error('Erro ao obter status:', error);
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    refreshStatus();
    
    // Atualizar a cada 30 segundos
    const interval = setInterval(refreshStatus, 30000);
    
    return () => clearInterval(interval);
  }, []);

  if (!healthStatus) {
    return (
      <Card className="w-full">
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <RefreshCw className="w-6 h-6 animate-spin mr-2" />
            <span>Carregando status...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy':
        return 'bg-green-500';
      case 'warning':
        return 'bg-yellow-500';
      case 'critical':
        return 'bg-red-500';
      default:
        return 'bg-gray-500';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy':
        return <CheckCircle className="w-4 h-4" />;
      case 'warning':
      case 'critical':
        return <AlertCircle className="w-4 h-4" />;
      default:
        return <Activity className="w-4 h-4" />;
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Activity className="w-5 h-5" />
            Status do Assistente
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge 
              variant="outline" 
              className={`${getStatusColor(healthStatus.status)} text-white border-0`}
            >
              {getStatusIcon(healthStatus.status)}
              <span className="ml-1 capitalize">{healthStatus.status}</span>
            </Badge>
            <Button
              variant="outline"
              size="sm"
              onClick={refreshStatus}
              disabled={isRefreshing}
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Métricas Principais */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center p-3 bg-blue-50 rounded-lg">
            <div className="text-2xl font-bold text-blue-600">
              {healthStatus.metrics.messagesReceived}
            </div>
            <div className="text-sm text-blue-600">Recebidas</div>
          </div>
          
          <div className="text-center p-3 bg-green-50 rounded-lg">
            <div className="text-2xl font-bold text-green-600">
              {healthStatus.metrics.messagesSent}
            </div>
            <div className="text-sm text-green-600">Enviadas</div>
          </div>
          
          <div className="text-center p-3 bg-purple-50 rounded-lg">
            <div className="text-2xl font-bold text-purple-600">
              {healthStatus.successRate.toFixed(1)}%
            </div>
            <div className="text-sm text-purple-600">Taxa de Sucesso</div>
          </div>
          
          <div className="text-center p-3 bg-orange-50 rounded-lg">
            <div className="text-2xl font-bold text-orange-600">
              {healthStatus.averageProcessingTime.toFixed(0)}ms
            </div>
            <div className="text-sm text-orange-600">Tempo Médio</div>
          </div>
        </div>

        {/* Alertas */}
        {healthStatus.alerts && healthStatus.alerts.length > 0 && (
          <div className="space-y-2">
            <h4 className="font-medium text-red-600 flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              Alertas
            </h4>
            {healthStatus.alerts.map((alert: string, index: number) => (
              <div key={index} className="p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-700">{alert}</p>
              </div>
            ))}
          </div>
        )}

        {/* Recomendações */}
        {healthStatus.recommendations && healthStatus.recommendations.length > 0 && (
          <div className="space-y-2">
            <h4 className="font-medium text-yellow-600 flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              Recomendações
            </h4>
            {healthStatus.recommendations.map((rec: string, index: number) => (
              <div key={index} className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                <p className="text-sm text-yellow-700">{rec}</p>
              </div>
            ))}
          </div>
        )}

        {/* Informações Adicionais */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-600">
          <div>
            <strong>Última Atividade:</strong> {healthStatus.timeSinceLastActivity < 60 
              ? `${Math.round(healthStatus.timeSinceLastActivity)}s atrás`
              : `${Math.round(healthStatus.timeSinceLastActivity / 60)}min atrás`
            }
          </div>
          <div>
            <strong>Erros Registrados:</strong> {healthStatus.metrics.errors}
          </div>
        </div>

        {/* Status Geral */}
        <div className="text-center pt-4 border-t">
          <p className="text-sm text-gray-600">
            Sistema monitorado continuamente • Última verificação: {new Date(healthStatus.timestamp).toLocaleTimeString()}
          </p>
        </div>
      </CardContent>
    </Card>
  );
};

export default AssistantHealthMonitor;
