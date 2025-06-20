
import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Users, Send, Target, Calendar, BarChart3, FileText } from "lucide-react";

const CampaignsManager = () => {
  const [campaigns, setCampaigns] = useState<any[]>([]);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Gerenciar Campanhas</h1>
          <p className="text-gray-600">Crie e gerencie campanhas de mensagens em massa</p>
        </div>
        <Button className="bg-gradient-to-r from-green-500 to-blue-500 hover:from-green-600 hover:to-blue-600">
          <Plus className="w-4 h-4 mr-2" />
          Nova Campanha
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Campanhas Ativas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">0</div>
            <p className="text-xs text-gray-500">Nenhuma campanha criada</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Mensagens Enviadas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">0</div>
            <p className="text-xs text-gray-500">Total de mensagens</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Taxa de Entrega</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">-</div>
            <p className="text-xs text-gray-500">Sem dados</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Taxa de Resposta</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">-</div>
            <p className="text-xs text-gray-500">Sem dados</p>
          </CardContent>
        </Card>
      </div>

      {/* Campaigns List */}
      <Card>
        <CardHeader>
          <CardTitle>Suas Campanhas</CardTitle>
          <CardDescription>Gerencie e monitore suas campanhas de mensagens</CardDescription>
        </CardHeader>
        <CardContent>
          {campaigns.length === 0 ? (
            <div className="text-center py-12">
              <Send className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">Nenhuma campanha criada</h3>
              <p className="text-gray-600 mb-6">
                Crie sua primeira campanha para começar a enviar mensagens em massa
              </p>
              <Button className="bg-green-600 hover:bg-green-700">
                <Plus className="w-4 h-4 mr-2" />
                Criar Primeira Campanha
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {campaigns.map((campaign) => (
                <Card key={campaign.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h3 className="text-lg font-semibold text-gray-900 mb-2">{campaign.name}</h3>
                        <p className="text-sm text-gray-600 mb-4">{campaign.description}</p>
                        
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                          <div>
                            <span className="text-gray-500">Contatos:</span>
                            <span className="font-medium ml-2">{campaign.contacts}</span>
                          </div>
                          <div>
                            <span className="text-gray-500">Enviadas:</span>
                            <span className="font-medium ml-2">{campaign.sent}</span>
                          </div>
                          <div>
                            <span className="text-gray-500">Entregues:</span>
                            <span className="font-medium ml-2">{campaign.delivered}</span>
                          </div>
                          <div>
                            <span className="text-gray-500">Respostas:</span>
                            <span className="font-medium ml-2">{campaign.responses}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center space-x-4 ml-4">
                        <Badge variant={campaign.status === 'active' ? 'default' : 'secondary'}>
                          {campaign.status}
                        </Badge>
                        <div className="flex space-x-2">
                          <Button size="sm" variant="outline">
                            <BarChart3 className="w-4 h-4" />
                          </Button>
                          <Button size="sm" variant="outline">
                            Editar
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

      {/* Quick Actions */}
      <div className="grid md:grid-cols-3 gap-4">
        <Card className="hover:shadow-md transition-shadow cursor-pointer">
          <CardContent className="p-6 text-center">
            <Users className="w-12 h-12 text-blue-500 mx-auto mb-4" />
            <h3 className="font-semibold mb-2">Segmentar Contatos</h3>
            <p className="text-sm text-gray-600 mb-4">Organize seus contatos em grupos específicos</p>
            <Button size="sm" variant="outline" className="w-full">
              Gerenciar Contatos
            </Button>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow cursor-pointer">
          <CardContent className="p-6 text-center">
            <FileText className="w-12 h-12 text-green-500 mx-auto mb-4" />
            <h3 className="font-semibold mb-2">Templates</h3>
            <p className="text-sm text-gray-600 mb-4">Crie templates reutilizáveis para suas mensagens</p>
            <Button size="sm" variant="outline" className="w-full">
              Ver Templates
            </Button>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow cursor-pointer">
          <CardContent className="p-6 text-center">
            <Calendar className="w-12 h-12 text-purple-500 mx-auto mb-4" />
            <h3 className="font-semibold mb-2">Agendar Envios</h3>
            <p className="text-sm text-gray-600 mb-4">Configure envios automáticos em horários específicos</p>
            <Button size="sm" variant="outline" className="w-full">
              Configurar
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Getting Started Guide */}
      <Card className="bg-gradient-to-r from-blue-50 to-green-50 border-blue-200">
        <CardHeader>
          <CardTitle className="text-blue-900">Como criar sua primeira campanha</CardTitle>
          <CardDescription className="text-blue-700">
            Siga estes passos para começar a enviar mensagens em massa
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <h4 className="font-medium mb-3 text-blue-900">Passos básicos:</h4>
              <div className="space-y-2 text-sm text-blue-800">
                <div className="flex items-center space-x-2">
                  <div className="w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center text-white text-xs">1</div>
                  <span>Conecte seu WhatsApp</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center text-white text-xs">2</div>
                  <span>Importe ou adicione contatos</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center text-white text-xs">3</div>
                  <span>Crie uma mensagem ou template</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center text-white text-xs">4</div>
                  <span>Configure e envie sua campanha</span>
                </div>
              </div>
            </div>
            <div>
              <h4 className="font-medium mb-3 text-blue-900">Dicas importantes:</h4>
              <div className="space-y-1 text-sm text-blue-800">
                <p>• Use mensagens personalizadas para maior engajamento</p>
                <p>• Respeite os horários comerciais dos seus contatos</p>
                <p>• Monitore as métricas para otimizar futuras campanhas</p>
                <p>• Sempre obtenha consentimento antes de enviar mensagens</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default CampaignsManager;
