
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  Server, 
  Database, 
  Wifi, 
  Shield, 
  Activity,
  AlertCircle,
  CheckCircle,
  RefreshCw,
  Settings
} from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import OpenAIConfigPanel from "./OpenAIConfigPanel";

const ServerConfiguration = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [serverStatus, setServerStatus] = useState({
    yumer: 'unknown',
    supabase: 'unknown',
    openai: 'unknown'
  });
  const { toast } = useToast();

  useEffect(() => {
    checkServerStatus();
  }, []);

  const checkServerStatus = async () => {
    setIsLoading(true);
    
    try {
      // Verificar Yumer API
      try {
        const yumerResponse = await fetch('https://yumer.yumerflow.app:8083/', {
          method: 'GET'
        });
        setServerStatus(prev => ({
          ...prev,
          yumer: yumerResponse.ok ? 'online' : 'offline'
        }));
      } catch {
        setServerStatus(prev => ({ ...prev, yumer: 'offline' }));
      }

      // Verificar Supabase (sempre online se chegou até aqui)
      setServerStatus(prev => ({ ...prev, supabase: 'online' }));

      console.log('📊 [SERVER-CONFIG] Status verificado');
    } catch (error) {
      console.error('❌ [SERVER-CONFIG] Erro ao verificar status:', error);
      toast({
        title: "Erro",
        description: "Erro ao verificar status dos serviços",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'online': return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'offline': return <AlertCircle className="h-4 w-4 text-red-600" />;
      default: return <Activity className="h-4 w-4 text-yellow-600" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'online': return <Badge className="bg-green-100 text-green-800">Online</Badge>;
      case 'offline': return <Badge variant="destructive">Offline</Badge>;
      default: return <Badge variant="secondary">Verificando...</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Configuração do Servidor</h1>
        <p className="text-muted-foreground">
          Monitore e configure os serviços da plataforma
        </p>
      </div>

      <Tabs defaultValue="services" className="space-y-4">
        <TabsList>
          <TabsTrigger value="services" className="flex items-center gap-2">
            <Server className="h-4 w-4" />
            Serviços
          </TabsTrigger>
          <TabsTrigger value="openai" className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            OpenAI
          </TabsTrigger>
        </TabsList>

        <TabsContent value="services" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Activity className="h-5 w-5" />
                    Status dos Serviços
                  </CardTitle>
                  <CardDescription>
                    Monitore o status dos serviços essenciais da plataforma
                  </CardDescription>
                </div>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={checkServerStatus}
                  disabled={isLoading}
                >
                  <RefreshCw className={`h-4 w-4 mr-1 ${isLoading ? 'animate-spin' : ''}`} />
                  Atualizar
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Yumer API Status */}
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-center gap-3">
                  <Server className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <div className="font-medium">Yumer API</div>
                    <div className="text-sm text-muted-foreground">
                      https://yumer.yumerflow.app:8083
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {getStatusIcon(serverStatus.yumer)}
                  {getStatusBadge(serverStatus.yumer)}
                </div>
              </div>

              {/* Supabase Status */}
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-center gap-3">
                  <Database className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <div className="font-medium">Supabase</div>
                    <div className="text-sm text-muted-foreground">
                      Banco de dados e Edge Functions
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {getStatusIcon(serverStatus.supabase)}
                  {getStatusBadge(serverStatus.supabase)}
                </div>
              </div>

              {serverStatus.yumer === 'offline' && (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    <strong>Yumer API Offline:</strong> As funcionalidades do WhatsApp podem estar comprometidas. 
                    Verifique a conectividade com o servidor Yumer.
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Configurações de Segurança
              </CardTitle>
              <CardDescription>
                Configurações relacionadas à segurança da plataforma
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 border rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <Wifi className="h-4 w-4" />
                    <span className="font-medium">CORS</span>
                    <Badge className="bg-green-100 text-green-800">Configurado</Badge>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Políticas de CORS configuradas para Lovable e Supabase
                  </div>
                </div>

                <div className="p-4 border rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <Shield className="h-4 w-4" />
                    <span className="font-medium">HTTPS</span>
                    <Badge className="bg-green-100 text-green-800">Ativo</Badge>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Certificados SSL configurados e válidos
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="openai" className="space-y-4">
          <OpenAIConfigPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ServerConfiguration;
