import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, XCircle, AlertCircle, Zap } from "lucide-react";

const EvolutionApiStatus = () => {
  return (
    <Card className="border-green-200 bg-green-50/50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-green-700">
          <Zap className="h-5 w-5" />
          Status da API Evolution v2.2.1
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          
          {/* Status Geral */}
          <div className="space-y-3">
            <h4 className="font-medium text-sm text-green-700">Migração Completa</h4>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <span className="text-sm">Edge Function AI-Assistant-Process</span>
                <Badge variant="outline" className="text-green-600 border-green-300">
                  v2.2.1
                </Badge>
              </div>
              
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <span className="text-sm">YumerApiV2Service</span>
                <Badge variant="outline" className="text-green-600 border-green-300">
                  v2.2.1
                </Badge>
              </div>
              
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <span className="text-sm">Unified WhatsApp Service</span>
                <Badge variant="outline" className="text-green-600 border-green-300">
                  v2.2.1
                </Badge>
              </div>
              
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <span className="text-sm">Webhook Unificado</span>
                <Badge variant="outline" className="text-green-600 border-green-300">
                  Compatível
                </Badge>
              </div>
            </div>
          </div>

          {/* Funcionalidades */}
          <div className="space-y-3">
            <h4 className="font-medium text-sm text-green-700">Funcionalidades Ativas</h4>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <span className="text-sm">Envio de Texto</span>
              </div>
              
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <span className="text-sm">Assistente IA Automático</span>
              </div>
              
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <span className="text-sm">Sistema de Filas</span>
              </div>
              
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <span className="text-sm">Business Token Auth</span>
              </div>
            </div>
          </div>
        </div>

        {/* Informações da API */}
        <div className="border-t pt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-muted-foreground">
            <div>
              <strong>URL Base:</strong> https://api.yumer.com.br
            </div>
            <div>
              <strong>Endpoint:</strong> /api/v2/instance/{'{instanceId}'}/send/text
            </div>
            <div>
              <strong>Autenticação:</strong> Bearer {'{business_token}'}
            </div>
            <div>
              <strong>Estrutura:</strong> Evolution API v2.2.1
            </div>
          </div>
        </div>

        {/* Aviso sobre campos obsoletos */}
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
          <div className="flex items-start gap-2">
            <AlertCircle className="h-4 w-4 text-yellow-600 mt-0.5" />
            <div className="text-xs text-yellow-800">
              <strong>Campos obsoletos removidos:</strong> auth_token, api_version (yumerflow.app)
              <br />
              <strong>Agora utilizando:</strong> business_token, Evolution API v2.2.1 (api.yumer.com.br)
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default EvolutionApiStatus;