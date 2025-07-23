import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, Trash2, RefreshCw } from 'lucide-react';
import { cleanupInstancesService } from '@/services/cleanupInstancesService';
import { toast } from 'sonner';

interface InstancesCleanupManagerProps {
  onInstancesUpdated?: () => void;
}

export const InstancesCleanupManager = ({ onInstancesUpdated }: InstancesCleanupManagerProps) => {
  const [isCleaningInstances, setIsCleaningInstances] = useState(false);
  const [isCleaningWebhooks, setIsCleaningWebhooks] = useState(false);
  const [lastCleanupResult, setLastCleanupResult] = useState<{
    instances: { cleaned: number; errors: string[] };
    webhooks: { cleaned: number; errors: string[] };
  } | null>(null);

  const handleCleanupInstances = async () => {
    setIsCleaningInstances(true);
    try {
      const result = await cleanupInstancesService.cleanupOrphanedInstances();
      
      setLastCleanupResult(prev => ({ 
        ...prev, 
        instances: result 
      }));
      
      if (result.cleaned > 0) {
        toast.success(`${result.cleaned} instâncias órfãs removidas com sucesso!`);
      } else {
        toast.info('Nenhuma instância órfã encontrada');
      }
      
      if (result.errors.length > 0) {
        result.errors.forEach(error => toast.error(error));
      }
      
      // Notificar atualização
      if (onInstancesUpdated) {
        onInstancesUpdated();
      }
    } catch (error: any) {
      console.error('Erro na limpeza de instâncias:', error);
      toast.error('Erro ao limpar instâncias órfãs');
    } finally {
      setIsCleaningInstances(false);
    }
  };

  const handleCleanupWebhooks = async () => {
    setIsCleaningWebhooks(true);
    try {
      const result = await cleanupInstancesService.cleanupOrphanedWebhooks();
      
      setLastCleanupResult(prev => ({ 
        ...prev, 
        webhooks: result 
      }));
      
      if (result.cleaned > 0) {
        toast.success(`${result.cleaned} webhooks órfãos reconfigurados!`);
      } else {
        toast.info('Nenhum webhook órfão encontrado');
      }
      
      if (result.errors.length > 0) {
        result.errors.forEach(error => toast.error(error));
      }
      
      // Notificar atualização
      if (onInstancesUpdated) {
        onInstancesUpdated();
      }
    } catch (error: any) {
      console.error('Erro na limpeza de webhooks:', error);
      toast.error('Erro ao limpar webhooks órfãos');
    } finally {
      setIsCleaningWebhooks(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-yellow-500" />
          Limpeza de Instâncias
        </CardTitle>
        <CardDescription>
          Remove instâncias órfãs e reconfigura webhooks antigos
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Button 
              onClick={handleCleanupInstances}
              disabled={isCleaningInstances}
              className="w-full"
              variant="outline"
            >
              {isCleaningInstances ? (
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4 mr-2" />
              )}
              Limpar Instâncias Órfãs
            </Button>
            
            {lastCleanupResult?.instances && (
              <div className="text-sm">
                <Badge variant="outline">
                  {lastCleanupResult.instances.cleaned} removidas
                </Badge>
                {lastCleanupResult.instances.errors.length > 0 && (
                  <Badge variant="destructive" className="ml-2">
                    {lastCleanupResult.instances.errors.length} erros
                  </Badge>
                )}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Button 
              onClick={handleCleanupWebhooks}
              disabled={isCleaningWebhooks}
              className="w-full"
              variant="outline"
            >
              {isCleaningWebhooks ? (
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-2" />
              )}
              Reconfigurar Webhooks
            </Button>
            
            {lastCleanupResult?.webhooks && (
              <div className="text-sm">
                <Badge variant="outline">
                  {lastCleanupResult.webhooks.cleaned} reconfigurados
                </Badge>
                {lastCleanupResult.webhooks.errors.length > 0 && (
                  <Badge variant="destructive" className="ml-2">
                    {lastCleanupResult.webhooks.errors.length} erros
                  </Badge>
                )}
              </div>
            )}
          </div>
        </div>

        {lastCleanupResult && (
          <div className="mt-4 p-3 bg-muted rounded-lg">
            <p className="text-sm text-muted-foreground">
              Última limpeza: {new Date().toLocaleString()}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};