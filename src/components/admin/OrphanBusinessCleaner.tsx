import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Trash2, RefreshCw, AlertTriangle, Building, CheckCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface OrphanBusiness {
  business_id: string;
  name: string;
  email: string;
  created_at: string;
}

const OrphanBusinessCleaner = () => {
  const [orphanBusinesses, setOrphanBusinesses] = useState<OrphanBusiness[]>([]);
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState<string[]>([]);
  const { toast } = useToast();

  const loadOrphanBusinesses = async () => {
    setLoading(true);
    try {
      // 1. Buscar todos os businesses do servidor Yumer
      const yumerResponse = await fetch('https://api.yumer.com.br/v2/business', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        }
      });

      if (!yumerResponse.ok) {
        throw new Error('Falha ao buscar businesses do servidor Yumer');
      }

      const yumerBusinesses = await yumerResponse.json();
      
      // 2. Buscar business_ids dos clientes locais
      const { data: clients, error } = await supabase
        .from('clients')
        .select('business_id')
        .not('business_id', 'is', null);

      if (error) {
        throw new Error('Falha ao buscar clientes locais');
      }

      const linkedBusinessIds = clients.map(c => c.business_id);
      
      // 3. Filtrar businesses órfãos (não vinculados a clientes)
      const orphans = yumerBusinesses.filter((business: any) => 
        !linkedBusinessIds.includes(business.business_id)
      );

      setOrphanBusinesses(orphans);
      
      console.log(`✅ Encontrados ${orphans.length} businesses órfãos de ${yumerBusinesses.length} totais`);
      
      toast({
        title: "Busca Concluída",
        description: `${orphans.length} businesses órfãos encontrados`,
      });

    } catch (error: any) {
      console.error('Erro ao buscar businesses órfãos:', error);
      toast({
        title: "Erro",
        description: error.message || "Falha ao buscar businesses órfãos",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const deleteBusiness = async (businessId: string) => {
    if (!confirm(`Tem certeza que deseja deletar o business ${businessId}?`)) return;

    setDeleting(prev => [...prev, businessId]);
    try {
      const response = await fetch(`https://api.yumer.com.br/v2/business/${businessId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        }
      });

      if (response.ok) {
        setOrphanBusinesses(prev => prev.filter(b => b.business_id !== businessId));
        toast({
          title: "Sucesso",
          description: `Business ${businessId} deletado com sucesso`,
        });
      } else {
        const errorText = await response.text();
        throw new Error(`Falha ao deletar: ${errorText}`);
      }
    } catch (error: any) {
      console.error('Erro ao deletar business:', error);
      toast({
        title: "Erro",
        description: error.message || "Falha ao deletar business",
        variant: "destructive"
      });
    } finally {
      setDeleting(prev => prev.filter(id => id !== businessId));
    }
  };

  const deleteAllOrphans = async () => {
    if (!confirm(`Tem certeza que deseja deletar TODOS os ${orphanBusinesses.length} businesses órfãos?`)) return;

    const businessIds = orphanBusinesses.map(b => b.business_id);
    setDeleting(businessIds);

    let successCount = 0;
    let errorCount = 0;

    for (const businessId of businessIds) {
      try {
        const response = await fetch(`https://api.yumer.com.br/v2/business/${businessId}`, {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
          }
        });

        if (response.ok) {
          successCount++;
        } else {
          errorCount++;
          console.error(`Falha ao deletar business ${businessId}`);
        }
      } catch (error) {
        errorCount++;
        console.error(`Erro ao deletar business ${businessId}:`, error);
      }
    }

    setOrphanBusinesses([]);
    setDeleting([]);

    toast({
      title: "Limpeza Concluída",
      description: `${successCount} businesses deletados, ${errorCount} erros`,
      variant: errorCount > 0 ? "destructive" : "default"
    });
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Building className="w-5 h-5" />
            <span>Limpeza de Businesses Órfãos</span>
          </CardTitle>
          <CardDescription>
            Identifica e remove businesses do servidor Yumer que não estão vinculados a nenhum cliente
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex space-x-4 mb-6">
            <Button onClick={loadOrphanBusinesses} disabled={loading}>
              <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              {loading ? 'Buscando...' : 'Buscar Órfãos'}
            </Button>
            
            {orphanBusinesses.length > 0 && (
              <Button 
                variant="destructive" 
                onClick={deleteAllOrphans}
                disabled={deleting.length > 0}
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Deletar Todos ({orphanBusinesses.length})
              </Button>
            )}
          </div>

          {orphanBusinesses.length === 0 ? (
            <Alert>
              <CheckCircle className="h-4 w-4" />
              <AlertDescription>
                {loading ? 'Buscando businesses órfãos...' : 'Nenhum business órfão encontrado. Sistema limpo!'}
              </AlertDescription>
            </Alert>
          ) : (
            <div className="space-y-4">
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  <strong>{orphanBusinesses.length} businesses órfãos encontrados!</strong>
                  <br />
                  Estes businesses existem no servidor Yumer mas não estão vinculados a nenhum cliente.
                </AlertDescription>
              </Alert>

              <div className="grid gap-3">
                {orphanBusinesses.map((business) => (
                  <div key={business.business_id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-1">
                        <Badge variant="outline">{business.business_id}</Badge>
                        <span className="font-medium">{business.name}</span>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {business.email} • Criado em {new Date(business.created_at).toLocaleDateString('pt-BR')}
                      </div>
                    </div>
                    
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => deleteBusiness(business.business_id)}
                      disabled={deleting.includes(business.business_id)}
                    >
                      {deleting.includes(business.business_id) ? (
                        <>
                          <RefreshCw className="w-4 h-4 mr-1 animate-spin" />
                          Deletando...
                        </>
                      ) : (
                        <>
                          <Trash2 className="w-4 h-4 mr-1" />
                          Deletar
                        </>
                      )}
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default OrphanBusinessCleaner;