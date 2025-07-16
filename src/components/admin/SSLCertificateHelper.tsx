
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Shield, ExternalLink, CheckCircle, AlertTriangle } from "lucide-react";
import { SERVER_URL, getServerConfig } from "@/config/environment";

const SSLCertificateHelper = () => {
  const [sslStatus, setSslStatus] = useState<'untested' | 'accepted' | 'rejected'>('untested');
  const config = getServerConfig();

  const testSSLAcceptance = async () => {
    try {
      const response = await fetch(`${SERVER_URL}/health`);
      if (response.ok) {
        setSslStatus('accepted');
      } else {
        setSslStatus('rejected');
      }
    } catch (error) {
      setSslStatus('rejected');
    }
  };

  const getStatusBadge = () => {
    switch (sslStatus) {
      case 'accepted':
        return <Badge className="bg-green-500"><CheckCircle className="w-3 h-3 mr-1" />Aceito</Badge>;
      case 'rejected':
        return <Badge variant="destructive"><AlertTriangle className="w-3 h-3 mr-1" />Rejeitado</Badge>;
      default:
        return <Badge variant="outline">Não testado</Badge>;
    }
  };

  return (
    <Card className="mb-4">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Shield className="w-5 h-5" />
            <span>Certificado SSL</span>
          </div>
          {getStatusBadge()}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <strong>Importante:</strong> Este servidor usa um certificado SSL autoassinado. 
            Você deve aceitar o certificado no navegador antes de usar o sistema.
          </AlertDescription>
        </Alert>

        <div className="bg-gray-50 p-4 rounded-lg space-y-2">
          <h4 className="font-medium">Informações do Servidor:</h4>
          <div className="text-sm space-y-1">
            <p><strong>URL HTTPS:</strong> <code>{SERVER_URL}</code></p>
            <p><strong>Via Nginx:</strong> <code>{config.nginxProxy ? 'Sim' : 'Não'}</code></p>
            <p><strong>Porta:</strong> <code>443 (padrão HTTPS)</code></p>
          </div>
        </div>

        <div className="space-y-3">
          <h4 className="font-medium">Passos para aceitar o certificado:</h4>
          <ol className="text-sm space-y-2 list-decimal list-inside">
            <li>Clique no botão "Aceitar Certificado SSL" abaixo</li>
            <li>Uma nova aba será aberta com aviso de segurança</li>
            <li>Clique em <strong>"Avançado"</strong></li>
            <li>Clique em <strong>"Prosseguir para yumer.yumerflow.app"</strong></li>
            <li>Volte aqui e clique em "Testar SSL"</li>
          </ol>
        </div>

        <div className="flex space-x-3">
          <Button asChild variant="outline">
            <a 
              href={`${SERVER_URL}/health`} 
              target="_blank" 
              rel="noopener noreferrer"
              className="flex items-center"
            >
              <ExternalLink className="w-4 h-4 mr-2" />
              Aceitar Certificado SSL
            </a>
          </Button>
          
          <Button onClick={testSSLAcceptance}>
            <Shield className="w-4 h-4 mr-2" />
            Testar SSL
          </Button>
        </div>

        {sslStatus === 'accepted' && (
          <Alert className="border-green-200 bg-green-50">
            <CheckCircle className="h-4 w-4 text-green-600" />
            <AlertDescription className="text-green-800">
              ✅ Certificado SSL aceito com sucesso! O sistema está pronto para uso.
            </AlertDescription>
          </Alert>
        )}

        {sslStatus === 'rejected' && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              ❌ Certificado SSL ainda não foi aceito. Siga os passos acima para aceitar o certificado.
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
};

export default SSLCertificateHelper;
