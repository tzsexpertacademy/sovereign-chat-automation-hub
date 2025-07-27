/**
 * Gerenciador do Assistente Humanizado - Interface de Controle
 * Fase 1: Interface básica de configuração e monitoramento
 */

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Activity, Bot, MessageSquare, Settings, Users, Zap } from 'lucide-react';
import humanizedAssistantService, { HumanizedPersonality, HumanizedConfig, HumanizationStats } from '@/services/humanizedAssistantService';

interface HumanizedAssistantManagerProps {
  clientId: string;
}

export const HumanizedAssistantManager = ({ clientId }: HumanizedAssistantManagerProps) => {
  const [config, setConfig] = useState<HumanizedConfig>(humanizedAssistantService.getConfig());
  const [stats, setStats] = useState<HumanizationStats>(humanizedAssistantService.getStats());
  const [personalities] = useState<HumanizedPersonality[]>(humanizedAssistantService.getPersonalities());
  const [isLoading, setIsLoading] = useState(false);

  // Atualizar stats a cada 5 segundos
  useEffect(() => {
    const interval = setInterval(() => {
      setStats(humanizedAssistantService.getStats());
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  // Handlers de configuração
  const handleToggleService = async (enabled: boolean) => {
    setIsLoading(true);
    try {
      if (enabled) {
        humanizedAssistantService.enable();
      } else {
        humanizedAssistantService.disable();
      }
      setConfig(humanizedAssistantService.getConfig());
    } finally {
      setIsLoading(false);
    }
  };

  const handlePersonalityChange = (personalityId: string) => {
    humanizedAssistantService.setPersonality(personalityId);
    setConfig(humanizedAssistantService.getConfig());
  };

  const handleConfigUpdate = (updates: Partial<HumanizedConfig>) => {
    humanizedAssistantService.setConfig(updates);
    setConfig(humanizedAssistantService.getConfig());
  };

  const handleTestMessage = async () => {
    setIsLoading(true);
    try {
      // Simular uma mensagem de teste
      const testResult = await humanizedAssistantService.processIncomingMessage(
        clientId,
        'test_chat_humanized',
        'Olá! Este é um teste do assistente humanizado.',
        'test_message_id'
      );
      
      console.log('🧪 Teste do assistente humanizado:', testResult);
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusColor = () => {
    if (!config.enabled) return 'destructive';
    if (stats.activeChatIds.length > 0) return 'default';
    return 'secondary';
  };

  const getStatusText = () => {
    if (!config.enabled) return 'Desabilitado';
    if (stats.activeChatIds.length > 0) return 'Processando';
    return 'Aguardando';
  };

  return (
    <div className="space-y-6">
      {/* Status Geral */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Bot className="h-5 w-5" />
              <CardTitle>Assistente Humanizado</CardTitle>
            </div>
            <Badge variant={getStatusColor()}>{getStatusText()}</Badge>
          </div>
          <CardDescription>
            Sistema de comportamento humanizado para WhatsApp com personalidades configuráveis
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="humanized-toggle">Ativar Assistente Humanizado</Label>
              <p className="text-sm text-muted-foreground">
                Simula comportamentos humanos naturais nas conversas
              </p>
            </div>
            <Switch
              id="humanized-toggle"
              checked={config.enabled}
              onCheckedChange={handleToggleService}
              disabled={isLoading}
            />
          </div>
        </CardContent>
      </Card>

      {config.enabled && (
        <Tabs defaultValue="personality" className="space-y-4">
          <TabsList>
            <TabsTrigger value="personality">Personalidade</TabsTrigger>
            <TabsTrigger value="behavior">Comportamento</TabsTrigger>
            <TabsTrigger value="stats">Estatísticas</TabsTrigger>
            <TabsTrigger value="test">Teste</TabsTrigger>
          </TabsList>

          {/* Personalidade */}
          <TabsContent value="personality" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Users className="h-4 w-4" />
                  <span>Personalidade Ativa</span>
                </CardTitle>
                <CardDescription>
                  Configure o tom e comportamento do assistente
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Personalidade</Label>
                  <Select value={config.personality.id} onValueChange={handlePersonalityChange}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione uma personalidade" />
                    </SelectTrigger>
                    <SelectContent>
                      {personalities.map((personality) => (
                        <SelectItem key={personality.id} value={personality.id}>
                          <div>
                            <div className="font-medium">{personality.name}</div>
                            <div className="text-sm text-muted-foreground">
                              Tom: {personality.tone} • Velocidade: {personality.typingSpeed} WPM
                            </div>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Nível Emocional: {Math.round(config.personality.emotionalLevel * 100)}%</Label>
                    <Progress value={config.personality.emotionalLevel * 100} />
                  </div>
                  <div className="space-y-2">
                    <Label>Probabilidade de Reação: {Math.round(config.personality.reactionProbability * 100)}%</Label>
                    <Progress value={config.personality.reactionProbability * 100} />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Delay de Resposta</Label>
                  <div className="text-sm text-muted-foreground">
                    {config.personality.responseDelay.min}ms - {config.personality.responseDelay.max}ms
                  </div>
                  <Progress 
                    value={(config.personality.responseDelay.max / 10000) * 100} 
                    className="h-2"
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Comportamento */}
          <TabsContent value="behavior" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Settings className="h-4 w-4" />
                  <span>Configurações de Comportamento</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Typing */}
                <div className="space-y-4">
                  <h4 className="text-sm font-medium">Simulação de Digitação</h4>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label>Ativar indicador de digitação</Label>
                      <Switch
                        checked={config.behavior.typing.enabled}
                        onCheckedChange={(enabled) => 
                          handleConfigUpdate({
                            behavior: {
                              ...config.behavior,
                              typing: { ...config.behavior.typing, enabled }
                            }
                          })
                        }
                      />
                    </div>
                    
                    {config.behavior.typing.enabled && (
                      <div className="space-y-2">
                        <Label>Duração: {config.behavior.typing.minDuration}ms - {config.behavior.typing.maxDuration}ms</Label>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <Label className="text-xs">Mínimo</Label>
                            <Slider
                              value={[config.behavior.typing.minDuration]}
                              onValueChange={([value]) =>
                                handleConfigUpdate({
                                  behavior: {
                                    ...config.behavior,
                                    typing: { ...config.behavior.typing, minDuration: value }
                                  }
                                })
                              }
                              max={5000}
                              min={500}
                              step={100}
                            />
                          </div>
                          <div>
                            <Label className="text-xs">Máximo</Label>
                            <Slider
                              value={[config.behavior.typing.maxDuration]}
                              onValueChange={([value]) =>
                                handleConfigUpdate({
                                  behavior: {
                                    ...config.behavior,
                                    typing: { ...config.behavior.typing, maxDuration: value }
                                  }
                                })
                              }
                              max={10000}
                              min={1000}
                              step={100}
                            />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <Separator />

                {/* Presença */}
                <div className="space-y-4">
                  <h4 className="text-sm font-medium">Status de Presença</h4>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label>Mostrar como online</Label>
                      <Switch
                        checked={config.behavior.presence.showOnline}
                        onCheckedChange={(showOnline) =>
                          handleConfigUpdate({
                            behavior: {
                              ...config.behavior,
                              presence: { ...config.behavior.presence, showOnline }
                            }
                          })
                        }
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <Label>Mostrar digitação</Label>
                      <Switch
                        checked={config.behavior.presence.showTyping}
                        onCheckedChange={(showTyping) =>
                          handleConfigUpdate({
                            behavior: {
                              ...config.behavior,
                              presence: { ...config.behavior.presence, showTyping }
                            }
                          })
                        }
                      />
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Mensagens */}
                <div className="space-y-4">
                  <h4 className="text-sm font-medium">Tratamento de Mensagens</h4>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label>Dividir mensagens longas</Label>
                      <Switch
                        checked={config.behavior.messageHandling.splitLongMessages}
                        onCheckedChange={(splitLongMessages) =>
                          handleConfigUpdate({
                            behavior: {
                              ...config.behavior,
                              messageHandling: { ...config.behavior.messageHandling, splitLongMessages }
                            }
                          })
                        }
                      />
                    </div>
                    
                    {config.behavior.messageHandling.splitLongMessages && (
                      <div className="space-y-2">
                        <Label>Máx. caracteres por chunk: {config.behavior.messageHandling.maxCharsPerChunk}</Label>
                        <Slider
                          value={[config.behavior.messageHandling.maxCharsPerChunk]}
                          onValueChange={([value]) =>
                            handleConfigUpdate({
                              behavior: {
                                ...config.behavior,
                                messageHandling: { ...config.behavior.messageHandling, maxCharsPerChunk: value }
                              }
                            })
                          }
                          max={500}
                          min={100}
                          step={50}
                        />
                      </div>
                    )}
                    
                    <div className="flex items-center justify-between">
                      <Label>Marcar como lida automaticamente</Label>
                      <Switch
                        checked={config.behavior.messageHandling.markAsRead}
                        onCheckedChange={(markAsRead) =>
                          handleConfigUpdate({
                            behavior: {
                              ...config.behavior,
                              messageHandling: { ...config.behavior.messageHandling, markAsRead }
                            }
                          })
                        }
                      />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Estatísticas */}
          <TabsContent value="stats" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center space-x-2">
                    <MessageSquare className="h-4 w-4 text-blue-600" />
                    <div>
                      <p className="text-2xl font-bold">{stats.totalProcessed}</p>
                      <p className="text-xs text-muted-foreground">Mensagens Processadas</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center space-x-2">
                    <Zap className="h-4 w-4 text-green-600" />
                    <div>
                      <p className="text-2xl font-bold">{stats.totalSent}</p>
                      <p className="text-xs text-muted-foreground">Respostas Enviadas</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center space-x-2">
                    <Activity className="h-4 w-4 text-orange-600" />
                    <div>
                      <p className="text-2xl font-bold">{Math.round(stats.avgResponseTime)}ms</p>
                      <p className="text-xs text-muted-foreground">Tempo Médio de Resposta</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center space-x-2">
                    <Users className="h-4 w-4 text-purple-600" />
                    <div>
                      <p className="text-2xl font-bold">{stats.activeChatIds.length}</p>
                      <p className="text-xs text-muted-foreground">Chats Ativos</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Informações Detalhadas</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Personalidade Ativa</Label>
                    <p className="text-sm font-medium">{stats.personality}</p>
                  </div>
                  <div>
                    <Label>Última Atividade</Label>
                    <p className="text-sm">
                      {stats.lastActivity 
                        ? new Date(stats.lastActivity).toLocaleString('pt-BR')
                        : 'Nenhuma'
                      }
                    </p>
                  </div>
                </div>

                {stats.activeChatIds.length > 0 && (
                  <div>
                    <Label>Chats Ativos ({stats.activeChatIds.length})</Label>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {stats.activeChatIds.map((chatId) => (
                        <Badge key={chatId} variant="outline" className="text-xs">
                          {chatId.substring(0, 10)}...
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Teste */}
          <TabsContent value="test" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Testar Assistente Humanizado</CardTitle>
                <CardDescription>
                  Envie uma mensagem de teste para verificar o funcionamento
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Button 
                  onClick={handleTestMessage} 
                  disabled={isLoading || !config.enabled}
                  className="w-full"
                >
                  {isLoading ? 'Enviando...' : 'Enviar Mensagem de Teste'}
                </Button>
                
                <div className="text-sm text-muted-foreground">
                  <p>Este teste irá:</p>
                  <ul className="list-disc list-inside mt-1 space-y-1">
                    <li>Simular uma mensagem recebida</li>
                    <li>Aplicar comportamentos humanizados</li>
                    <li>Gerar resposta com a personalidade selecionada</li>
                    <li>Mostrar o resultado no console</li>
                  </ul>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
};

export default HumanizedAssistantManager;