
import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { QrCode, Smartphone, CheckCircle, AlertCircle, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const WhatsAppConnection = () => {
  const [connectionStatus, setConnectionStatus] = useState<'disconnected' | 'generating' | 'waiting' | 'connected'>('disconnected');
  const [qrCodeData, setQrCodeData] = useState('');
  const [progress, setProgress] = useState(0);
  const [expiryTime, setExpiryTime] = useState(60);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (connectionStatus === 'waiting' && expiryTime > 0) {
      interval = setInterval(() => {
        setExpiryTime(prev => prev - 1);
      }, 1000);
    }

    return () => clearInterval(interval);
  }, [connectionStatus, expiryTime]);

  const handleConnect = () => {
    setConnectionStatus('generating');
    setProgress(20);
    
    // Simula geração do QR Code
    setTimeout(() => {
      setQrCodeData('https://wa.me/qr/mock-qr-code-data-for-demo');
      setConnectionStatus('waiting');
      setProgress(50);
      setExpiryTime(60);
    }, 2000);
  };

  const handleRegenerate = () => {
    setConnectionStatus('generating');
    setProgress(30);
    setExpiryTime(60);
    
    setTimeout(() => {
      setQrCodeData('https://wa.me/qr/new-mock-qr-code-data');
      setConnectionStatus('waiting');
      setProgress(50);
    }, 1500);
  };

  const simulateConnection = () => {
    setProgress(100);
    setConnectionStatus('connected');
  };

  const getStatusIcon = () => {
    switch (connectionStatus) {
      case 'connected': return <CheckCircle className="w-6 h-6 text-green-500" />;
      case 'waiting': return <QrCode className="w-6 h-6 text-blue-500" />;
      case 'generating': return <RefreshCw className="w-6 h-6 text-yellow-500 animate-spin" />;
      default: return <AlertCircle className="w-6 h-6 text-gray-400" />;
    }
  };

  const getStatusText = () => {
    switch (connectionStatus) {
      case 'connected': return 'Conectado com Sucesso';
      case 'waiting': return 'Aguardando Leitura do QR Code';
      case 'generating': return 'Gerando QR Code...';
      default: return 'Desconectado';
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Conexão WhatsApp</h1>
        <p className="text-gray-600">Conecte seu WhatsApp para começar a usar a plataforma</p>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* QR Code Card */}
        <Card className="lg:col-span-1">
          <CardHeader className="text-center">
            <div className="flex items-center justify-center space-x-2 mb-2">
              {getStatusIcon()}
              <CardTitle>{getStatusText()}</CardTitle>
            </div>
            <CardDescription>
              {connectionStatus === 'waiting' && `QR Code expira em ${expiryTime}s`}
              {connectionStatus === 'connected' && 'WhatsApp conectado e funcionando'}
              {connectionStatus === 'disconnected' && 'Clique em conectar para gerar o QR Code'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Progress Bar */}
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Progresso da Conexão</span>
                <span>{progress}%</span>
              </div>
              <Progress value={progress} className="w-full" />
            </div>

            {/* QR Code Display */}
            <div className="flex justify-center">
              {connectionStatus === 'waiting' || connectionStatus === 'generating' ? (
                <div className="w-64 h-64 border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center bg-gray-50">
                  {connectionStatus === 'generating' ? (
                    <div className="text-center">
                      <RefreshCw className="w-8 h-8 text-gray-400 animate-spin mx-auto mb-2" />
                      <p className="text-sm text-gray-500">Gerando QR Code...</p>
                    </div>
                  ) : (
                    <div className="text-center p-8">
                      <div className="w-48 h-48 bg-white border rounded-lg flex items-center justify-center mb-4">
                        <div className="grid grid-cols-8 gap-1">
                          {Array.from({ length: 64 }).map((_, i) => (
                            <div
                              key={i}
                              className={`w-2 h-2 ${
                                Math.random() > 0.5 ? 'bg-black' : 'bg-white'
                              }`}
                            />
                          ))}
                        </div>
                      </div>
                      <Button onClick={simulateConnection} variant="outline" size="sm">
                        Simular Leitura
                      </Button>
                    </div>
                  )}
                </div>
              ) : connectionStatus === 'connected' ? (
                <div className="w-64 h-64 border-2 border-green-300 rounded-lg flex items-center justify-center bg-green-50">
                  <div className="text-center">
                    <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
                    <h3 className="font-semibold text-green-700">Conectado!</h3>
                    <p className="text-sm text-green-600">+55 11 99999-1234</p>
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
              {connectionStatus === 'disconnected' && (
                <Button onClick={handleConnect} className="bg-green-600 hover:bg-green-700">
                  <Smartphone className="w-4 h-4 mr-2" />
                  Conectar WhatsApp
                </Button>
              )}
              {connectionStatus === 'waiting' && (
                <Button onClick={handleRegenerate} variant="outline">
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Regenerar QR Code
                </Button>
              )}
              {connectionStatus === 'connected' && (
                <Button variant="outline" onClick={() => setConnectionStatus('disconnected')}>
                  Desconectar
                </Button>
              )}
            </div>
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
                    O QR Code expira em 60 segundos por segurança.
                  </p>
                </div>
              </div>
            </div>

            {connectionStatus === 'connected' && (
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
    </div>
  );
};

export default WhatsAppConnection;
