
import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  AlertTriangle, 
  CheckCircle, 
  RefreshCw, 
  Wrench,
  Database,
  AlertCircle,
  Server,
  Hash
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { dataConsistencyService, DataInconsistency } from "@/services/dataConsistencyService";

const DataConsistencyChecker = () => {
  const [inconsistencies, setInconsistencies] = useState<DataInconsistency[]>([]);
  const [loading, setLoading] = useState(false);
  const [fixing, setFixing] = useState(false);
  const { toast } = useToast();

  const checkConsistency = async () => {
    try {
      setLoading(true);
      const found = await dataConsistencyService.findInconsistencies();
      setInconsistencies(found);
      
      if (found.length === 0) {
        toast({
          title: "Dados Consistentes",
          description: "Nenhuma inconsistência encontrada nos dados",
        });
      } else {
        toast({
          title: "Inconsistências Encontradas",
          description: `${found.length} problema(s) detectado(s)`,
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Erro ao verificar consistência:', error);
      toast({
        title: "Erro",
        description: "Falha ao verificar consistência dos dados",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fixSingleInconsistency = async (inconsistency: DataInconsistency) => {
    try {
      setFixing(true);
      
      switch (inconsistency.type) {
        case 'orphaned_client_reference':
          await dataConsistencyService.fixOrphanedClientReference(inconsistency.clientId);
          break;
        case 'orphaned_instance':
          if (inconsistency.instanceId) {
            await dataConsistencyService.fixOrphanedInstance(inconsistency.instanceId);
          }
          break;
        case 'missing_instance':
          if (inconsistency.instanceId) {
            await dataConsistencyService.fixMissingInstanceReference(
              inconsistency.clientId, 
              inconsistency.instanceId
            );
          }
          break;
        case 'server_instance_mismatch':
          await dataConsistencyService.fixServerInstanceMismatch(inconsistency.clientId);
          break;
        case 'client_count_mismatch':
          await dataConsistencyService.fixClientCountMismatch(inconsistency.clientId);
          break;
      }
      
      toast({
        title: "Inconsistência Corrigida",
        description: "Problema resolvido com sucesso",
      });
      
      // Recarregar inconsistências
      await checkConsistency();
    } catch (error) {
      console.error('Erro ao corrigir inconsistência:', error);
      toast({
        title: "Erro",
        description: "Falha ao corrigir inconsistência",
        variant: "destructive",
      });
    } finally {
      setFixing(false);
    }
  };

  const fixAllInconsistencies = async () => {
    try {
      setFixing(true);
      const fixedCount = await dataConsistencyService.fixAllInconsistencies();
      
      toast({
        title: "Correção Concluída",
        description: `${fixedCount} problema(s) corrigido(s)`,
      });
      
      // Recarregar inconsistências
      await checkConsistency();
    } catch (error) {
      console.error('Erro ao corrigir todas as inconsistências:', error);
      toast({
        title: "Erro",
        description: "Falha ao corrigir inconsistências",
        variant: "destructive",
      });
    } finally {
      setFixing(false);
    }
  };

  const getInconsistencyTypeText = (type: string) => {
    switch (type) {
      case 'orphaned_client_reference':
        return 'Referência Órfã';
      case 'orphaned_instance':
        return 'Instância Órfã';
      case 'missing_instance':
        return 'Referência Faltante';
      case 'server_instance_mismatch':
        return 'Instância Fantasma';
      case 'client_count_mismatch':
        return 'Contagem Incorreta';
      default:
        return 'Desconhecido';
    }
  };

  const getInconsistencyIcon = (type: string) => {
    switch (type) {
      case 'orphaned_client_reference':
        return <AlertTriangle className="w-4 h-4 text-orange-500" />;
      case 'orphaned_instance':
        return <AlertCircle className="w-4 h-4 text-red-500" />;
      case 'missing_instance':
        return <Database className="w-4 h-4 text-blue-500" />;
      case 'server_instance_mismatch':
        return <Server className="w-4 h-4 text-purple-500" />;
      case 'client_count_mismatch':
        return <Hash className="w-4 h-4 text-yellow-500" />;
      default:
        return <AlertCircle className="w-4 h-4 text-gray-500" />;
    }
  };

  const getInconsistencyColor = (type: string) => {
    switch (type) {
      case 'orphaned_client_reference':
        return 'border-orange-200 bg-orange-50';
      case 'orphaned_instance':
        return 'border-red-200 bg-red-50';
      case 'missing_instance':
        return 'border-blue-200 bg-blue-50';
      case 'server_instance_mismatch':
        return 'border-purple-200 bg-purple-50';
      case 'client_count_mismatch':
        return 'border-yellow-200 bg-yellow-50';
      default:
        return 'border-gray-200 bg-gray-50';
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Database className="w-5 h-5" />
          <span>Verificador de Consistência de Dados</span>
        </CardTitle>
        <CardDescription>
          Detecta e corrige inconsistências entre clientes, instâncias e o servidor WhatsApp
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        
        {/* Action Buttons */}
        <div className="flex space-x-2">
          <Button 
            onClick={checkConsistency}
            disabled={loading || fixing}
            variant="outline"
          >
            {loading ? (
              <>
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                Verificando...
              </>
            ) : (
              <>
                <Database className="w-4 h-4 mr-2" />
                Verificar Consistência
              </>
            )}
          </Button>
          
          {inconsistencies.length > 0 && (
            <Button 
              onClick={fixAllInconsistencies}
              disabled={loading || fixing}
              className="bg-red-600 hover:bg-red-700"
            >
              {fixing ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  Corrigindo...
                </>
              ) : (
                <>
                  <Wrench className="w-4 h-4 mr-2" />
                  Corrigir Tudo ({inconsistencies.length})
                </>
              )}
            </Button>
          )}
        </div>

        {/* Results */}
        {inconsistencies.length === 0 && !loading ? (
          <div className="text-center py-8">
            <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-green-900 mb-2">Dados Consistentes</h3>
            <p className="text-green-700">Nenhuma inconsistência encontrada</p>
          </div>
        ) : (
          <div className="space-y-3">
            {inconsistencies.map((inconsistency, index) => (
              <Card key={index} className={getInconsistencyColor(inconsistency.type)}>
                <CardContent className="pt-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start space-x-3 flex-1">
                      {getInconsistencyIcon(inconsistency.type)}
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-1">
                          <Badge variant="outline">
                            {getInconsistencyTypeText(inconsistency.type)}
                          </Badge>
                          <span className="text-sm font-medium">{inconsistency.clientName}</span>
                        </div>
                        <p className="text-sm text-gray-700">{inconsistency.description}</p>
                        {inconsistency.instanceId && (
                          <p className="text-xs text-gray-500 mt-1">
                            Instância: {inconsistency.instanceId}
                          </p>
                        )}
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => fixSingleInconsistency(inconsistency)}
                      disabled={fixing}
                    >
                      {fixing ? (
                        <RefreshCw className="w-3 h-3 animate-spin" />
                      ) : (
                        <>
                          <Wrench className="w-3 h-3 mr-1" />
                          Corrigir
                        </>
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Instructions */}
        <div className="bg-blue-50 border border-blue-200 rounded p-3">
          <h4 className="font-medium text-blue-900 mb-2">Como usar:</h4>
          <ul className="text-sm text-blue-800 space-y-1">
            <li>• <strong>Referência Órfã:</strong> Cliente referencia instância que não existe</li>
            <li>• <strong>Instância Órfã:</strong> Instância no banco sem cliente válido</li>
            <li>• <strong>Instância Fantasma:</strong> Instância no banco mas não no servidor</li>
            <li>• <strong>Contagem Incorreta:</strong> Número de instâncias não confere</li>
            <li>• <strong>Referência Faltante:</strong> Cliente não referencia instância existente</li>
          </ul>
        </div>

      </CardContent>
    </Card>
  );
};

export default DataConsistencyChecker;
