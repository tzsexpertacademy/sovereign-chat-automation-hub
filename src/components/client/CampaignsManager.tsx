import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Play, Pause, BarChart3, Users, MessageSquare } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const CampaignsManager = () => {
  const [activeTab, setActiveTab] = useState("active");

  const campaigns = [
    {
      id: "1",
      name: "Promoção Janeiro 2024",
      status: "active" as const,
      type: "promotional",
      contacts: 450,
      sent: 285,
      delivered: 268,
      read: 142,
      responses: 23,
      created: "15/01/2024",
      scheduled: "16/01/2024 09:00"
    },
    {
      id: "2",
      name: "Follow-up Vendas",
      status: "paused" as const, 
      type: "follow-up",
      contacts: 120,
      sent: 120,
      delivered: 115,
      read: 89,
      responses: 34,
      created: "10/01/2024",
      scheduled: null
    },
    {
      id: "3",
      name: "Boas-vindas Novos Clientes",
      status: "completed" as const,
      type: "welcome",
      contacts: 85,
      sent: 85,
      delivered: 82,
      read: 74,
      responses: 12,
      created: "05/01/2024",
      scheduled: null
    }
  ];

  const getStatusBadge = (status: string): "default" | "secondary" | "outline" => {
    switch (status) {
      case 'active':
        return "default";
      case 'paused':
        return "secondary";
      case 'completed':
        return "outline";
      case 'scheduled':
        return "secondary";
      default:
        return "secondary";
    }
  };

  const getStatusText = (status: string) => {
    const texts = {
      active: "Ativa",
      paused: "Pausada",
      completed: "Concluída", 
      scheduled: "Agendada"
    };
    return texts[status as keyof typeof texts] || status;
  };

  const filteredCampaigns = campaigns.filter(campaign => {
    if (activeTab === "all") return true;
    if (activeTab === "active") return campaign.status === "active";
    if (activeTab === "scheduled") return campaign.status === "scheduled";
    if (activeTab === "completed") return campaign.status === "completed";
    return true;
  });

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
            <div className="text-2xl font-bold text-green-600">3</div>
            <p className="text-xs text-gray-500">Em andamento</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Mensagens Enviadas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">1,247</div>
            <p className="text-xs text-green-600">+23% este mês</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Taxa de Entrega</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">94.2%</div>
            <p className="text-xs text-gray-500">Média geral</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Taxa de Resposta</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">18.7%</div>
            <p className="text-xs text-green-600">+5% vs mês anterior</p>
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
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="all">Todas</TabsTrigger>
              <TabsTrigger value="active">Ativas</TabsTrigger>
              <TabsTrigger value="scheduled">Agendadas</TabsTrigger>
              <TabsTrigger value="completed">Concluídas</TabsTrigger>
            </TabsList>
            
            <TabsContent value={activeTab} className="mt-6">
              <div className="space-y-4">
                {filteredCampaigns.map((campaign) => (
                  <Card key={campaign.id} className="hover:shadow-md transition-shadow">
                    <CardContent className="p-6">
                      <div className="flex justify-between items-start mb-4">
                        <div>
                          <h3 className="text-lg font-semibold text-gray-900">{campaign.name}</h3>
                          <p className="text-sm text-gray-500">
                            Criada em {campaign.created}
                            {campaign.scheduled && ` • Agendada para ${campaign.scheduled}`}
                          </p>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Badge variant={getStatusBadge(campaign.status)}>
                            {getStatusText(campaign.status)}
                          </Badge>
                          <Badge variant="outline">{campaign.type}</Badge>
                        </div>
                      </div>

                      {/* Campaign Stats */}
                      <div className="grid grid-cols-2 md:grid-cols-6 gap-4 mb-4">
                        <div className="text-center">
                          <div className="flex items-center justify-center mb-1">
                            <Users className="w-4 h-4 text-gray-500 mr-1" />
                            <span className="text-sm font-medium">{campaign.contacts}</span>
                          </div>
                          <p className="text-xs text-gray-500">Contatos</p>
                        </div>
                        <div className="text-center">
                          <div className="flex items-center justify-center mb-1">
                            <MessageSquare className="w-4 h-4 text-blue-500 mr-1" />
                            <span className="text-sm font-medium">{campaign.sent}</span>
                          </div>
                          <p className="text-xs text-gray-500">Enviadas</p>
                        </div>
                        <div className="text-center">
                          <div className="flex items-center justify-center mb-1">
                            <span className="w-4 h-4 text-green-500 mr-1">✓</span>
                            <span className="text-sm font-medium">{campaign.delivered}</span>
                          </div>
                          <p className="text-xs text-gray-500">Entregues</p>
                        </div>
                        <div className="text-center">
                          <div className="flex items-center justify-center mb-1">
                            <span className="w-4 h-4 text-purple-500 mr-1">👁</span>
                            <span className="text-sm font-medium">{campaign.read}</span>
                          </div>
                          <p className="text-xs text-gray-500">Lidas</p>
                        </div>
                        <div className="text-center">
                          <div className="flex items-center justify-center mb-1">
                            <span className="w-4 h-4 text-orange-500 mr-1">💬</span>
                            <span className="text-sm font-medium">{campaign.responses}</span>
                          </div>
                          <p className="text-xs text-gray-500">Respostas</p>
                        </div>
                        <div className="text-center">
                          <div className="flex items-center justify-center mb-1">
                            <BarChart3 className="w-4 h-4 text-gray-500 mr-1" />
                            <span className="text-sm font-medium">
                              {((campaign.responses / campaign.sent) * 100).toFixed(1)}%
                            </span>
                          </div>
                          <p className="text-xs text-gray-500">Taxa Resp.</p>
                        </div>
                      </div>

                      {/* Progress Bar */}
                      <div className="mb-4">
                        <div className="flex justify-between text-sm mb-1">
                          <span>Progresso</span>
                          <span>{Math.round((campaign.sent / campaign.contacts) * 100)}%</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div 
                            className="bg-green-500 h-2 rounded-full transition-all"
                            style={{ width: `${(campaign.sent / campaign.contacts) * 100}%` }}
                          />
                        </div>
                      </div>

                      {/* Action Buttons */}
                      <div className="flex space-x-2">
                        {campaign.status === 'active' ? (
                          <Button size="sm" variant="outline">
                            <Pause className="w-4 h-4 mr-1" />
                            Pausar
                          </Button>
                        ) : campaign.status === 'paused' ? (
                          <Button size="sm" className="bg-green-600 hover:bg-green-700">
                            <Play className="w-4 h-4 mr-1" />
                            Retomar
                          </Button>
                        ) : null}
                        <Button size="sm" variant="outline">
                          <BarChart3 className="w-4 h-4 mr-1" />
                          Relatório
                        </Button>
                        <Button size="sm" variant="outline">
                          Editar
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};

export default CampaignsManager;
