/**
 * Configurações Simples de Comportamento
 * Apenas funcionalidades reais e integradas
 */

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Clock, MessageSquare, Save, RotateCcw, Zap, Timer } from 'lucide-react';

interface SimpleBehaviorConfig {
  // Delays de digitação (funcional via batch system)
  typing: {
    enabled: boolean;
    minDuration: number;
    maxDuration: number;
  };
  // Divisão de mensagens (funcional via batch system)
  messageHandling: {
    splitLongMessages: boolean;
    maxCharsPerChunk: number;
    delayBetweenChunks: number;
    intelligentTiming: boolean;
    timingBaseMs: number;
  };
}

interface SimpleBehaviorSettingsProps {
  assistantId: string;
  assistantName: string;
  onConfigUpdate?: (config: SimpleBehaviorConfig) => void;
}

const defaultConfig: SimpleBehaviorConfig = {
  typing: {
    enabled: true,
    minDuration: 1000,
    maxDuration: 3000
  },
  messageHandling: {
    splitLongMessages: true,
    maxCharsPerChunk: 350,
    delayBetweenChunks: 2500,
    intelligentTiming: true,
    timingBaseMs: 12
  }
};

export function SimpleBehaviorSettings({
  assistantId,
  assistantName,
  onConfigUpdate
}: SimpleBehaviorSettingsProps) {
  const [config, setConfig] = useState<SimpleBehaviorConfig>(defaultConfig);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Carregar configuração inicial
  useEffect(() => {
    const loadConfig = async () => {
      try {
        setLoading(true);
        
        const { data: assistantData, error } = await supabase
          .from('assistants')
          .select('advanced_settings')
          .eq('id', assistantId)
          .single();
        
        if (error) {
          throw error;
        }
        
        if (assistantData?.advanced_settings) {
          const advancedSettings = typeof assistantData.advanced_settings === 'string' 
            ? JSON.parse(assistantData.advanced_settings) 
            : assistantData.advanced_settings;
          
          // Extrair apenas configurações funcionais
          const behaviorConfig: SimpleBehaviorConfig = {
            typing: {
              enabled: advancedSettings.typing?.enabled ?? defaultConfig.typing.enabled,
              minDuration: advancedSettings.typing?.minDuration ?? defaultConfig.typing.minDuration,
              maxDuration: advancedSettings.typing?.maxDuration ?? defaultConfig.typing.maxDuration
            },
            messageHandling: {
              splitLongMessages: advancedSettings.messageHandling?.splitLongMessages ?? defaultConfig.messageHandling.splitLongMessages,
              maxCharsPerChunk: advancedSettings.messageHandling?.maxCharsPerChunk ?? defaultConfig.messageHandling.maxCharsPerChunk,
              delayBetweenChunks: advancedSettings.messageHandling?.delayBetweenChunks ?? defaultConfig.messageHandling.delayBetweenChunks,
              intelligentTiming: advancedSettings.messageHandling?.intelligentTiming ?? defaultConfig.messageHandling.intelligentTiming,
              timingBaseMs: advancedSettings.messageHandling?.timingBaseMs ?? defaultConfig.messageHandling.timingBaseMs
            }
          };
          
          setConfig(behaviorConfig);
        }
        
      } catch (error) {
        console.error('❌ [BEHAVIOR-SETTINGS] Erro ao carregar:', error);
        toast({
          title: "Erro",
          description: "Erro ao carregar configurações de comportamento",
          variant: "destructive"
        });
      } finally {
        setLoading(false);
      }
    };

    loadConfig();
  }, [assistantId]);

  const handleSave = async () => {
    if (!config) return;

    setSaving(true);
    try {
      // Buscar configurações existentes
      const { data: assistantData, error } = await supabase
        .from('assistants')
        .select('advanced_settings')
        .eq('id', assistantId)
        .single();
        
      if (error) {
        throw error;
      }
      
      let advancedSettings = {};
      if (assistantData?.advanced_settings) {
        advancedSettings = typeof assistantData.advanced_settings === 'string' 
          ? JSON.parse(assistantData.advanced_settings) 
          : assistantData.advanced_settings;
      }

      // Mesclar apenas configurações funcionais
      const updatedSettings = {
        ...advancedSettings,
        typing: config.typing,
        messageHandling: config.messageHandling
      };

      const { error: updateError } = await supabase
        .from('assistants')
        .update({
          advanced_settings: JSON.stringify(updatedSettings),
          updated_at: new Date().toISOString()
        })
        .eq('id', assistantId);
        
      if (updateError) {
        throw updateError;
      }

      toast({
        title: "Sucesso",
        description: "Configurações de comportamento salvas com sucesso"
      });
      
      onConfigUpdate?.(config);
      
    } catch (error) {
      console.error('❌ [BEHAVIOR-SETTINGS] Erro ao salvar:', error);
      toast({
        title: "Erro",
        description: "Erro ao salvar configurações",
        variant: "destructive"
      });
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setConfig(defaultConfig);
    toast({
      title: "Configuração Resetada",
      description: "Configurações resetadas para os valores padrão"
    });
  };

  const updateConfig = (updates: Partial<SimpleBehaviorConfig>) => {
    setConfig(prev => ({ ...prev, ...updates }));
  };

  const updateSection = <T extends keyof SimpleBehaviorConfig>(
    section: T,
    updates: Partial<SimpleBehaviorConfig[T]>
  ) => {
    setConfig(prev => ({
      ...prev,
      [section]: { ...prev[section], ...updates }
    }));
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Comportamento do Assistente
          </CardTitle>
          <CardDescription>Carregando configurações...</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5" />
          Comportamento do Assistente
          <Badge variant="outline">Funcionalidades Reais</Badge>
        </CardTitle>
        <CardDescription>
          Configure apenas comportamentos integrados para {assistantName}
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Comportamento de Digitação */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4" />
            <Label className="text-base">Simulação de Digitação</Label>
            <Badge variant="secondary" className="text-xs">Sistema Batch</Badge>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label htmlFor="typing-enabled">Ativar delay de digitação</Label>
              <Switch
                id="typing-enabled"
                checked={config.typing.enabled}
                onCheckedChange={(enabled) => updateSection('typing', { enabled })}
              />
            </div>

            <div className="space-y-2">
              <Label className="text-sm">
                Duração Mínima: {config.typing.minDuration}ms
              </Label>
              <Slider
                value={[config.typing.minDuration]}
                onValueChange={([value]) => updateSection('typing', { minDuration: value })}
                min={500}
                max={3000}
                step={100}
                disabled={!config.typing.enabled}
              />
            </div>

            <div className="space-y-2">
              <Label className="text-sm">
                Duração Máxima: {config.typing.maxDuration}ms
              </Label>
              <Slider
                value={[config.typing.maxDuration]}
                onValueChange={([value]) => updateSection('typing', { maxDuration: value })}
                min={1000}
                max={8000}
                step={200}
                disabled={!config.typing.enabled}
              />
            </div>
          </div>
        </div>

        <Separator />

        {/* Divisão de Mensagens */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4" />
            <Label className="text-base">Divisão de Mensagens</Label>
            <Badge variant="secondary" className="text-xs">Sistema Batch</Badge>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label htmlFor="split-enabled">Dividir mensagens longas</Label>
              <Switch
                id="split-enabled"
                checked={config.messageHandling.splitLongMessages}
                onCheckedChange={(splitLongMessages) => 
                  updateSection('messageHandling', { splitLongMessages })
                }
              />
            </div>

            <div className="space-y-2">
              <Label className="text-sm">
                Caracteres por bloco: {config.messageHandling.maxCharsPerChunk}
              </Label>
              <Slider
                value={[config.messageHandling.maxCharsPerChunk]}
                onValueChange={([value]) => 
                  updateSection('messageHandling', { maxCharsPerChunk: value })
                }
                min={150}
                max={500}
                step={25}
                disabled={!config.messageHandling.splitLongMessages}
              />
            </div>

            {!config.messageHandling.intelligentTiming && (
              <div className="space-y-2">
                <Label className="text-sm">
                  Delay entre blocos: {config.messageHandling.delayBetweenChunks}ms
                </Label>
                <Slider
                  value={[config.messageHandling.delayBetweenChunks]}
                  onValueChange={([value]) => 
                    updateSection('messageHandling', { delayBetweenChunks: value })
                  }
                  min={1000}
                  max={4500}
                  step={250}
                  disabled={!config.messageHandling.splitLongMessages}
                />
              </div>
            )}

            <div className="space-y-2">
              <Label className="text-sm">
                Timing Inteligente: {config.messageHandling.intelligentTiming ? 'Ativado' : 'Desativado'}
              </Label>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  {config.messageHandling.intelligentTiming 
                    ? 'Delays adaptativos baseados no tamanho do bloco' 
                    : 'Delay fixo entre blocos'
                  }
                </span>
                <Switch
                  checked={config.messageHandling.intelligentTiming}
                  onCheckedChange={(intelligentTiming) => 
                    updateSection('messageHandling', { intelligentTiming })
                  }
                  disabled={!config.messageHandling.splitLongMessages}
                />
              </div>
            </div>

            {config.messageHandling.intelligentTiming && (
              <div className="space-y-2">
                <Label className="text-sm">
                  Base de Cálculo: {config.messageHandling.timingBaseMs}ms por caractere
                </Label>
                <Slider
                  value={[config.messageHandling.timingBaseMs]}
                  onValueChange={([value]) => 
                    updateSection('messageHandling', { timingBaseMs: value })
                  }
                  min={8}
                  max={20}
                  step={1}
                  disabled={!config.messageHandling.splitLongMessages || !config.messageHandling.intelligentTiming}
                />
                <p className="text-xs text-muted-foreground">
                  Delay máximo: {Math.min(config.messageHandling.timingBaseMs * 375, 4500)}ms
                </p>
              </div>
            )}
          </div>
        </div>

        <Separator />

        {/* Ações */}
        <div className="flex gap-2">
          <Button onClick={handleSave} disabled={saving}>
            <Save className="h-4 w-4 mr-2" />
            {saving ? 'Salvando...' : 'Salvar Configurações'}
          </Button>
          
          <Button variant="outline" onClick={handleReset} disabled={saving}>
            <RotateCcw className="h-4 w-4 mr-2" />
            Resetar
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}