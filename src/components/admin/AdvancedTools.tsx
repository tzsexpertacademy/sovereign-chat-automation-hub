import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Settings, Wifi, Bug, Database, Activity } from "lucide-react";
import WebSocketStatusDebugSimplified from "./WebSocketStatusDebugSimplified";
import ConnectionDiagnostics from "./ConnectionDiagnostics";
import SSLCertificateHelper from "./SSLCertificateHelper";

const AdvancedTools = () => {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 bg-primary/10 rounded-lg">
          <Settings className="w-6 h-6 text-primary" />
        </div>
        <div>
          <h1 className="text-3xl font-bold text-foreground">Ferramentas Avançadas</h1>
          <p className="text-muted-foreground">Diagnósticos e debug técnico do sistema</p>
        </div>
      </div>

      {/* Tools Tabs */}
      <Tabs defaultValue="websocket" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="websocket" className="flex items-center gap-2">
            <Wifi className="w-4 h-4" />
            WebSocket Debug
          </TabsTrigger>
          <TabsTrigger value="connection" className="flex items-center gap-2">
            <Activity className="w-4 h-4" />
            Conexão
          </TabsTrigger>
          <TabsTrigger value="ssl" className="flex items-center gap-2">
            <Database className="w-4 h-4" />
            SSL/HTTPS
          </TabsTrigger>
          <TabsTrigger value="system" className="flex items-center gap-2">
            <Bug className="w-4 h-4" />
            Sistema
          </TabsTrigger>
        </TabsList>

        {/* WebSocket Debug */}
        <TabsContent value="websocket" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Wifi className="w-5 h-5" />
                    Debug WebSocket
                  </CardTitle>
                  <CardDescription>
                    Ferramenta específica para diagnóstico de conexões WebSocket
                  </CardDescription>
                </div>
                <Badge variant="outline" className="text-yellow-600 border-yellow-300">
                  Debug Only
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-4">
                <div className="flex items-center gap-2 text-amber-800">
                  <Bug className="w-4 h-4" />
                  <span className="font-medium">Ferramenta de Diagnóstico</span>
                </div>
                <p className="text-sm text-amber-700 mt-1">
                  Esta ferramenta é útil para diagnósticos técnicos avançados, mesmo que o sistema principal use REST.
                </p>
              </div>
              <WebSocketStatusDebugSimplified />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Connection Diagnostics */}
        <TabsContent value="connection" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="w-5 h-5" />
                Diagnóstico de Conexão
              </CardTitle>
              <CardDescription>
                Testes avançados de conectividade com a API YUMER
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ConnectionDiagnostics />
            </CardContent>
          </Card>
        </TabsContent>

        {/* SSL/HTTPS Helper */}
        <TabsContent value="ssl" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="w-5 h-5" />
                SSL/HTTPS Helper
              </CardTitle>
              <CardDescription>
                Verificação e configuração de certificados SSL
              </CardDescription>
            </CardHeader>
            <CardContent>
              <SSLCertificateHelper />
            </CardContent>
          </Card>
        </TabsContent>

        {/* System Debug */}
        <TabsContent value="system" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bug className="w-5 h-5" />
                Debug do Sistema
              </CardTitle>
              <CardDescription>
                Informações técnicas e debug do sistema
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 bg-muted rounded-lg">
                    <h4 className="font-medium mb-2">Versão do Sistema</h4>
                    <p className="text-sm text-muted-foreground">v1.3.0</p>
                  </div>
                  <div className="p-4 bg-muted rounded-lg">
                    <h4 className="font-medium mb-2">Ambiente</h4>
                    <p className="text-sm text-muted-foreground">Production</p>
                  </div>
                  <div className="p-4 bg-muted rounded-lg">
                    <h4 className="font-medium mb-2">API Backend</h4>
                    <p className="text-sm text-muted-foreground">YUMER CodeChat</p>
                  </div>
                  <div className="p-4 bg-muted rounded-lg">
                    <h4 className="font-medium mb-2">Logs Disponíveis</h4>
                    <p className="text-sm text-muted-foreground">Frontend, YUMER, Supabase</p>
                  </div>
                </div>
                
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <h4 className="font-medium text-blue-900 mb-2">Console Debug</h4>
                  <p className="text-sm text-blue-800">
                    Abra as ferramentas de desenvolvedor (F12) para ver logs técnicos detalhados.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AdvancedTools;