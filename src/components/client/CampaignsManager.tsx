import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Send, Target, Calendar, BarChart3, FileText, Users, TrendingUp, Download, Upload, Filter } from "lucide-react";
import CampaignWizard from "./CampaignWizard";
import ContactUploadModal from "./ContactUploadModal";
import { campaignService } from "@/services/campaignService";
import { useToast } from "@/hooks/use-toast";

interface CampaignsManagerProps {
  clientId: string;
}

const CampaignsManager: React.FC<CampaignsManagerProps> = ({ clientId }) => {
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showWizard, setShowWizard] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [metrics, setMetrics] = useState({
    activeCampaigns: 0,
    totalSent: 0,
    deliveryRate: 0,
    responseRate: 0
  });
  const { toast } = useToast();

  useEffect(() => {
    loadCampaigns();
  }, [clientId]);

  const loadCampaigns = async () => {
    try {
      setLoading(true);
      const data = await campaignService.getCampaigns(clientId);
      setCampaigns(data);
      
      // Calcular métricas
      const activeCampaigns = data.filter(c => c.is_active).length;
      const totalSent = data.reduce((sum, c) => sum + (c.send_count || 0), 0);
      const totalSuccess = data.reduce((sum, c) => sum + (c.success_count || 0), 0);
      const deliveryRate = totalSent > 0 ? (totalSuccess / totalSent) * 100 : 0;
      
      setMetrics({
        activeCampaigns,
        totalSent,
        deliveryRate,
        responseRate: deliveryRate * 0.15 // Estimativa
      });
    } catch (error) {
      console.error('Erro ao carregar campanhas:', error);
      toast({
        title: "Erro",
        description: "Erro ao carregar campanhas",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCampaignSuccess = () => {
    loadCampaigns();
    setShowWizard(false);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background/95 to-primary/5">
      <div className="container mx-auto p-4 lg:p-6 space-y-6">
        {/* Header Moderno */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-primary/10 via-accent/10 to-secondary/10 border border-border/50">
          <div className="absolute inset-0 bg-grid-pattern opacity-5" />
          <div className="relative p-6 lg:p-8">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
              <div className="space-y-2">
                <h1 className="text-3xl lg:text-4xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
                  Campanhas de Marketing
                </h1>
                <p className="text-muted-foreground text-lg">
                  Crie e gerencie campanhas inteligentes para seus leads
                </p>
              </div>
              <div className="flex flex-col sm:flex-row gap-3">
                <Button 
                  variant="outline"
                  onClick={() => setShowUploadModal(true)}
                  className="bg-background/50 backdrop-blur border-primary/20 hover:bg-primary/5"
                >
                  <Upload className="w-4 h-4 mr-2" />
                  Importar Contatos
                </Button>
                <Button 
                  onClick={() => setShowWizard(true)}
                  className="bg-gradient-to-r from-primary to-secondary hover:from-primary/90 hover:to-secondary/90 shadow-lg"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Nova Campanha
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Métricas Principais */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
          <Card className="relative overflow-hidden border-border/50 bg-gradient-to-br from-background to-background/50">
            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent" />
            <CardContent className="p-6 relative">
              <div className="flex items-center justify-between mb-4">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Send className="w-5 h-5 text-primary" />
                </div>
                <TrendingUp className="w-4 h-4 text-muted-foreground" />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-medium text-muted-foreground">Campanhas Ativas</p>
                <p className="text-2xl font-bold">{metrics.activeCampaigns}</p>
              </div>
            </CardContent>
          </Card>

          <Card className="relative overflow-hidden border-border/50 bg-gradient-to-br from-background to-background/50">
            <div className="absolute inset-0 bg-gradient-to-br from-secondary/5 to-transparent" />
            <CardContent className="p-6 relative">
              <div className="flex items-center justify-between mb-4">
                <div className="p-2 rounded-lg bg-secondary/10">
                  <Target className="w-5 h-5 text-secondary" />
                </div>
                <TrendingUp className="w-4 h-4 text-muted-foreground" />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-medium text-muted-foreground">Mensagens Enviadas</p>
                <p className="text-2xl font-bold">{metrics.totalSent.toLocaleString()}</p>
              </div>
            </CardContent>
          </Card>

          <Card className="relative overflow-hidden border-border/50 bg-gradient-to-br from-background to-background/50">
            <div className="absolute inset-0 bg-gradient-to-br from-accent/5 to-transparent" />
            <CardContent className="p-6 relative">
              <div className="flex items-center justify-between mb-4">
                <div className="p-2 rounded-lg bg-accent/10">
                  <BarChart3 className="w-5 h-5 text-accent" />
                </div>
                <TrendingUp className="w-4 h-4 text-muted-foreground" />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-medium text-muted-foreground">Taxa de Entrega</p>
                <p className="text-2xl font-bold">{metrics.deliveryRate.toFixed(1)}%</p>
              </div>
            </CardContent>
          </Card>

          <Card className="relative overflow-hidden border-border/50 bg-gradient-to-br from-background to-background/50">
            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-secondary/5 to-accent/5" />
            <CardContent className="p-6 relative">
              <div className="flex items-center justify-between mb-4">
                <div className="p-2 rounded-lg bg-gradient-to-r from-primary/10 to-secondary/10">
                  <Users className="w-5 h-5 text-primary" />
                </div>
                <TrendingUp className="w-4 h-4 text-muted-foreground" />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-medium text-muted-foreground">Taxa de Resposta</p>
                <p className="text-2xl font-bold">{metrics.responseRate.toFixed(1)}%</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs Navegação */}
        <Tabs defaultValue="campaigns" className="space-y-6">
          <TabsList className="grid w-full grid-cols-2 lg:grid-cols-4 h-12 bg-background/50 backdrop-blur border border-border/50">
            <TabsTrigger value="campaigns" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <Send className="w-4 h-4 mr-2" />
              Campanhas
            </TabsTrigger>
            <TabsTrigger value="templates" className="data-[state=active]:bg-secondary data-[state=active]:text-secondary-foreground">
              <FileText className="w-4 h-4 mr-2" />
              Templates
            </TabsTrigger>
            <TabsTrigger value="segments" className="data-[state=active]:bg-accent data-[state=active]:text-accent-foreground">
              <Filter className="w-4 h-4 mr-2" />
              Segmentos
            </TabsTrigger>
            <TabsTrigger value="reports" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <BarChart3 className="w-4 h-4 mr-2" />
              Relatórios
            </TabsTrigger>
          </TabsList>

          {/* Tab: Campanhas */}
          <TabsContent value="campaigns" className="space-y-6">
            {loading ? (
              <div className="text-center py-12">
                <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full mx-auto mb-4" />
                <p className="text-muted-foreground">Carregando campanhas...</p>
              </div>
            ) : campaigns.length === 0 ? (
              <Card className="border-dashed border-2 border-border/50">
                <CardContent className="text-center py-12">
                  <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Send className="w-8 h-8 text-primary" />
                  </div>
                  <h3 className="text-xl font-semibold mb-2">Nenhuma campanha criada</h3>
                  <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                    Crie sua primeira campanha para começar a engajar seus leads de forma inteligente
                  </p>
                  <Button 
                    onClick={() => setShowWizard(true)}
                    className="bg-gradient-to-r from-primary to-secondary hover:from-primary/90 hover:to-secondary/90"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Criar Primeira Campanha
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 lg:gap-6">
                {campaigns.map((campaign) => (
                  <Card key={campaign.id} className="group hover:shadow-lg transition-all duration-300 border-border/50 hover:border-primary/20">
                    <CardContent className="p-6">
                      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                        <div className="flex-1 space-y-3">
                          <div className="flex items-start justify-between">
                            <div>
                              <h3 className="text-lg font-semibold group-hover:text-primary transition-colors">
                                {campaign.name}
                              </h3>
                              <p className="text-sm text-muted-foreground mt-1">
                                {campaign.description}
                              </p>
                            </div>
                            <Badge 
                              variant={campaign.is_active ? "default" : "secondary"}
                              className="ml-4"
                            >
                              {campaign.is_active ? "Ativa" : "Inativa"}
                            </Badge>
                          </div>

                          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
                            <div className="space-y-1">
                              <p className="text-muted-foreground">Enviadas</p>
                              <p className="font-semibold">{(campaign.send_count || 0).toLocaleString()}</p>
                            </div>
                            <div className="space-y-1">
                              <p className="text-muted-foreground">Entregues</p>
                              <p className="font-semibold text-green-600">{(campaign.success_count || 0).toLocaleString()}</p>
                            </div>
                            <div className="space-y-1">
                              <p className="text-muted-foreground">Criada em</p>
                              <p className="font-semibold">{formatDate(campaign.created_at)}</p>
                            </div>
                            <div className="space-y-1">
                              <p className="text-muted-foreground">Última execução</p>
                              <p className="font-semibold">
                                {campaign.last_run_at ? formatDate(campaign.last_run_at) : "Nunca"}
                              </p>
                            </div>
                          </div>
                        </div>

                        <div className="flex flex-row lg:flex-col gap-2">
                          <Button size="sm" variant="outline" className="flex-1 lg:flex-initial">
                            <BarChart3 className="w-4 h-4 mr-2 lg:mr-0 lg:mb-1" />
                            <span className="lg:hidden">Métricas</span>
                          </Button>
                          <Button size="sm" variant="outline" className="flex-1 lg:flex-initial">
                            Editar
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Tab: Templates */}
          <TabsContent value="templates" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Templates de Mensagem</CardTitle>
                <CardDescription>Modelos pré-definidos para suas campanhas</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8">
                  <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">Templates serão exibidos aqui</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab: Segmentos */}
          <TabsContent value="segments" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Segmentação de Público</CardTitle>
                <CardDescription>Organize seus contatos por tags, estágios e filas</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8">
                  <Filter className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">Segmentos serão exibidos aqui</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab: Relatórios */}
          <TabsContent value="reports" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Relatórios de Performance</CardTitle>
                <CardDescription>Análise detalhada das suas campanhas</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8">
                  <BarChart3 className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">Relatórios serão exibidos aqui</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Modais */}
        <CampaignWizard
          clientId={clientId}
          open={showWizard}
          onClose={() => setShowWizard(false)}
          onSuccess={handleCampaignSuccess}
        />

        <ContactUploadModal
          clientId={clientId}
          open={showUploadModal}
          onClose={() => setShowUploadModal(false)}
          onSuccess={() => {
            setShowUploadModal(false);
            toast({
              title: "Sucesso!",
              description: "Contatos importados com sucesso"
            });
          }}
        />
      </div>
    </div>
  );
};

export default CampaignsManager;