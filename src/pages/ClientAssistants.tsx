
import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Bot, Settings, Key, CheckCircle, AlertCircle } from "lucide-react";
import ClientHeader from '@/components/client/ClientHeader';
import AIConfigForm from '@/components/client/AIConfigForm';
import AIConfigIndicator from '@/components/client/AIConfigIndicator';
import AssistantsManager from '@/components/client/AssistantsManager';
import { aiConfigService, type AIConfig } from '@/services/aiConfigService';
import { useToast } from '@/components/ui/use-toast';

const ClientAssistants = () => {
  const { clientId } = useParams<{ clientId: string }>();
  const [showConfigForm, setShowConfigForm] = useState(false);
  const [config, setConfig] = useState<AIConfig | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    if (clientId) {
      loadConfig();
    }
  }, [clientId]);

  const loadConfig = async () => {
    if (!clientId) return;
    
    try {
      setIsLoading(true);
      const configData = await aiConfigService.getClientConfig(clientId);
      setConfig(configData);
      console.log('🔍 [CLIENT-ASSISTANTS] Configuração carregada:', !!configData?.openai_api_key);
    } catch (error) {
      console.error('❌ [CLIENT-ASSISTANTS] Erro ao carregar configuração:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfigSave = () => {
    setShowConfigForm(false);
    loadConfig(); // Recarregar configuração
    toast({
      title: "✅ Configuração Salva",
      description: "Sua chave API da OpenAI foi configurada com sucesso",
    });
  };

  if (!clientId) {
    return <div>Cliente não encontrado</div>;
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-100">
        <ClientHeader clientId={clientId} />
        <div className="container mx-auto px-6 py-8">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-gray-200 rounded w-1/3"></div>
            <div className="h-32 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  const hasConfig = config && config.openai_api_key;

  return (
    <div className="min-h-screen bg-gray-100">
      <ClientHeader clientId={clientId} />
      
      <div className="container mx-auto px-6 py-8">
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <Bot className="h-8 w-8 text-blue-600" />
            <h1 className="text-3xl font-bold">Assistentes de IA</h1>
          </div>
          <p className="text-muted-foreground">
            Configure e gerencie seus assistentes inteligentes com OpenAI
          </p>
        </div>

        {/* Status da Configuração */}
        <div className="mb-6">
          <AIConfigIndicator clientId={clientId} />
        </div>

        {showConfigForm ? (
          <AIConfigForm
            clientId={clientId}
            config={config}
            onSave={handleConfigSave}
            onCancel={() => setShowConfigForm(false)}
          />
        ) : (
          <Tabs defaultValue={hasConfig ? "assistants" : "config"} className="space-y-6">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="config" className="flex items-center gap-2">
                <Settings className="h-4 w-4" />
                Configuração API
              </TabsTrigger>
              <TabsTrigger value="assistants" className="flex items-center gap-2" disabled={!hasConfig}>
                <Bot className="h-4 w-4" />
                Meus Assistentes
              </TabsTrigger>
            </TabsList>

            <TabsContent value="config" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Key className="h-5 w-5" />
                    Configuração da API OpenAI
                  </CardTitle>
                  <CardDescription>
                    Configure sua chave API da OpenAI para usar os assistentes de IA
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {hasConfig ? (
                    <div className="space-y-4">
                      <div className="flex items-center gap-2 text-green-600">
                        <CheckCircle className="h-5 w-5" />
                        <span className="font-medium">API configurada com sucesso!</span>
                      </div>
                      
                      <div className="bg-gray-50 p-4 rounded-lg space-y-2">
                        <div className="text-sm">
                          <span className="font-medium">Modelo padrão:</span> {config.default_model}
                        </div>
                        <div className="text-sm">
                          <span className="font-medium">Chave API:</span> sk-...{config.openai_api_key.slice(-4)}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          Configurado em: {new Date(config.updated_at).toLocaleDateString('pt-BR')}
                        </div>
                      </div>

                      <div className="flex gap-3">
                        <Button onClick={() => setShowConfigForm(true)}>
                          <Settings className="h-4 w-4 mr-2" />
                          Alterar Configuração
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="flex items-center gap-2 text-amber-600">
                        <AlertCircle className="h-5 w-5" />
                        <span className="font-medium">API não configurada</span>
                      </div>
                      
                      <p className="text-muted-foreground">
                        Para usar os assistentes de IA, você precisa configurar sua chave API da OpenAI.
                        Cada cliente usa sua própria chave API para garantir controle total sobre o uso.
                      </p>

                      <Button onClick={() => setShowConfigForm(true)}>
                        <Key className="h-4 w-4 mr-2" />
                        Configurar API OpenAI
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>

              {hasConfig && (
                <Card>
                  <CardHeader>
                    <CardTitle>Como funciona</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm text-muted-foreground">
                    <div>✅ Sua chave API é armazenada com segurança</div>
                    <div>✅ Cada assistente usa sua configuração</div>
                    <div>✅ Você controla o modelo e custos</div>
                    <div>✅ Privacidade total dos seus dados</div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="assistants" className="space-y-6">
              {hasConfig ? (
                <AssistantsManager />
              ) : (
                <Card>
                  <CardContent className="p-8 text-center">
                    <Bot className="h-16 w-16 mx-auto text-gray-400 mb-4" />
                    <h3 className="text-lg font-medium mb-2">Configure sua API primeiro</h3>
                    <p className="text-muted-foreground mb-4">
                      Para criar assistentes, você precisa configurar sua chave API da OpenAI na aba "Configuração API".
                    </p>
                    <Button onClick={() => setShowConfigForm(true)}>
                      <Key className="h-4 w-4 mr-2" />
                      Configurar Agora
                    </Button>
                  </CardContent>
                </Card>
              )}
            </TabsContent>
          </Tabs>
        )}
      </div>
    </div>
  );
};

export default ClientAssistants;
