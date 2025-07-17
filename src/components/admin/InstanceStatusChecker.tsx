import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  RefreshCw, 
  CheckCircle, 
  XCircle, 
  AlertTriangle,
  Loader2,
  Eye,
  Plus
} from "lucide-react";
import { SERVER_URL, getYumerGlobalApiKey } from "@/config/environment";

interface Instance {
  id?: number;
  name?: string;
  instanceName?: string;
  description?: string;
  connectionStatus?: string;
  ownerJid?: string;
  profilePicUrl?: string;
  createdAt?: string;
  updatedAt?: string;
}

const InstanceStatusChecker = () => {
  const [instances, setInstances] = useState<Instance[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [lastChecked, setLastChecked] = useState<Date | null>(null);

  const apiKey = getYumerGlobalApiKey();

  const fetchInstances = async () => {
    setLoading(true);
    setError('');
    
    try {
      console.log('🔍 [INSTANCES] Buscando instâncias...');
      
      const response = await fetch(`${SERVER_URL}/instance/fetchInstances`, {
        headers: {
          'apikey': apiKey || '',
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      console.log('📊 [INSTANCES] Resposta completa:', data);

      // Normalizar resposta para array
      let instancesList: Instance[] = [];
      
      if (Array.isArray(data)) {
        instancesList = data;
      } else if (data && typeof data === 'object') {
        // Se for objeto único, colocar em array
        instancesList = [data];
      }

      setInstances(instancesList);
      setLastChecked(new Date());
      
      console.log(`✅ [INSTANCES] ${instancesList.length} instâncias encontradas`);
      
    } catch (err: any) {
      console.error('❌ [INSTANCES] Erro:', err);
      setError(err.message);
      setInstances([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInstances();
  }, []);

  const getStatusIcon = (status?: string) => {
    switch (status?.toLowerCase()) {
      case 'online':
      case 'open':
      case 'connected':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'offline':
      case 'close':
      case 'disconnected':
        return <XCircle className="w-4 h-4 text-red-500" />;
      default:
        return <AlertTriangle className="w-4 h-4 text-yellow-500" />;
    }
  };

  const getStatusBadge = (status?: string) => {
    switch (status?.toLowerCase()) {
      case 'online':
      case 'open':
      case 'connected':
        return <Badge className="bg-green-500">Online</Badge>;
      case 'offline':
      case 'close':
      case 'disconnected':
        return <Badge variant="destructive">Offline</Badge>;
      default:
        return <Badge variant="outline">{status || 'Desconhecido'}</Badge>;
    }
  };

  const createTestInstance = async () => {
    setLoading(true);
    
    try {
      const testInstanceName = `test_diagnostic_${Date.now()}`;
      
      const response = await fetch(`${SERVER_URL}/instance/create`, {
        method: 'POST',
        headers: {
          'apikey': apiKey || '',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          instanceName: testInstanceName,
          description: 'Test instance created from diagnostic'
        })
      });

      if (response.ok) {
        await fetchInstances(); // Recarregar lista
      } else {
        const errorText = await response.text();
        throw new Error(`Erro ao criar instância: ${response.status} - ${errorText}`);
      }
      
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          📱 Status das Instâncias
          <div className="flex space-x-2">
            <Button 
              onClick={fetchInstances} 
              variant="outline" 
              size="sm"
              disabled={loading}
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              Atualizar
            </Button>
            <Button 
              onClick={createTestInstance} 
              size="sm"
              disabled={loading}
            >
              <Plus className="w-4 h-4 mr-2" />
              Criar Teste
            </Button>
          </div>
        </CardTitle>
        {lastChecked && (
          <p className="text-sm text-muted-foreground">
            Última verificação: {lastChecked.toLocaleTimeString()}
          </p>
        )}
      </CardHeader>
      
      <CardContent>
        {error && (
          <div className="mb-4 p-3 border border-red-200 bg-red-50 rounded text-red-700 text-sm">
            ❌ {error}
          </div>
        )}

        {!loading && !error && instances.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            <AlertTriangle className="w-12 h-12 mx-auto mb-4 text-yellow-500" />
            <h3 className="text-lg font-medium mb-2">Nenhuma Instância Encontrada</h3>
            <p className="text-sm mb-4">
              Não há instâncias disponíveis para testar os endpoints que requerem instância.
            </p>
            <Button onClick={createTestInstance} disabled={loading}>
              <Plus className="w-4 h-4 mr-2" />
              Criar Instância de Teste
            </Button>
          </div>
        )}

        {instances.length > 0 && (
          <div className="space-y-3">
            {instances.map((instance, index) => {
              const instanceName = instance.name || instance.instanceName || `Instance ${index + 1}`;
              
              return (
                <div key={index} className="border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center space-x-3">
                      {getStatusIcon(instance.connectionStatus)}
                      <div>
                        <h4 className="font-medium">{instanceName}</h4>
                        {instance.description && (
                          <p className="text-sm text-muted-foreground">{instance.description}</p>
                        )}
                      </div>
                    </div>
                    {getStatusBadge(instance.connectionStatus)}
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">ID:</span> {instance.id || 'N/A'}
                    </div>
                    <div>
                      <span className="text-muted-foreground">WhatsApp:</span> {instance.ownerJid ? '✅ Conectado' : '❌ Desconectado'}
                    </div>
                    <div>
                      <span className="text-muted-foreground">Criada:</span> {instance.createdAt ? new Date(instance.createdAt).toLocaleDateString() : 'N/A'}
                    </div>
                    <div>
                      <span className="text-muted-foreground">Atualizada:</span> {instance.updatedAt ? new Date(instance.updatedAt).toLocaleDateString() : 'N/A'}
                    </div>
                  </div>
                  
                  <div className="mt-3 pt-3 border-t">
                    <p className="text-xs text-muted-foreground">
                      <strong>Nome para testes:</strong> {instanceName}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default InstanceStatusChecker;