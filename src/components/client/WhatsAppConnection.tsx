import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { QrCode, Smartphone, CheckCircle, AlertCircle, RefreshCw, Eye, WifiOff, Wifi } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import whatsappService, { WhatsAppClient } from "@/services/whatsappMultiClient";

const WhatsAppConnection = () => {
  const { clientId } = useParams();
  const [client, setClient] = useState<WhatsAppClient | null>(null);
  const [loading, setLoading] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [showQrModal, setShowQrModal] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (clientId) {
      initializeConnection();
      setupSocketListeners();
    }

    return () => {
      whatsappService.disconnectSocket();
    };
  }, [clientId]);

  const initializeConnection = async () => {
    if (!clientId) return;
    
    try {
      setLoading(true);
      setConnectionError(null);

      // Conectar ao WebSocket
      whatsappService.connectSocket();
      
      // Verificar status atual
      const clientStatus = await whatsappService.getClientStatus(clientId);
      setClient(clientStatus);
      
      // Entrar no room do cliente
      whatsappService.joinClientRoom(clientId);
      
    } catch (error: any) {
      console.error('Erro ao inicializar conexão:', error);
      setConnectionError(error.message || 'Erro ao conectar com o servidor');
    } finally {
      setLoading(false);
    }
  };

  const setupSocketListeners = () => {
    if (!clientId) return;

    // Ouvir atualizações de status
    whatsappService.onClientStatus(clientId, (clientData) => {
      console.log(`📱 Status atualizado para ${clientId}:`, clientData);
      setClient(clientData);
      setConnectionError(null);
    });
  };

  const handleConnect = async () => {
    if (!clientId) return;

    try {
      setLoading(true);
      setConnectionError(null);
      
      await whatsappService.connectClient(clientId);
      
      toast({
        title: "Conexão Iniciada",
        description: "Aguarde o QR Code aparecer...",
      });

    } catch (error: any) {
      console.error('Erro ao conectar:', error);
      setConnectionError(error.message || 'Erro ao conectar');
      toast({
        title: "Erro",
        description: error.message || "Falha ao conectar WhatsApp",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDisconnect = async () => {
    if (!clientId) return;

    try {
      setLoading(true);
      await whatsappService.disconnectClient(clientId);
      setClient(prev => prev ? { ...prev, status: 'disconnected' } : null);
      
      toast({
        title: "Desconectado",
        description: "WhatsApp desconectado com sucesso",
      });
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message || "Falha ao desconectar",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleViewQrCode = async () => {
    if (!clientId) return;

    try {
      const clientStatus = await whatsappService.getClientStatus(clientId);
      setClient(clientStatus);
      setShowQrModal(true);
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message || "Falha ao buscar QR Code",
        variant: "destructive",
      });
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'connected': return 'bg-green-500';
      case 'qr_ready': return 'bg-blue-500';
      case 'connecting': return 'bg-yellow-500';
      case 'authenticated': return 'bg-cyan-500';
      case 'disconnected': return 'bg-gray-500';
      case 'error': case 'auth_failed': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'connected': return 'Conectado';
      case 'qr_ready': return 'QR Pronto';
      case 'connecting': return 'Conectando';
      case 'authenticated': return 'Autenticado';
      case 'disconnected': return 'Desconectado';
      case 'error': return 'Erro';
      case 'auth_failed': return 'Falha na Auth';
      default: return 'Desconhecido';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'connected': return <Wifi className="w-6 h-6 text-green-500" />;
      case 'qr_ready': return <QrCode className="w-6 h-6 text-blue-500" />;
      case 'connecting': return <RefreshCw className="w-6 h-6 text-yellow-500 animate-spin" />;
      case 'authenticated': return <Smartphone className="w-6 h-6 text-cyan-500" />;
      case 'disconnected': return <WifiOff className="w-6 h-6 text-gray-400" />;
      case 'error': case 'auth_failed': return <AlertCircle className="w-6 h-6 text-red-500" />;
      default: return <WifiOff className="w-6 h-6 text-gray-400" />;
    }
  };

  const getProgressValue = () => {
    if (!client) return 0;
    switch (client.status) {
      case 'connecting': return 20;
      case 'qr_ready': return 50;
      case 'authenticated': return 80;
      case 'connected': return 100;
      default: return 0;
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Conexão WhatsApp</h1>
        <p className="text-gray-600">Conecte seu WhatsApp para começar a usar a plataforma</p>
      </div>

      {/* Connection Error Alert */}
      {connectionError && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-6">
            <div className="flex items-center space-x-2">
              <AlertCircle className="w-5 h-5 text-red-500" />
              <div>
                <p className="font-medium text-red-900">Problema de Conexão</p>
                <p className="text-sm text-red-700">{connectionError}</p>
                <Button 
                  size="sm" 
                  variant="outline" 
                  onClick={initializeConnection}
                  className="mt-2 border-red-300 text-red-700 hover:bg-red-100"
                >
                  Tentar Reconectar
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid lg:grid-cols-2 gap-6">
        {/* QR Code Card */}
        <Card className="lg:col-span-1">
          <CardHeader className="text-center">
            <div className="flex items-center justify-center space-x-2 mb-2">
              {client ? getStatusIcon(client.status) : <WifiOff className="w-6 h-6 text-gray-400" />}
              <CardTitle>{client ? getStatusText(client.status) : 'Aguardando Conexão'}</CardTitle>
            </div>
            <CardDescription>
              {client?.status === 'qr_ready' && 'QR Code pronto para leitura'}
              {client?.status === 'connected' && `WhatsApp conectado: ${client.phoneNumber}`}
              {client?.status === 'disconnected' && 'Clique em conectar para gerar o QR Code'}
              {client?.status === 'connecting' && 'Estabelecendo conexão...'}
              {!client && 'Carregando status da conexão...'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Progress Bar */}
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Progresso da Conexão</span>
                <span>{getProgressValue()}%</span>
              </div>
              <Progress value={getProgressValue()} className="w-full" />
            </div>

            {/* QR Code Display */}
            <div className="flex justify-center">
              {client?.status === 'qr_ready' && client.hasQrCode ? (
                <div className="w-64 h-64 border-2 border-blue-300 rounded-lg flex items-center justify-center bg-blue-50">
                  <div className="text-center p-4">
                    <QrCode className="w-16 h-16 text-blue-500 mx-auto mb-4" />
                    <p className="text-sm text-blue-700 mb-4">QR Code disponível</p>
                    <Button onClick={handleViewQrCode} variant="outline" size="sm">
                      <Eye className="w-4 h-4 mr-1" />
                      Ver QR Code
                    </Button>
                  </div>
                </div>
              ) : client?.status === 'connected' ? (
                <div className="w-64 h-64 border-2 border-green-300 rounded-lg flex items-center justify-center bg-green-50">
                  <div className="text-center">
                    <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
                    <h3 className="font-semibold text-green-700">Conectado!</h3>
                    <p className="text-sm text-green-600">{client.phoneNumber}</p>
                  </div>
                </div>
              ) : client?.status === 'connecting' ? (
                <div className="w-64 h-64 border-2 border-yellow-300 rounded-lg flex items-center justify-center bg-yellow-50">
                  <div className="text-center">
                    <RefreshCw className="w-8 h-8 text-yellow-500 animate-spin mx-auto mb-2" />
                    <p className="text-sm text-yellow-700">Conectando...</p>
                  </div>
                </div>
              ) : (
                <div className="w-64 h-64 border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center bg-gray-50">
                  <div className="text-center">
                    <QrCode className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                    <p className="text-sm text-gray-500">QR Code aparecerá aqui</p>
                  </div>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex space-x-2 justify-center">
              {!client || client.status === 'disconnected' ? (
                <Button onClick={handleConnect} disabled={loading} className="bg-green-600 hover:bg-green-700">
                  {loading ? (
                    <>
                      <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                      Conectando...
                    </>
                  ) : (
                    <>
                      <Smartphone className="w-4 h-4 mr-2" />
                      Conectar WhatsApp
                    </>
                  )}
                </Button>
              ) : client.status === 'connected' ? (
                <Button variant="outline" onClick={handleDisconnect} disabled={loading}>
                  Desconectar
                </Button>
              ) : (
                <Button variant="outline" onClick={initializeConnection} disabled={loading}>
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Atualizar Status
                </Button>
              )}
            </div>

            {/* Status Info */}
            {client && (
              <div className="mt-4 p-3 bg-gray-50 rounded border text-sm">
                <div className="flex items-center justify-between">
                  <span>Status:</span>
                  <Badge variant={client.status === 'connected' ? 'default' : 'secondary'}>
                    <div className="flex items-center space-x-1">
                      <div className={`w-2 h-2 rounded-full ${getStatusColor(client.status)}`} />
                      <span>{getStatusText(client.status)}</span>
                    </div>
                  </Badge>
                </div>
                {client.phoneNumber && (
                  <div className="flex items-center justify-between mt-2">
                    <span>Número:</span>
                    <span className="font-medium">{client.phoneNumber}</span>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Instructions Card */}
        <Card>
          <CardHeader>
            <CardTitle>Como Conectar</CardTitle>
            <CardDescription>Siga os passos para conectar seu WhatsApp</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div className="flex items-start space-x-3">
                <div className="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center text-sm font-medium text-green-600">
                  1
                </div>
                <div>
                  <h4 className="font-medium">Abra o WhatsApp no seu celular</h4>
                  <p className="text-sm text-gray-600">Certifique-se de que o WhatsApp está instalado e funcionando</p>
                </div>
              </div>
              
              <div className="flex items-start space-x-3">
                <div className="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center text-sm font-medium text-green-600">
                  2
                </div>
                <div>
                  <h4 className="font-medium">Vá em "Dispositivos Conectados"</h4>
                  <p className="text-sm text-gray-600">Menu → Dispositivos Conectados → Conectar um dispositivo</p>
                </div>
              </div>
              
              <div className="flex items-start space-x-3">
                <div className="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center text-sm font-medium text-green-600">
                  3
                </div>
                <div>
                  <h4 className="font-medium">Escaneie o QR Code</h4>
                  <p className="text-sm text-gray-600">Aponte a câmera para o QR Code mostrado na tela</p>
                </div>
              </div>
              
              <div className="flex items-start space-x-3">
                <div className="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center text-sm font-medium text-green-600">
                  4
                </div>
                <div>
                  <h4 className="font-medium">Pronto!</h4>
                  <p className="text-sm text-gray-600">Seu WhatsApp estará conectado e pronto para uso</p>
                </div>
              </div>
            </div>

            <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-start space-x-2">
                <AlertCircle className="w-5 h-5 text-blue-500 mt-0.5" />
                <div>
                  <h4 className="font-medium text-blue-900">Importante</h4>
                  <p className="text-sm text-blue-700">
                    Mantenha seu celular conectado à internet para que a conexão funcione corretamente.
                    O QR Code expira automaticamente por segurança.
                  </p>
                </div>
              </div>
            </div>

            {client?.status === 'connected' && (
              <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex items-center space-x-2">
                  <CheckCircle className="w-5 h-5 text-green-500" />
                  <div>
                    <h4 className="font-medium text-green-900">Conexão Estabelecida</h4>
                    <p className="text-sm text-green-700">
                      Seu WhatsApp está conectado e funcionando. Você pode acessar suas conversas na aba "Chat".
                    </p>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* QR Code Modal */}
      {showQrModal && client && client.qrCode && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg max-w-md w-full mx-4">
            <div className="text-center">
              <h3 className="text-lg font-semibold mb-4">
                QR Code - WhatsApp
              </h3>
              
              <div className="space-y-4">
                <img 
                  src={client.qrCode} 
                  alt="QR Code WhatsApp"
                  className="mx-auto border rounded max-w-full h-auto"
                />
                <p className="text-sm text-gray-600">
                  Escaneie este QR Code com seu WhatsApp para conectar
                </p>
              </div>
              
              <Button 
                onClick={() => setShowQrModal(false)}
                className="mt-4"
                variant="outline"
              >
                Fechar
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default WhatsAppConnection;
