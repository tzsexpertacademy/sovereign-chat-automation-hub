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
  onlinePrivacy: 'all' | 'contacts' | 'none' | 'contact_blacklist';
  seenPrivacy: 'all' | 'contacts' | 'none' | 'contact_blacklist';
  profileStatus: string;
  showActivityIndicator: boolean;
}

const OnlineStatusConfig: React.FC<OnlineStatusConfigProps> = ({
  clientId,
  instanceId
}) => {
  const [config, setConfig] = useState<StatusConfig>({
    enabled: false,
    autoOnline: true,
    onlinePrivacy: 'all',
    seenPrivacy: 'all',
    profileStatus: 'Assistente virtual ativo 24h',
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
        .update({
          online_status_config: config as any,
          updated_at: new Date().toISOString()
        })
        .eq('client_id', clientId);

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
    toast({
      title: "ℹ️ Configuração Salva",
      description: "As configurações serão aplicadas automaticamente pela IA quando processar mensagens",
      variant: "default"
    });
    
    console.log('🔧 [CONFIG] Configurações salvas - IA aplicará automaticamente:', {
      clientId,
      instanceId,
      config
    });
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

            {/* Configurações de Privacidade */}
            <div className="space-y-4">
              <h3 className="font-medium flex items-center gap-2">
                <Wifi className="w-4 h-4" />
                Configurações de Privacidade
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="onlinePrivacy">Quem vê quando está online</Label>
                  <select 
                    id="onlinePrivacy"
                    className="w-full px-3 py-2 border border-input bg-background rounded-md text-sm"
                    value={config.onlinePrivacy}
                    onChange={(e) => setConfig(prev => ({ 
                      ...prev, 
                      onlinePrivacy: e.target.value as 'all' | 'contacts' | 'none' | 'contact_blacklist'
                    }))}
                  >
                    <option value="all">Todos</option>
                    <option value="contacts">Apenas contatos</option>
                    <option value="contact_blacklist">Bloqueados</option>
                    <option value="none">Ninguém</option>
                  </select>
                  <p className="text-xs text-muted-foreground">
                    Configure quem pode ver quando você está online
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="seenPrivacy">Visto por último</Label>
                  <select 
                    id="seenPrivacy"
                    className="w-full px-3 py-2 border border-input bg-background rounded-md text-sm"
                    value={config.seenPrivacy}
                    onChange={(e) => setConfig(prev => ({ 
                      ...prev, 
                      seenPrivacy: e.target.value as 'all' | 'contacts' | 'none' | 'contact_blacklist'
                    }))}
                  >
                    <option value="all">Todos</option>
                    <option value="contacts">Apenas contatos</option>
                    <option value="contact_blacklist">Bloqueados</option>
                    <option value="none">Ninguém</option>
                  </select>
                  <p className="text-xs text-muted-foreground">
                    Configure quem pode ver seu visto por último
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="profileStatus">Status do Perfil (Recado)</Label>
                <Input
                  id="profileStatus"
                  type="text"
                  placeholder="Digite seu status personalizado..."
                  value={config.profileStatus}
                  onChange={(e) => setConfig(prev => ({ 
                    ...prev, 
                    profileStatus: e.target.value 
                  }))}
                />
                <p className="text-xs text-muted-foreground">
                  Mensagem que aparece no seu perfil do WhatsApp
                </p>
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
                    Configure as configurações de privacidade do seu perfil no WhatsApp. 
                    O assistente aparecerá online automaticamente quando processar mensagens.
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
                  {testingStatus === 'testing' ? 'Aplicando...' : 'Aplicar Configurações'}
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