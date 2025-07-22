
import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, AlertCircle, Settings, ExternalLink } from "lucide-react";
import { aiConfigService, type AIConfig } from "@/services/aiConfigService";
import { useToast } from "@/components/ui/use-toast";
import { Link } from "react-router-dom";

interface AIConfigIndicatorProps {
  clientId: string;
  compact?: boolean;
}

const AIConfigIndicator = ({ clientId, compact = false }: AIConfigIndicatorProps) => {
  const [config, setConfig] = useState<AIConfig | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isTestingKey, setIsTestingKey] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadConfig();
  }, [clientId]);

  const loadConfig = async () => {
    try {
      setIsLoading(true);
      const configData = await aiConfigService.getClientConfig(clientId);
      setConfig(configData);
      console.log('🔍 [AI-INDICATOR] Configuração carregada:', !!configData?.openai_api_key);
    } catch (error) {
      console.error('❌ [AI-INDICATOR] Erro ao carregar configuração:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const testOpenAIConnection = async () => {
    if (!config?.openai_api_key) return;

    try {
      setIsTestingKey(true);
      console.log('🧪 [AI-INDICATOR] Testando conexão OpenAI...');

      const response = await fetch('https://api.openai.com/v1/models', {
        headers: {
          'Authorization': `Bearer ${config.openai_api_key}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        toast({
          title: "✅ Conexão OpenAI OK",
          description: "Sua chave API está funcionando corretamente",
        });
      } else {
        toast({
          title: "❌ Erro na Conexão OpenAI",
          description: "Verifique se sua chave API está correta",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('❌ [AI-INDICATOR] Erro no teste:', error);
      toast({
        title: "❌ Erro no Teste",
        description: "Não foi possível testar a conexão",
        variant: "destructive"
      });
    } finally {
      setIsTestingKey(false);
    }
  };

  if (isLoading) {
    return (
      <div className="animate-pulse">
        {compact ? (
          <div className="h-6 bg-muted rounded"></div>
        ) : (
          <Card>
            <CardContent className="p-4">
              <div className="h-4 bg-muted rounded mb-2"></div>
              <div className="h-3 bg-muted rounded w-2/3"></div>
            </CardContent>
          </Card>
        )}
      </div>
    );
  }

  const hasConfig = config && config.openai_api_key;
  const StatusIcon = hasConfig ? CheckCircle : AlertCircle;
  const statusColor = hasConfig ? 'text-green-600' : 'text-red-600';
  const badgeVariant = hasConfig ? "default" : "destructive";

  if (compact) {
    return (
      <div className="flex items-center gap-2">
        <Badge variant={badgeVariant} className="flex items-center gap-1">
          <StatusIcon className="h-3 w-3" />
          {hasConfig ? "IA Configurada" : "IA Não Configurada"}
        </Badge>
        {!hasConfig && (
          <Link to="/client/assistants">
            <Button variant="outline" size="sm">
              <Settings className="h-3 w-3 mr-1" />
              Configurar
            </Button>
          </Link>
        )}
      </div>
    );
  }

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <StatusIcon className={`h-5 w-5 ${statusColor}`} />
            <span className="font-medium">
              {hasConfig ? "IA Configurada" : "IA Não Configurada"}
            </span>
          </div>
          <Badge variant={badgeVariant}>
            {hasConfig ? "Ativo" : "Inativo"}
          </Badge>
        </div>

        {hasConfig ? (
          <div className="space-y-2">
            <div className="text-sm text-muted-foreground">
              <div>Modelo: {config.default_model || 'gpt-4o-mini'}</div>
              <div>Chave: sk-...{config.openai_api_key.slice(-4)}</div>
              <div>Configurado em: {new Date(config.updated_at).toLocaleDateString('pt-BR')}</div>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={testOpenAIConnection}
                disabled={isTestingKey}
              >
                {isTestingKey ? "Testando..." : "Testar Conexão"}
              </Button>
              <Link to="/client/assistants">
                <Button variant="outline" size="sm">
                  <Settings className="h-3 w-3 mr-1" />
                  Gerenciar
                </Button>
              </Link>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="text-sm text-muted-foreground">
              Configure sua chave API da OpenAI para usar os assistentes de IA
            </div>
            <Link to="/client/assistants">
              <Button variant="default" size="sm">
                <Settings className="h-3 w-3 mr-1" />
                Configurar Agora
                <ExternalLink className="h-3 w-3 ml-1" />
              </Button>
            </Link>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default AIConfigIndicator;
