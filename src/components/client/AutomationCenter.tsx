
import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Bot, Plus, Settings, Zap, MessageSquare, Clock, Brain } from "lucide-react";

const AutomationCenter = () => {
  const [automations, setAutomations] = useState<any[]>([]);

  const toggleAutomation = (id: string) => {
    setAutomations(prev => prev.map(automation => 
      automation.id === id 
        ? { ...automation, enabled: !automation.enabled, status: automation.enabled ? 'paused' : 'active' }
        : automation
    ));
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Centro de Automação</h1>
          <p className="text-gray-600">Configure automações e integração com IA</p>
        </div>
        <Button className="bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600">
          <Plus className="w-4 h-4 mr-2" />
          Nova Automação
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Automações Ativas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">0</div>
            <p className="text-xs text-gray-500">Nenhuma automação criada</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Execuções Hoje</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">0</div>
            <p className="text-xs text-gray-500">Sem execuções</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Taxa de Sucesso</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">-</div>
            <p className="text-xs text-gray-500">Sem dados</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Tempo Economizado</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">0h</div>
            <p className="text-xs text-gray-500">Esta semana</p>
          </CardContent>
        </Card>
      </div>

      {/* AI Integration Card */}
      <Card className="border-purple-200 bg-gradient-to-r from-purple-50 to-blue-50">
        <CardHeader>
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-gradient-to-r from-purple-500 to-blue-500 rounded-lg flex items-center justify-center">
              <Bot className="w-6 h-6 text-white" />
            </div>
            <div>
              <CardTitle className="text-lg">Integração com IA</CardTitle>
              <CardDescription>Configure seu assistente de IA personalizado</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <h4 className="font-medium mb-2">Modelos Disponíveis</h4>
              <div className="space-y-2">
                <div className="flex items-center justify-between p-2 bg-white rounded border">
                  <span className="text-sm">GPT-4 Turbo</span>
                  <Badge variant="outline">Disponível</Badge>
                </div>
                <div className="flex items-center justify-between p-2 bg-white rounded border">
                  <span className="text-sm">Claude 3</span>
                  <Badge variant="outline">Disponível</Badge>
                </div>
                <div className="flex items-center justify-between p-2 bg-white rounded border">
                  <span className="text-sm">Llama 2</span>
                  <Badge variant="outline">Disponível</Badge>
                </div>
              </div>
            </div>
            <div>
              <h4 className="font-medium mb-2">Configurações IA</h4>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm">Modo Conversacional</span>
                  <Switch disabled />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Aprendizado Contínuo</span>
                  <Switch disabled />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Escalação Humana</span>
                  <Switch disabled />
                </div>
              </div>
              <Button className="w-full mt-4" variant="outline" disabled>
                <Settings className="w-4 h-4 mr-2" />
                Configurar IA
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Automations List */}
      <Card>
        <CardHeader>
          <CardTitle>Suas Automações</CardTitle>
          <CardDescription>Gerencie todas as automações configuradas</CardDescription>
        </CardHeader>
        <CardContent>
          {automations.length === 0 ? (
            <div className="text-center py-12">
              <Bot className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">Nenhuma automação criada</h3>
              <p className="text-gray-600 mb-6">
                Configure automações para responder mensagens automaticamente e economizar tempo
              </p>
              <Button className="bg-purple-600 hover:bg-purple-700">
                <Plus className="w-4 h-4 mr-2" />
                Criar Primeira Automação
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {automations.map((automation) => (
                <Card key={automation.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start space-x-4 flex-1">
                        <Bot className="w-5 h-5 text-purple-500 mt-1" />
                        <div className="flex-1">
                          <div className="flex items-center space-x-3 mb-2">
                            <h3 className="text-lg font-semibold text-gray-900">{automation.name}</h3>
                            <Badge variant="outline">{automation.type}</Badge>
                          </div>
                          <p className="text-sm text-gray-600 mb-3">{automation.description}</p>
                          
                          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                            <div>
                              <span className="text-gray-500">Execuções:</span>
                              <span className="font-medium ml-2">{automation.executions}</span>
                            </div>
                            <div>
                              <span className="text-gray-500">Última execução:</span>
                              <span className="font-medium ml-2">{automation.lastRun}</span>
                            </div>
                            <div>
                              <span className="text-gray-500">Status:</span>
                              <Badge 
                                variant={automation.status === 'active' ? 'default' : 'secondary'}
                                className="ml-2"
                              >
                                {automation.status === 'active' ? 'Ativa' : 'Pausada'}
                              </Badge>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center space-x-4 ml-4">
                        <div className="flex items-center space-x-2">
                          <span className="text-sm text-gray-600">
                            {automation.enabled ? 'Ativo' : 'Inativo'}
                          </span>
                          <Switch
                            checked={automation.enabled}
                            onCheckedChange={() => toggleAutomation(automation.id)}
                          />
                        </div>
                        <div className="flex space-x-2">
                          <Button size="sm" variant="outline">
                            <Settings className="w-4 h-4" />
                          </Button>
                          <Button size="sm" variant="outline">
                            Relatório
                          </Button>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quick Setup Cards */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        <Card className="hover:shadow-md transition-shadow cursor-pointer">
          <CardContent className="p-6 text-center">
            <MessageSquare className="w-12 h-12 text-blue-500 mx-auto mb-4" />
            <h3 className="font-semibold mb-2">Resposta Automática</h3>
            <p className="text-sm text-gray-600 mb-4">Configure respostas automáticas para mensagens comuns</p>
            <Button size="sm" variant="outline" className="w-full">
              Configurar
            </Button>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow cursor-pointer">
          <CardContent className="p-6 text-center">
            <Brain className="w-12 h-12 text-purple-500 mx-auto mb-4" />
            <h3 className="font-semibold mb-2">Chatbot IA</h3>
            <p className="text-sm text-gray-600 mb-4">Configure um chatbot inteligente para atendimento</p>
            <Button size="sm" variant="outline" className="w-full">
              Configurar
            </Button>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow cursor-pointer">
          <CardContent className="p-6 text-center">
            <Clock className="w-12 h-12 text-orange-500 mx-auto mb-4" />
            <h3 className="font-semibold mb-2">Agendamento</h3>
            <p className="text-sm text-gray-600 mb-4">Configure mensagens agendadas e recorrentes</p>
            <Button size="sm" variant="outline" className="w-full">
              Configurar
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Getting Started */}
      <Card className="bg-gradient-to-r from-purple-50 to-blue-50 border-purple-200">
        <CardHeader>
          <CardTitle className="text-purple-900">Primeiros passos com automação</CardTitle>
          <CardDescription className="text-purple-700">
            Configure sua primeira automação e economize tempo no atendimento
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <h4 className="font-medium mb-3 text-purple-900">Tipos de automação:</h4>
              <div className="space-y-2 text-sm text-purple-800">
                <div className="flex items-center space-x-2">
                  <MessageSquare className="w-4 h-4" />
                  <span>Respostas automáticas por palavras-chave</span>
                </div>
                <div className="flex items-center space-x-2">
                  <Clock className="w-4 h-4" />
                  <span>Mensagens de boas-vindas</span>
                </div>
                <div className="flex items-center space-x-2">
                  <Brain className="w-4 h-4" />
                  <span>Chatbot com inteligência artificial</span>
                </div>
                <div className="flex items-center space-x-2">
                  <Zap className="w-4 h-4" />
                  <span>Follow-up automático de vendas</span>
                </div>
              </div>
            </div>
            <div>
              <h4 className="font-medium mb-3 text-purple-900">Benefícios:</h4>
              <div className="space-y-1 text-sm text-purple-800">
                <p>• Atendimento 24/7 sem intervenção manual</p>
                <p>• Respostas instantâneas para perguntas frequentes</p>
                <p>• Qualificação automática de leads</p>
                <p>• Redução significativa no tempo de resposta</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AutomationCenter;
