import { AlertCircle, CheckCircle, RefreshCw, Globe } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useDomainConfig } from "@/hooks/useDomainConfig";

const DomainStatusIndicator = () => {
  const { 
    domainInfo, 
    isLoading, 
    error, 
    refreshDomainConfig, 
    getWebhookUrl,
    isSupported 
  } = useDomainConfig();

  if (isLoading) {
    return (
      <Card className="mb-4">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm">
            <RefreshCw className="h-4 w-4 animate-spin" />
            Verificando Configuração de CORS...
          </CardTitle>
        </CardHeader>
      </Card>
    );
  }

  const getStatusVariant = () => {
    if (error) return "destructive";
    if (!isSupported) return "secondary";
    return "default";
  };

  const getStatusIcon = () => {
    if (error) return <AlertCircle className="h-4 w-4" />;
    if (!isSupported) return <AlertCircle className="h-4 w-4" />;
    return <CheckCircle className="h-4 w-4" />;
  };

  return (
    <Card className="mb-4">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm">
            <Globe className="h-4 w-4" />
            Status de Domínio & CORS
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={refreshDomainConfig}
            className="h-7 px-2"
          >
            <RefreshCw className="h-3 w-3 mr-1" />
            Atualizar
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Domínio Atual:</span>
          <Badge variant={getStatusVariant()} className="flex items-center gap-1">
            {getStatusIcon()}
            {domainInfo?.current || 'Desconhecido'}
          </Badge>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Tipo:</span>
          <Badge variant="outline">
            {domainInfo?.isLovableApp ? 'Lovable App' : 
             domainInfo?.isLovableProject ? 'Lovable Project' :
             domainInfo?.isLocalhost ? 'Localhost' : 'Personalizado'}
          </Badge>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Webhook URL:</span>
          <span className="text-xs text-muted-foreground font-mono">
            {getWebhookUrl()}
          </span>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Origens CORS:</span>
          <span className="text-xs text-muted-foreground">
            {domainInfo?.corsOrigins.length || 0} configuradas
          </span>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              {error}
            </AlertDescription>
          </Alert>
        )}

        {!isSupported && !error && (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Este domínio pode ter problemas de CORS. Verifique a configuração do servidor.
            </AlertDescription>
          </Alert>
        )}

        {isSupported && !error && (
          <Alert>
            <CheckCircle className="h-4 w-4" />
            <AlertDescription>
              Configuração de CORS está correta para este domínio.
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
};

export default DomainStatusIndicator;