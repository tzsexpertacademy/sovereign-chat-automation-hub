import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Brain, Activity, MessageSquare, Clock, Heart, Zap, Eye, Mic2 } from "lucide-react";
import { useHumanizedWhatsApp, HumanizedPersonality } from "@/hooks/useHumanizedWhatsApp";

interface HumanizationDashboardProps {
  clientId: string;
}

const HumanizationDashboard = ({ clientId }: HumanizationDashboardProps) => {
  const humanizedWhatsApp = useHumanizedWhatsApp(clientId);
  const [selectedPersonality, setSelectedPersonality] = useState<HumanizedPersonality>(
    humanizedWhatsApp.config.personality
  );

  const stats = humanizedWhatsApp.getHumanizationStats();

  const personalityPresets: HumanizedPersonality[] = [
    {
      name: 'Assistente Profissional',
      tone: 'professional',
      responseDelay: { min: 3000, max: 6000 },
      typingSpeed: 60,
      reactionProbability: 0.2,
      emotionalLevel: 0.3,
      contextAwareness: true,
      voiceCloning: false,
      audioProcessing: true
    },
    {
      name: 'Amigo Casual',
      tone: 'casual',
      responseDelay: { min: 1000, max: 3000 },
      typingSpeed: 35,
      reactionProbability: 0.7,
      emotionalLevel: 0.8,
      contextAwareness: true,
      voiceCloning: true,
      audioProcessing: true
    },
    {
      name: 'Suporte Empático',
      tone: 'empathetic',
      responseDelay: { min: 2000, max: 5000 },
      typingSpeed: 40,
      reactionProbability: 0.5,
      emotionalLevel: 0.9,
      contextAwareness: true,
      voiceCloning: false,
      audioProcessing: true
    },
    {
      name: 'Vendedor Amigável',
      tone: 'friendly',
      responseDelay: { min: 1500, max: 4000 },
      typingSpeed: 50,
      reactionProbability: 0.6,
      emotionalLevel: 0.7,
      contextAwareness: true,
      voiceCloning: true,
      audioProcessing: true
    }
  ];

  const handlePersonalityChange = (field: keyof HumanizedPersonality, value: any) => {
    setSelectedPersonality(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const applyPersonality = () => {
    humanizedWhatsApp.updatePersonality(selectedPersonality);
  };

  const loadPreset = (preset: HumanizedPersonality) => {
    setSelectedPersonality(preset);
    humanizedWhatsApp.updatePersonality(preset);
  };

  return (
    <div className="w-full max-w-6xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold">Dashboard de Humanização</h2>
          <p className="text-muted-foreground">
            Configure o comportamento humanizado para a instância {clientId}
          </p>
        </div>
        <Badge variant={humanizedWhatsApp.config.enabled ? "default" : "secondary"}>
          {humanizedWhatsApp.config.enabled ? "Humanização Ativa" : "Desabilitado"}
        </Badge>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Status</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats.isProcessing ? "Processando" : "Aguardando"}
            </div>
            <p className="text-xs text-muted-foreground">
              {stats.onlineStatus ? "Online" : "Offline"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Conversas Ativas</CardTitle>
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.conversationContexts}</div>
            <p className="text-xs text-muted-foreground">
              {stats.activeBatches} lotes pendentes
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Logs Totais</CardTitle>
            <Eye className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalLogs}</div>
            <p className="text-xs text-muted-foreground">
              Eventos humanizados
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Personalidade</CardTitle>
            <Brain className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.personality.name}</div>
            <p className="text-xs text-muted-foreground">
              Tom: {stats.personality.tone}
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="personality" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="personality">Personalidade</TabsTrigger>
          <TabsTrigger value="presets">Presets</TabsTrigger>
          <TabsTrigger value="logs">Logs</TabsTrigger>
          <TabsTrigger value="settings">Configurações</TabsTrigger>
        </TabsList>

        <TabsContent value="personality" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Brain className="h-5 w-5" />
                Configuração de Personalidade
              </CardTitle>
              <CardDescription>
                Ajuste como a IA se comporta e responde às mensagens
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="personality-name">Nome da Personalidade</Label>
                    <Input
                      id="personality-name"
                      value={selectedPersonality.name}
                      onChange={(e) => handlePersonalityChange('name', e.target.value)}
                    />
                  </div>

                  <div>
                    <Label htmlFor="tone">Tom de Conversa</Label>
                    <Select
                      value={selectedPersonality.tone}
                      onValueChange={(value) => handlePersonalityChange('tone', value)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="formal">Formal</SelectItem>
                        <SelectItem value="casual">Casual</SelectItem>
                        <SelectItem value="friendly">Amigável</SelectItem>
                        <SelectItem value="professional">Profissional</SelectItem>
                        <SelectItem value="empathetic">Empático</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label>Velocidade de Digitação (WPM): {selectedPersonality.typingSpeed}</Label>
                    <Slider
                      value={[selectedPersonality.typingSpeed]}
                      onValueChange={([value]) => handlePersonalityChange('typingSpeed', value)}
                      min={20}
                      max={80}
                      step={5}
                    />
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <Label>Delay de Resposta (ms)</Label>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label htmlFor="delay-min" className="text-xs">Mínimo</Label>
                        <Input
                          id="delay-min"
                          type="number"
                          value={selectedPersonality.responseDelay.min}
                          onChange={(e) => handlePersonalityChange('responseDelay', {
                            ...selectedPersonality.responseDelay,
                            min: parseInt(e.target.value)
                          })}
                        />
                      </div>
                      <div>
                        <Label htmlFor="delay-max" className="text-xs">Máximo</Label>
                        <Input
                          id="delay-max"
                          type="number"
                          value={selectedPersonality.responseDelay.max}
                          onChange={(e) => handlePersonalityChange('responseDelay', {
                            ...selectedPersonality.responseDelay,
                            max: parseInt(e.target.value)
                          })}
                        />
                      </div>
                    </div>
                  </div>

                  <div>
                    <Label>Probabilidade de Reação: {Math.round(selectedPersonality.reactionProbability * 100)}%</Label>
                    <Slider
                      value={[selectedPersonality.reactionProbability]}
                      onValueChange={([value]) => handlePersonalityChange('reactionProbability', value)}
                      min={0}
                      max={1}
                      step={0.1}
                    />
                  </div>

                  <div>
                    <Label>Nível Emocional: {Math.round(selectedPersonality.emotionalLevel * 100)}%</Label>
                    <Slider
                      value={[selectedPersonality.emotionalLevel]}
                      onValueChange={([value]) => handlePersonalityChange('emotionalLevel', value)}
                      min={0}
                      max={1}
                      step={0.1}
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="flex items-center justify-between">
                  <Label htmlFor="context-awareness" className="flex items-center gap-2">
                    <Eye className="h-4 w-4" />
                    Consciência Contextual
                  </Label>
                  <Switch
                    id="context-awareness"
                    checked={selectedPersonality.contextAwareness}
                    onCheckedChange={(checked) => handlePersonalityChange('contextAwareness', checked)}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <Label htmlFor="voice-cloning" className="flex items-center gap-2">
                    <Mic2 className="h-4 w-4" />
                    Clonagem de Voz
                  </Label>
                  <Switch
                    id="voice-cloning"
                    checked={selectedPersonality.voiceCloning}
                    onCheckedChange={(checked) => handlePersonalityChange('voiceCloning', checked)}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <Label htmlFor="audio-processing" className="flex items-center gap-2">
                    <Zap className="h-4 w-4" />
                    Processamento de Áudio
                  </Label>
                  <Switch
                    id="audio-processing"
                    checked={selectedPersonality.audioProcessing}
                    onCheckedChange={(checked) => handlePersonalityChange('audioProcessing', checked)}
                  />
                </div>
              </div>

              <Button onClick={applyPersonality} className="w-full">
                Aplicar Personalidade
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="presets" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Presets de Personalidade</CardTitle>
              <CardDescription>
                Use configurações pré-definidas para diferentes cenários
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {personalityPresets.map((preset, index) => (
                  <Card key={index} className="cursor-pointer hover:shadow-md transition-shadow">
                    <CardHeader>
                      <CardTitle className="text-lg">{preset.name}</CardTitle>
                      <CardDescription>
                        {preset.tone} • {preset.typingSpeed} WPM • {Math.round(preset.emotionalLevel * 100)}% emocional
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center justify-between">
                        <div className="flex gap-2">
                          {preset.contextAwareness && <Badge variant="outline">Contextual</Badge>}
                          {preset.voiceCloning && <Badge variant="outline">Voz</Badge>}
                          {preset.audioProcessing && <Badge variant="outline">Áudio</Badge>}
                        </div>
                        <Button onClick={() => loadPreset(preset)} size="sm">
                          Aplicar
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="logs" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                Logs de Humanização
              </CardTitle>
              <CardDescription>
                Acompanhe todas as atividades humanizadas em tempo real
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-96 w-full">
                <div className="space-y-4">
                  {humanizedWhatsApp.humanizationLogs.slice(-20).reverse().map((log, index) => (
                    <div key={index} className="border rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <Badge variant="outline">{log.chatId}</Badge>
                        <span className="text-sm text-muted-foreground">
                          {new Date(log.timestamp).toLocaleTimeString()}
                        </span>
                      </div>
                      <div className="text-sm">
                        <p><strong>Mensagens:</strong> {log.messagesCount}</p>
                        <p><strong>Personalidade:</strong> {log.personality}</p>
                        <p><strong>Ações:</strong> {log.actions.length}</p>
                      </div>
                      {log.actions.length > 0 && (
                        <div className="mt-2 space-y-1">
                          {log.actions.map((action, actionIndex) => (
                            <Badge key={actionIndex} variant="secondary" className="mr-2">
                              {action.type}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settings" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Configurações Gerais</CardTitle>
              <CardDescription>
                Configurações avançadas de humanização e integração
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <Label htmlFor="humanization-enabled">Humanização Habilitada</Label>
                <Switch
                  id="humanization-enabled"
                  checked={humanizedWhatsApp.config.enabled}
                  onCheckedChange={(checked) => 
                    humanizedWhatsApp.setConfig(prev => ({ ...prev, enabled: checked }))
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="openai-key">Chave OpenAI (opcional)</Label>
                <Input
                  id="openai-key"
                  type="password"
                  placeholder="sk-..."
                  value={humanizedWhatsApp.config.openaiConfig?.apiKey || ''}
                  onChange={(e) =>
                    humanizedWhatsApp.setConfig(prev => ({
                      ...prev,
                      openaiConfig: {
                        ...prev.openaiConfig,
                        apiKey: e.target.value,
                        model: prev.openaiConfig?.model || 'gpt-4o-mini',
                        temperature: prev.openaiConfig?.temperature || 0.7
                      }
                    }))
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="elevenlabs-key">Chave ElevenLabs (opcional)</Label>
                <Input
                  id="elevenlabs-key"
                  type="password"
                  placeholder="..."
                  value={humanizedWhatsApp.config.elevenLabsConfig?.apiKey || ''}
                  onChange={(e) =>
                    humanizedWhatsApp.setConfig(prev => ({
                      ...prev,
                      elevenLabsConfig: {
                        ...prev.elevenLabsConfig,
                        apiKey: e.target.value,
                        voiceId: prev.elevenLabsConfig?.voiceId || 'pNInz6obpgDQGcFmaJgB'
                      }
                    }))
                  }
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default HumanizationDashboard;