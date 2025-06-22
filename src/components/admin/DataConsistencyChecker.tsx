
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
  AlertCircle
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
      default:
        return type;
    }
  };

  const getInconsistencyColor = (type: string) => {
    switch (type) {
      case 'orphaned_client_reference':
        return 'bg-red-100 text-red-800';
      case 'orphaned_instance':
        return 'bg-orange-100 text-orange-800';
      case 'missing_instance':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <div>
            <CardTitle className="flex items-center space-x-2">
              <Database className="w-5 h-5" />
              <span>Verificador de Consistência</span>
            </CardTitle>
            <CardDescription>
              Detecta e corrige inconsistências entre clientes e instâncias
            </CardDescription>
          </div>
          <div className="flex space-x-2">
            <Button onClick={checkConsistency} disabled={loading} variant="outline">
              <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Verificar
            </Button>
            {inconsistencies.length > 0 && (
              <Button onClick={fixAllInconsistencies} disabled={fixing}>
                <Wrench className="w-4 h-4 mr-2" />
                {fixing ? 'Corrigindo...' : 'Corrigir Tudo'}
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {inconsistencies.length === 0 ? (
          <div className="text-center py-8">
            <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              Dados Consistentes
            </h3>
            <p className="text-gray-600">
              {loading ? 'Verificando...' : 'Nenhuma inconsistência encontrada'}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center space-x-2 mb-4">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
              <span className="font-medium">
                {inconsistencies.length} inconsistência(s) encontrada(s)
              </span>
            </div>
            
            {inconsistencies.map((inconsistency, index) => (
              <Card key={index} className="border-l-4 border-l-amber-500">
                <CardContent className="pt-4">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-2">
                        <Badge className={getInconsistencyColor(inconsistency.type)}>
                          {getInconsistencyTypeText(inconsistency.type)}
                        </Badge>
                        <span className="font-medium">{inconsistency.clientName}</span>
                      </div>
                      <p className="text-sm text-gray-600 mb-2">
                        {inconsistency.description}
                      </p>
                      <div className="text-xs text-gray-500">
                        Cliente ID: {inconsistency.clientId}
                        {inconsistency.instanceId && (
                          <span> • Instância ID: {inconsistency.instanceId}</span>
                        )}
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => fixSingleInconsistency(inconsistency)}
                      disabled={fixing}
                    >
                      <Wrench className="w-4 h-4 mr-1" />
                      Corrigir
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default DataConsistencyChecker;
