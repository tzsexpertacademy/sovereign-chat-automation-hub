
import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { supabase } from "@/integrations/supabase/client";
import { CheckCircle, AlertCircle, Users, Settings, Eye, EyeOff } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

interface ClientAIConfig {
  id: string;
  client_id: string;
  openai_api_key: string;
  default_model: string;
  created_at: string;
  updated_at: string;
  clients?: {
    name: string;
    email: string;
  };
}

const OpenAIConfigPanel = () => {
  const [configs, setConfigs] = useState<ClientAIConfig[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showApiKeys, setShowApiKeys] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadClientConfigs();
  }, []);

  const loadClientConfigs = async () => {
    try {
      setIsLoading(true);
      
      const { data, error } = await supabase
        .from('client_ai_configs')
        .select(`
          *,
          clients:client_id (
            name,
            email
          )
        `)
        .order('updated_at', { ascending: false });

      if (error) throw error;
      
      setConfigs(data || []);
      console.log('📊 [OPENAI-PANEL] Configurações carregadas:', data?.length || 0);
    } catch (error) {
      console.error('❌ [OPENAI-PANEL] Erro ao carregar configurações:', error);
      toast({
        title: "Erro",
        description: "Erro ao carregar configurações de IA",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const testOpenAIKey = async (apiKey: string, clientName: string) => {
    try {
      console.log(`🧪 [OPENAI-TEST] Testando chave para: ${clientName}`);
      
      const response = await fetch('https://api.openai.com/v1/models', {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        toast({
          title: "✅ Chave Válida",
          description: `A chave da OpenAI para ${clientName} está funcionando`,
        });
        return true;
      } else {
        toast({
          title: "❌ Chave Inválida",
          description: `A chave da OpenAI para ${clientName} não está funcionando`,
          variant: "destructive"
        });
        return false;
      }
    } catch (error) {
      console.error('❌ [OPENAI-TEST] Erro no teste:', error);
      toast({
        title: "❌ Erro no Teste",
        description: `Erro ao testar chave para ${clientName}`,
        variant: "destructive"
      });
      return false;
    }
  };

  const maskApiKey = (key: string) => {
    if (!key) return 'Não configurada';
    return `sk-...${key.slice(-4)}`;
  };

  const getStatusColor = (hasKey: boolean) => {
    return hasKey ? 'text-green-600' : 'text-red-600';
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Configurações OpenAI dos Clientes
          </CardTitle>
          <CardDescription>Carregando...</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Configurações OpenAI dos Clientes
          </CardTitle>
          <CardDescription>
            Monitore e gerencie as configurações de IA dos seus clientes
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4">
              <Badge variant="outline" className="flex items-center gap-1">
                <Users className="h-3 w-3" />
                {configs.length} cliente(s) total
              </Badge>
              <Badge variant="outline" className="flex items-center gap-1 text-green-600">
                <CheckCircle className="h-3 w-3" />
                {configs.filter(c => c.openai_api_key).length} configurado(s)
              </Badge>
              <Badge variant="outline" className="flex items-center gap-1 text-red-600">
                <AlertCircle className="h-3 w-3" />
                {configs.filter(c => !c.openai_api_key).length} sem configuração
              </Badge>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowApiKeys(!showApiKeys)}
              >
                {showApiKeys ? (
                  <>
                    <EyeOff className="h-4 w-4 mr-1" />
                    Ocultar Chaves
                  </>
                ) : (
                  <>
                    <Eye className="h-4 w-4 mr-1" />
                    Mostrar Chaves
                  </>
                )}
              </Button>
              <Button variant="outline" size="sm" onClick={loadClientConfigs}>
                Atualizar
              </Button>
            </div>
          </div>

          {configs.length === 0 ? (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Nenhuma configuração de IA encontrada. Os clientes precisam configurar suas chaves OpenAI.
              </AlertDescription>
            </Alert>
          ) : (
            <div className="space-y-3">
              {configs.map((config) => (
                <div
                  key={config.id}
                  className="flex items-center justify-between p-4 border rounded-lg"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium">
                        {config.clients?.name || 'Cliente sem nome'}
                      </span>
                      <Badge 
                        variant={config.openai_api_key ? "default" : "destructive"}
                        className={getStatusColor(!!config.openai_api_key)}
                      >
                        {config.openai_api_key ? "Configurado" : "Não Configurado"}
                      </Badge>
                    </div>
                    <div className="text-sm text-muted-foreground space-y-1">
                      <div>Email: {config.clients?.email || 'N/A'}</div>
                      <div>Modelo: {config.default_model || 'gpt-4o-mini'}</div>
                      <div>
                        Chave: {showApiKeys && config.openai_api_key ? 
                          config.openai_api_key : 
                          maskApiKey(config.openai_api_key)
                        }
                      </div>
                      <div>Atualizado: {new Date(config.updated_at).toLocaleString('pt-BR')}</div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {config.openai_api_key && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => testOpenAIKey(config.openai_api_key, config.clients?.name || 'Cliente')}
                      >
                        Testar Chave
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {configs.filter(c => !c.openai_api_key).length > 0 && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <strong>Atenção:</strong> Alguns clientes ainda não configuraram suas chaves OpenAI. 
            Os assistentes de IA não funcionarão para esses clientes até que configurem suas chaves.
            <br />
            <span className="text-sm text-muted-foreground mt-1 block">
              Os clientes podem configurar suas chaves em: Dashboard → Assistentes → Configurar IA
            </span>
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
};

export default OpenAIConfigPanel;
