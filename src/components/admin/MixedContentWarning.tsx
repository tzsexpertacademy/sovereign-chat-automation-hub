
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { AlertTriangle, ExternalLink, Shield } from "lucide-react";
import { getServerConfig, DIRECT_SERVER_URL } from "@/config/environment";

const MixedContentWarning = () => {
  const config = getServerConfig();

  const handleEnableCorsProxy = () => {
    window.open('https://cors-anywhere.herokuapp.com/corsdemo', '_blank');
  };

  const handleTestDirectAccess = () => {
    window.open(`${DIRECT_SERVER_URL}/health`, '_blank');
  };

  if (!config.usingProxy) {
    return null;
  }

  return (
    <Alert className="border-orange-200 bg-orange-50">
      <AlertTriangle className="h-4 w-4 text-orange-600" />
      <AlertDescription>
        <div className="space-y-3">
          <div>
            <p className="font-medium text-orange-900">🔒 Mixed Content Security</p>
            <p className="text-sm text-orange-800 mt-1">
              O Lovable (HTTPS) não pode acessar diretamente o servidor HTTP do VPS.
              Estamos usando um proxy CORS para resolver isso.
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            <Button 
              onClick={handleEnableCorsProxy}
              size="sm"
              variant="outline"
              className="border-orange-300 text-orange-700 hover:bg-orange-100"
            >
              <Shield className="w-4 h-4 mr-1" />
              Ativar Proxy CORS
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
            <p>1. Configure HTTPS no servidor VPS ou</p>
            <p>2. Use um domínio com SSL ou</p>
            <p>3. Configure nginx como proxy HTTPS</p>
          </div>
        </div>
      </AlertDescription>
    </Alert>
  );
};

export default MixedContentWarning;
