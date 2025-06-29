
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { AlertTriangle, ExternalLink, Shield, CheckCircle } from "lucide-react";
import { getServerConfig, DIRECT_SERVER_URL, CORS_PROXY_URL } from "@/config/environment";

const MixedContentWarning = () => {
  const config = getServerConfig();

  const handleEnableCorsProxy = () => {
    window.open('https://cors-anywhere.herokuapp.com/corsdemo', '_blank');
  };

  const handleTestDirectAccess = () => {
    window.open(`${DIRECT_SERVER_URL}/health`, '_blank');
  };

  // Show warning only if we have Mixed Content
  if (!config.hasMixedContent) {
    return (
      <Alert className="border-green-200 bg-green-50">
        <CheckCircle className="h-4 w-4 text-green-600" />
        <AlertDescription>
          <div className="space-y-2">
            <p className="font-medium text-green-900">✅ Sem Problemas de Mixed Content</p>
            <p className="text-sm text-green-800">
              Sistema funcionando com conexão direta ao servidor.
            </p>
          </div>
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <Alert className="border-orange-200 bg-orange-50">
      <AlertTriangle className="h-4 w-4 text-orange-600" />
      <AlertDescription>
        <div className="space-y-3">
          <div>
            <p className="font-medium text-orange-900">🔒 Mixed Content Security Detectado</p>
            <p className="text-sm text-orange-800 mt-1">
              Frontend HTTPS (Lovable) não pode acessar diretamente servidor HTTP. 
              Sistema configurado automaticamente para usar proxy CORS.
            </p>
          </div>
          
          <div className="bg-orange-100 p-3 rounded text-sm text-orange-800">
            <p><strong>✅ Solução Automática Aplicada:</strong></p>
            <p>• Proxy CORS habilitado: <code className="bg-orange-200 px-1 rounded">{CORS_PROXY_URL}</code></p>
            <p>• Servidor direto: <code className="bg-orange-200 px-1 rounded">{DIRECT_SERVER_URL}</code></p>
            <p>• Conexão via proxy: <code className="bg-orange-200 px-1 rounded">{config.SERVER_URL}</code></p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            <Button 
              onClick={handleEnableCorsProxy}
              size="sm"
              className="bg-orange-600 hover:bg-orange-700 text-white"
            >
              <Shield className="w-4 h-4 mr-1" />
              Habilitar Proxy CORS
              <ExternalLink className="w-3 h-3 ml-1" />
            </Button>
            
            <Button 
              onClick={handleTestDirectAccess}
              size="sm"
              variant="outline"
              className="border-orange-300 text-orange-700 hover:bg-orange-100"
            >
              <ExternalLink className="w-4 h-4 mr-1" />
              Testar Servidor Direto
            </Button>
          </div>

          <div className="text-xs text-orange-700 space-y-1">
            <p><strong>Para resolver permanentemente:</strong></p>
            <p>1. Configure HTTPS no servidor VPS com Let's Encrypt</p>
            <p>2. Use nginx como proxy reverso com SSL</p>
            <p>3. Configure domínio próprio com certificado SSL</p>
          </div>
        </div>
      </AlertDescription>
    </Alert>
  );
};

export default MixedContentWarning;
