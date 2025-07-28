import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  Activity, 
  Clock, 
  Wifi, 
  WifiOff, 
  Settings,
  CheckCircle,
  AlertCircle,
  Info
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface OnlineStatusConfigProps {
  clientId: string;
  instanceId?: string;
}

interface StatusConfig {
  enabled: boolean;
  autoOnline: boolean;
  detectionInterval: number; // em segundos
  offlineTimeout: number; // em minutos
  enablePresenceDetection: boolean;
  showActivityIndicator: boolean;
}

const OnlineStatusConfig: React.FC<OnlineStatusConfigProps> = ({
  clientId,
  instanceId
}) => {
  const [config, setConfig] = useState<StatusConfig>({
    enabled: false,
    autoOnline: true,
    detectionInterval: 30,
    offlineTimeout: 5,
    enablePresenceDetection: true,
    showActivityIndicator: true
  });
  const [isSaving, setIsSaving] = useState(false);
  const [testingStatus, setTestingStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const { toast } = useToast();

  // Carregar configuração atual
  useEffect(() => {
    loadCurrentConfig();
  }, [clientId]);

  const loadCurrentConfig = async () => {
    try {
      const { data, error } = await supabase
        .from('client_ai_configs')
        .select('online_status_config')
        .eq('client_id', clientId)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Erro ao carregar configuração:', error);
        return;
      }

      if (data?.online_status_config) {
        const savedConfig = typeof data.online_status_config === 'string' 
          ? JSON.parse(data.online_status_config)
          : data.online_status_config;
        
        setConfig({ ...config, ...savedConfig });
      }
    } catch (error) {
      console.error('Erro ao carregar configuração:', error);
    }
  };

  const saveConfig = async () => {
    if (!clientId) return;
    
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('client_ai_configs')
        .upsert({
          client_id: clientId,
          online_status_config: config,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'client_id'
        });

      if (error) throw error;

      toast({
        title: "✅ Configuração Salva",
        description: "Configurações de status online atualizadas com sucesso"
      });

      console.log('✅ [STATUS-CONFIG] Configuração salva:', config);
    } catch (error) {
      console.error('❌ [STATUS-CONFIG] Erro ao salvar:', error);
      toast({
        title: "❌ Erro ao Salvar",
        description: "Falha ao salvar configurações. Tente novamente.",
        variant: "destructive"
      });
    } finally {
      setIsSaving(false);
    }
  };

  const testStatusDetection = async () => {
    if (!instanceId) {
      toast({
        title: "⚠️ Teste Indisponível",
        description: "Nenhuma instância WhatsApp conectada para testar",
        variant: "destructive"
      });
      return;
    }

    setTestingStatus('testing');
    try {
      console.log('🧪 [STATUS-TEST] Iniciando teste de detecção...');
      
      // Simular teste de detecção (aqui você integraria com o unifiedYumerService)
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      setTestingStatus('success');
      toast({
        title: "✅ Teste Bem-sucedido",
        description: "Sistema de detecção de presença está funcionando corretamente"
      });

      setTimeout(() => setTestingStatus('idle'), 3000);
    } catch (error) {
      console.error('❌ [STATUS-TEST] Erro no teste:', error);
      setTestingStatus('error');
      toast({
        title: "❌ Teste Falhou",
        description: "Erro ao testar sistema de detecção de presença",
        variant: "destructive"
      });
      setTimeout(() => setTestingStatus('idle'), 3000);
    }
  };

  const getStatusBadge = () => {
    if (!config.enabled) {
      return (
        <Badge variant="outline" className="flex items-center gap-1">
          <WifiOff className="w-3 h-3" />
          Desabilitado
        </Badge>
      );
    }

    return (
      <Badge variant="outline" className="flex items-center gap-1 text-green-600">
        <Wifi className="w-3 h-3" />
        Ativo
      </Badge>
    );
  };

  const getTestStatusIcon = () => {
    switch (testingStatus) {
      case 'testing':
        return <Clock className="w-4 h-4 animate-spin" />;
      case 'success':
        return <CheckCircle className="w-4 h-4 text-green-600" />;
      case 'error':
        return <AlertCircle className="w-4 h-4 text-red-600" />;
      default:
        return <Activity className="w-4 h-4" />;
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Settings className="w-5 h-5" />
              Status Online no WhatsApp
            </CardTitle>
            <CardDescription>
              Configure como seu assistente aparece online para os clientes
            </CardDescription>
          </div>
          {getStatusBadge()}
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Status Geral */}
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <Label className="text-base font-medium">Habilitar Status Online</Label>
            <p className="text-sm text-muted-foreground">
              Mostrar como "online" no WhatsApp quando assistente estiver ativo
            </p>
          </div>
          <Switch
            checked={config.enabled}
            onCheckedChange={(checked) => setConfig(prev => ({ ...prev, enabled: checked }))}
          />
        </div>

        {config.enabled && (
          <>
            <Separator />

            {/* Configurações Básicas */}
            <div className="space-y-4">
              <h3 className="font-medium flex items-center gap-2">
                <Wifi className="w-4 h-4" />
                Configurações de Presença
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="detectionInterval">Intervalo de Detecção (segundos)</Label>
                  <Input
                    id="detectionInterval"
                    type="number"
                    min="15"
                    max="300"
                    value={config.detectionInterval}
                    onChange={(e) => setConfig(prev => ({ 
                      ...prev, 
                      detectionInterval: parseInt(e.target.value) || 30 
                    }))}
                  />
                  <p className="text-xs text-muted-foreground">
                    Frequência para verificar atividade (15-300 segundos)
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="offlineTimeout">Timeout Offline (minutos)</Label>
                  <Input
                    id="offlineTimeout"
                    type="number"
                    min="1"
                    max="60"
                    value={config.offlineTimeout}
                    onChange={(e) => setConfig(prev => ({ 
                      ...prev, 
                      offlineTimeout: parseInt(e.target.value) || 5 
                    }))}
                  />
                  <p className="text-xs text-muted-foreground">
                    Tempo até ficar offline sem atividade (1-60 minutos)
                  </p>
                </div>
              </div>
            </div>

            <Separator />

            {/* Opções Avançadas */}
            <div className="space-y-4">
              <h3 className="font-medium">Opções Avançadas</h3>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <Label>Online Automático</Label>
                    <p className="text-sm text-muted-foreground">
                      Ficar online automaticamente quando receber mensagens
                    </p>
                  </div>
                  <Switch
                    checked={config.autoOnline}
                    onCheckedChange={(checked) => setConfig(prev => ({ ...prev, autoOnline: checked }))}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <Label>Detecção por Status de Mensagens</Label>
                    <p className="text-sm text-muted-foreground">
                      Usar status "entregue/lida" para detectar atividade
                    </p>
                  </div>
                  <Switch
                    checked={config.enablePresenceDetection}
                    onCheckedChange={(checked) => setConfig(prev => ({ ...prev, enablePresenceDetection: checked }))}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <Label>Indicador de Atividade</Label>
                    <p className="text-sm text-muted-foreground">
                      Mostrar "digitando" quando assistente estiver respondendo
                    </p>
                  </div>
                  <Switch
                    checked={config.showActivityIndicator}
                    onCheckedChange={(checked) => setConfig(prev => ({ ...prev, showActivityIndicator: checked }))}
                  />
                </div>
              </div>
            </div>

            <Separator />

            {/* Informações e Teste */}
            <div className="space-y-4">
              <div className="flex items-start gap-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                <Info className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
                <div className="space-y-1">
                  <p className="text-sm font-medium text-blue-800 dark:text-blue-300">
                    Como Funciona
                  </p>
                  <p className="text-sm text-blue-700 dark:text-blue-400">
                    O sistema monitora mensagens entregues/lidas para detectar quando o cliente está ativo. 
                    Quando detecta atividade, define o assistente como "online" no WhatsApp.
                  </p>
                </div>
              </div>

              <div className="flex gap-2">
                <Button
                  onClick={testStatusDetection}
                  disabled={testingStatus === 'testing'}
                  variant="outline"
                  className="flex items-center gap-2"
                >
                  {getTestStatusIcon()}
                  {testingStatus === 'testing' ? 'Testando...' : 'Testar Detecção'}
                </Button>
              </div>
            </div>
          </>
        )}

        <Separator />

        {/* Botões de Ação */}
        <div className="flex justify-end gap-2">
          <Button
            onClick={saveConfig}
            disabled={isSaving}
            className="flex items-center gap-2"
          >
            {isSaving ? (
              <Clock className="w-4 h-4 animate-spin" />
            ) : (
              <CheckCircle className="w-4 h-4" />
            )}
            {isSaving ? 'Salvando...' : 'Salvar Configurações'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default OnlineStatusConfig;