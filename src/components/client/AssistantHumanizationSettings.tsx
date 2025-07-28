/**
 * Componente para Configuração de Humanização de Assistentes
 */

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { toast } from '@/hooks/use-toast';
import { 
  assistantHumanizationService, 
  type HumanizedConfig, 
  type HumanizedPersonality 
} from '@/services/assistantHumanizationService';
import { Bot, Clock, MessageSquare, User, Settings, Save, RotateCcw } from 'lucide-react';

interface AssistantHumanizationSettingsProps {
  assistantId: string;
  assistantName: string;
  onConfigUpdate?: (config: HumanizedConfig) => void;
}

export function AssistantHumanizationSettings({
  assistantId,
  assistantName,
  onConfigUpdate
}: AssistantHumanizationSettingsProps) {
  const [config, setConfig] = useState<HumanizedConfig | null>(null);
  const [personalities, setPersonalities] = useState<HumanizedPersonality[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Carregar configuração inicial
  useEffect(() => {
    const loadConfig = async () => {
      try {
        setLoading(true);
        
        const [configResult, personalitiesResult] = await Promise.all([
          assistantHumanizationService.getHumanizationConfig(assistantId),
          assistantHumanizationService.getAvailablePersonalities()
        ]);

        setConfig(configResult);
        setPersonalities(personalitiesResult);
        
        console.log('📋 [HUMANIZATION-UI] Configuração carregada:', {
          enabled: configResult.enabled,
          personality: configResult.personality.name
        });
        
      } catch (error) {
        console.error('❌ [HUMANIZATION-UI] Erro ao carregar:', error);
        toast({
          title: "Erro",
          description: "Erro ao carregar configurações de humanização",
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
      // Validar configuração
      const validation = assistantHumanizationService.validateConfig(config);
      if (!validation.valid) {
        toast({
          title: "Configuração Inválida",
          description: validation.errors.join(', '),
          variant: "destructive"
        });
        return;
      }

      // Salvar no banco
      const result = await assistantHumanizationService.saveHumanizationConfig(assistantId, config);
      
      if (result.success) {
        toast({
          title: "Sucesso",
          description: "Configurações de humanização salvas com sucesso"
        });
        onConfigUpdate?.(config);
      } else {
        throw new Error(result.error || 'Erro ao salvar');
      }
      
    } catch (error) {
      console.error('❌ [HUMANIZATION-UI] Erro ao salvar:', error);
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
    const defaultConfig = assistantHumanizationService.generateTestConfig('friendly-assistant');
    setConfig(defaultConfig);
    toast({
      title: "Configuração Resetada",
      description: "Configurações resetadas para os valores padrão"
    });
  };

  const updateConfig = (updates: Partial<HumanizedConfig>) => {
    if (!config) return;
    setConfig({ ...config, ...updates });
  };

  const updateBehavior = (category: keyof HumanizedConfig['behavior'], updates: any) => {
    if (!config) return;
    setConfig({
      ...config,
      behavior: {
        ...config.behavior,
        [category]: {
          ...config.behavior[category],
          ...updates
        }
      }
    });
  };

  const updatePersonality = (personalityId: string) => {
    const personality = assistantHumanizationService.getPersonalityById(personalityId);
    if (!personality || !config) return;
    
    setConfig({
      ...config,
      personality
    });
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bot className="h-5 w-5" />
          Configurações de Humanização
        </CardTitle>
          <CardDescription>Carregando configurações...</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (!config) {
    return (
      <Card>
        <CardHeader>
        <CardTitle className="flex items-center gap-2 text-destructive">
          <Bot className="h-5 w-5" />
          Erro
        </CardTitle>
          <CardDescription>Não foi possível carregar as configurações</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bot className="h-5 w-5" />
          Humanização do Assistente
          <Badge variant={config.enabled ? "default" : "secondary"}>
            {config.enabled ? "Ativo" : "Inativo"}
          </Badge>
        </CardTitle>
        <CardDescription>
          Configure comportamentos humanizados para {assistantName}
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Habilitação Geral */}
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label className="text-base">Humanização Habilitada</Label>
            <p className="text-sm text-muted-foreground">
              Ativar comportamentos humanizados nas conversas
            </p>
          </div>
          <Switch
            checked={config.enabled}
            onCheckedChange={(enabled) => updateConfig({ enabled })}
          />
        </div>

        <Separator />

        {/* Personalidade */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <User className="h-4 w-4" />
            <Label className="text-base">Personalidade</Label>
          </div>
          
          <Select
            value={config.personality.id}
            onValueChange={updatePersonality}
            disabled={!config.enabled}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {personalities.map((personality) => (
                <SelectItem key={personality.id} value={personality.id}>
                  <div className="flex flex-col">
                    <span>{personality.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {personality.tone} • {personality.typingSpeed} WPM
                    </span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Detalhes da Personalidade */}
          <div className="grid grid-cols-2 gap-4 p-3 bg-muted rounded-lg">
            <div>
              <Label className="text-xs">Tom</Label>
              <p className="text-sm capitalize">{config.personality.tone}</p>
            </div>
            <div>
              <Label className="text-xs">Velocidade</Label>
              <p className="text-sm">{config.personality.typingSpeed} WPM</p>
            </div>
            <div>
              <Label className="text-xs">Delay Min</Label>
              <p className="text-sm">{config.personality.responseDelay.min}ms</p>
            </div>
            <div>
              <Label className="text-xs">Delay Max</Label>
              <p className="text-sm">{config.personality.responseDelay.max}ms</p>
            </div>
          </div>
        </div>

        <Separator />

        {/* Comportamento de Typing */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4" />
            <Label className="text-base">Indicador de Digitação</Label>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label htmlFor="typing-enabled">Mostrar "digitando..."</Label>
              <Switch
                id="typing-enabled"
                checked={config.behavior.typing.enabled}
                onCheckedChange={(enabled) => updateBehavior('typing', { enabled })}
                disabled={!config.enabled}
              />
            </div>

            <div className="space-y-2">
              <Label className="text-sm">
                Duração Mínima: {config.behavior.typing.minDuration}ms
              </Label>
              <Slider
                value={[config.behavior.typing.minDuration]}
                onValueChange={([value]) => updateBehavior('typing', { minDuration: value })}
                min={500}
                max={3000}
                step={100}
                disabled={!config.enabled || !config.behavior.typing.enabled}
              />
            </div>

            <div className="space-y-2">
              <Label className="text-sm">
                Duração Máxima: {config.behavior.typing.maxDuration}ms
              </Label>
              <Slider
                value={[config.behavior.typing.maxDuration]}
                onValueChange={([value]) => updateBehavior('typing', { maxDuration: value })}
                min={1000}
                max={8000}
                step={200}
                disabled={!config.enabled || !config.behavior.typing.enabled}
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
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label htmlFor="split-enabled">Dividir mensagens longas</Label>
              <Switch
                id="split-enabled"
                checked={config.behavior.messageHandling.splitLongMessages}
                onCheckedChange={(splitLongMessages) => 
                  updateBehavior('messageHandling', { splitLongMessages })
                }
                disabled={!config.enabled}
              />
            </div>

            <div className="space-y-2">
              <Label className="text-sm">
                Caracteres por bloco: {config.behavior.messageHandling.maxCharsPerChunk}
              </Label>
              <Slider
                value={[config.behavior.messageHandling.maxCharsPerChunk]}
                onValueChange={([value]) => 
                  updateBehavior('messageHandling', { maxCharsPerChunk: value })
                }
                min={150}
                max={500}
                step={25}
                disabled={!config.enabled || !config.behavior.messageHandling.splitLongMessages}
              />
            </div>

            <div className="space-y-2">
              <Label className="text-sm">
                Delay entre blocos: {config.behavior.messageHandling.delayBetweenChunks}ms
              </Label>
              <Slider
                value={[config.behavior.messageHandling.delayBetweenChunks]}
                onValueChange={([value]) => 
                  updateBehavior('messageHandling', { delayBetweenChunks: value })
                }
                min={1000}
                max={5000}
                step={250}
                disabled={!config.enabled || !config.behavior.messageHandling.splitLongMessages}
              />
            </div>
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