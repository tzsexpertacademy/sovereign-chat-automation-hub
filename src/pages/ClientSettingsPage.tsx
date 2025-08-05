import { useState } from "react";
import { useParams } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { 
  Settings, 
  Wifi, 
  User, 
  Bell, 
  Zap, 
  Globe,
  Palette,
  Shield
} from "lucide-react";
import WhatsAppConnectionManagerV2 from "@/components/client/WhatsAppConnectionManagerV2";
import SafeComponent from "@/components/SafeComponent";

const ClientSettingsPage = () => {
  const { clientId } = useParams();
  const [activeTab, setActiveTab] = useState("connections");

  if (!clientId) {
    return <div>Cliente não encontrado</div>;
  }

  const settingsTabs = [
    {
      id: "connections",
      label: "Conexões",
      icon: Wifi,
      description: "WhatsApp e Integrações",
      component: <WhatsAppConnectionManagerV2 />
    },
    {
      id: "profile",
      label: "Perfil",
      icon: User,
      description: "Dados da Empresa",
      component: (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Configurações do Perfil
            </CardTitle>
            <CardDescription>
              Configure os dados da sua empresa e perfil
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-center py-8 text-gray-500">
              Em desenvolvimento
            </div>
          </CardContent>
        </Card>
      )
    },
    {
      id: "appearance",
      label: "Aparência",
      icon: Palette,
      description: "Tema e Visual",
      component: (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Palette className="h-5 w-5" />
              Configurações de Aparência
            </CardTitle>
            <CardDescription>
              Personalize a aparência do sistema
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-center py-8 text-gray-500">
              Em desenvolvimento
            </div>
          </CardContent>
        </Card>
      )
    },
    {
      id: "notifications",
      label: "Notificações",
      icon: Bell,
      description: "Alertas e Avisos",
      component: (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5" />
              Configurações de Notificações
            </CardTitle>
            <CardDescription>
              Configure como e quando receber notificações
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-center py-8 text-gray-500">
              Em desenvolvimento
            </div>
          </CardContent>
        </Card>
      )
    },
    {
      id: "integrations",
      label: "Integrações",
      icon: Globe,
      description: "APIs e Webhooks",
      component: (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Globe className="h-5 w-5" />
              Configurações de Integrações
            </CardTitle>
            <CardDescription>
              Configure APIs externas e webhooks
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-center py-8 text-gray-500">
              Em desenvolvimento
            </div>
          </CardContent>
        </Card>
      )
    },
    {
      id: "security",
      label: "Segurança",
      icon: Shield,
      description: "Senhas e Acesso",
      component: (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Configurações de Segurança
            </CardTitle>
            <CardDescription>
              Gerencie senhas, tokens e permissões
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-center py-8 text-gray-500">
              Em desenvolvimento
            </div>
          </CardContent>
        </Card>
      )
    },
    {
      id: "advanced",
      label: "Avançado",
      icon: Zap,
      description: "Configs Técnicas",
      component: (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5" />
              Configurações Avançadas
            </CardTitle>
            <CardDescription>
              Configurações técnicas e experimentais
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-center py-8 text-gray-500">
              Em desenvolvimento
            </div>
          </CardContent>
        </Card>
      )
    }
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            Configurações
          </h1>
          <p className="text-muted-foreground mt-1">
            Gerencie todas as configurações do sistema
          </p>
        </div>
        <Badge variant="outline" className="hidden md:flex">
          <Settings className="h-3 w-3 mr-1" />
          Sistema
        </Badge>
      </div>

      {/* Settings Tabs */}
      <SafeComponent
        fallbackTitle="Erro nas Configurações"
        fallbackMessage="Houve um problema ao carregar as configurações."
      >
        <Card className="bg-gradient-to-br from-background to-secondary/5">
          <CardContent className="p-0">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <div className="border-b bg-background/50 backdrop-blur-sm">
                <TabsList className="grid w-full grid-cols-3 md:grid-cols-7 gap-1 bg-transparent h-auto p-1">
                  {settingsTabs.map((tab) => {
                    const Icon = tab.icon;
                    return (
                      <TabsTrigger
                        key={tab.id}
                        value={tab.id}
                        className="flex flex-col items-center gap-1 p-3 text-xs data-[state=active]:bg-primary/10 data-[state=active]:text-primary"
                      >
                        <Icon className="h-4 w-4" />
                        <span className="font-medium">{tab.label}</span>
                        <span className="text-[10px] text-muted-foreground hidden sm:block">
                          {tab.description}
                        </span>
                      </TabsTrigger>
                    );
                  })}
                </TabsList>
              </div>

              <div className="p-6">
                {settingsTabs.map((tab) => (
                  <TabsContent key={tab.id} value={tab.id} className="mt-0">
                    {tab.component}
                  </TabsContent>
                ))}
              </div>
            </Tabs>
          </CardContent>
        </Card>
      </SafeComponent>
    </div>
  );
};

export default ClientSettingsPage;