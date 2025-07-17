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
  Plus,
  Trash2,
  Shield
} from "lucide-react";
import { SERVER_URL, getYumerGlobalApiKey } from "@/config/environment";
import cleanupInstancesService from "@/services/cleanupInstancesService";
import instancesUnifiedService from "@/services/instancesUnifiedService";

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
  const [cleanupStats, setCleanupStats] = useState<{total: number, test: number, offline: number} | null>(null);
  const [syncResult, setSyncResult] = useState<any>(null);

  const apiKey = getYumerGlobalApiKey();

  // ============ NOVO: BUSCAR INSTÂNCIAS E DIAGNOSTICAR SINCRONIZAÇÃO ============
  const fetchInstances = async () => {
    setLoading(true);
    setError('');
    
    try {
      console.log('🔍 [INSTANCES] Buscando instâncias com diagnóstico unificado...');
      
      // 1. PRIMEIRO: Fazer diagnóstico de consistência
      const diagnosis = await instancesUnifiedService.diagnoseSyncConsistency();
      setSyncResult(diagnosis);
      
      console.log('📊 [SYNC-DIAG] Resultado do diagnóstico:', diagnosis);
      
      // 2. SEGUNDA: Buscar instâncias da YUMER (para exibição)
      const yumerInstances = await instancesUnifiedService.getAllYumerInstances();
      
      // Normalizar resposta para array
      let instancesList: Instance[] = [];
      
      if (Array.isArray(yumerInstances)) {
        instancesList = yumerInstances;
      } else if (yumerInstances && typeof yumerInstances === 'object') {
        instancesList = [yumerInstances];
      }

      setInstances(instancesList);
      setLastChecked(new Date());
      
      // Calcular estatísticas de limpeza
      const testInstances = instancesList.filter(i => isTestInstance(i));
      const offlineInstances = instancesList.filter(i => i.connectionStatus?.toLowerCase() === 'offline');
      
      setCleanupStats({
        total: instancesList.length,
        test: testInstances.length,
        offline: offlineInstances.length
      });
      
      console.log(`✅ [INSTANCES] ${instancesList.length} instâncias encontradas`);
      console.log(`🧹 [CLEANUP] ${testInstances.length} instâncias de teste, ${offlineInstances.length} offline`);
      console.log(`🔄 [SYNC] ${diagnosis.orphanedInYumer.length} órfãs na YUMER, ${diagnosis.orphanedInSupabase.length} órfãs no Supabase`);
      
      // 3. TERCEIRA: Se houver órfãs, mostrar aviso
      if (!diagnosis.synchronized) {
        setError(`⚠️ SISTEMA DESINCRONIZADO: ${diagnosis.orphanedInYumer.length} órfãs na YUMER, ${diagnosis.orphanedInSupabase.length} órfãs no Supabase. Use "🔄 SINCRONIZAR" para corrigir.`);
      }
      
    } catch (err: any) {
      console.error('❌ [INSTANCES] Erro:', err);
      setError(err.message);
      setInstances([]);
      setSyncResult(null);
    } finally {
      setLoading(false);
    }
  };

  // Identificar instâncias de teste que podem ser removidas
  const isTestInstance = (instance: Instance): boolean => {
    const name = instance.name || instance.instanceName || '';
    const description = instance.description || '';
    
    return (
      name.includes('test_') ||
      name.includes('qr_test_') ||
      name.includes('Clean Instance') ||
      name.includes('Test QR Diagnostic') ||
      description.includes('Test') ||
      description.includes('test') ||
      description.includes('diagnostic') ||
      description.includes('Clean Instance')
    );
  };

  // Limpeza inteligente das instâncias de teste/offline
  const cleanupInstances = async (mode: 'test' | 'offline' | 'all') => {
    setLoading(true);
    setError('');
    
    try {
      let instancesToDelete: Instance[] = [];
      
      switch (mode) {
        case 'test':
          instancesToDelete = instances.filter(i => isTestInstance(i));
          break;
        case 'offline':
          instancesToDelete = instances.filter(i => 
            i.connectionStatus?.toLowerCase() === 'offline' && 
            !i.ownerJid // Não tem WhatsApp conectado
          );
          break;
        case 'all':
          // Excluir TODAS as instâncias
          instancesToDelete = instances;
          break;
      }

      console.log(`🧹 [CLEANUP] Modo: ${mode}, ${instancesToDelete.length} instâncias para deletar`);
      
      let deletedCount = 0;
      let errors: string[] = [];

      for (const instance of instancesToDelete) {
        try {
          const instanceName = instance.name || instance.instanceName;
          
          if (!instanceName) {
            console.warn(`⚠️ [CLEANUP] Instância sem nome, pulando:`, instance);
            continue;
          }

          console.log(`🗑️ [CLEANUP] Deletando: ${instanceName}`);
          
          // Tentar deletar via API YUMER primeiro
          try {
            const response = await fetch(`${SERVER_URL}/instance/delete/${instanceName}?force=true`, {
              method: 'DELETE',
              headers: {
                'apikey': apiKey || '',
                'Content-Type': 'application/json'
              }
            });

            if (response.ok) {
              console.log(`✅ [CLEANUP] Deletado via API: ${instanceName}`);
            } else {
              console.warn(`⚠️ [CLEANUP] API falhou para ${instanceName}: ${response.status}`);
            }
          } catch (apiError) {
            console.warn(`⚠️ [CLEANUP] Erro API para ${instanceName}:`, apiError);
          }

          // Deletar do Supabase também
          try {
            await cleanupInstancesService.deleteInstanceFromSupabase(instance.id, instanceName);
            console.log(`✅ [CLEANUP] Removido do Supabase: ${instanceName}`);
          } catch (dbError) {
            console.warn(`⚠️ [CLEANUP] Erro Supabase para ${instanceName}:`, dbError);
          }

          deletedCount++;
          
        } catch (error: any) {
          const instanceName = instance.name || instance.instanceName || `ID${instance.id}`;
          errors.push(`${instanceName}: ${error.message}`);
          console.error(`❌ [CLEANUP] Erro ao deletar ${instanceName}:`, error);
        }
      }

      if (deletedCount > 0) {
        console.log(`✅ [CLEANUP] ${deletedCount} instâncias processadas`);
        await fetchInstances(); // Recarregar lista
      }

      if (errors.length > 0) {
        setError(`Alguns erros ocorreram: ${errors.slice(0, 3).join(', ')}${errors.length > 3 ? '...' : ''}`);
      }
      
    } catch (error: any) {
      console.error('❌ [CLEANUP] Erro geral:', error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  // ============ NOVO: EXTERMÍNIO TOTAL DEFINITIVO ============
  const forceCleanupAll = async () => {
    setLoading(true);
    setError('');
    
    try {
      console.log(`💀 [TOTAL-EXTERMINATION] Usando serviço unificado...`);
      
      const result = await instancesUnifiedService.totalExtermination();
      
      console.log(`💀 [EXTERMÍNIO] YUMER: ${result.yumerDeleted} deletadas`);
      console.log(`💀 [EXTERMÍNIO] Supabase: ${result.supabaseDeleted} deletadas`);
      
      if (result.errors.length > 0) {
        setError(`Alguns erros ocorreram: ${result.errors.slice(0, 3).join('; ')}${result.errors.length > 3 ? '...' : ''}`);
      }
      
      // Recarregar lista
      await fetchInstances();
      
    } catch (error: any) {
      console.error('❌ [EXTERMÍNIO] Erro geral:', error);
      setError(`Erro no extermínio: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // ============ NOVO: SINCRONIZAÇÃO FORÇADA ============
  const forceSynchronization = async () => {
    setLoading(true);
    setError('');
    
    try {
      console.log(`🔄 [SYNC] Iniciando sincronização forçada...`);
      
      const result = await instancesUnifiedService.forceSyncFromSupabase();
      
      console.log(`🔄 [SYNC] Criadas: ${result.created}, Deletadas: ${result.deleted}`);
      
      if (result.errors.length > 0) {
        setError(`Alguns erros na sincronização: ${result.errors.slice(0, 3).join('; ')}${result.errors.length > 3 ? '...' : ''}`);
      } else {
        setError(''); // Limpar erro se sync foi bem-sucedida
      }
      
      // Recarregar lista
      await fetchInstances();
      
    } catch (error: any) {
      console.error('❌ [SYNC] Erro geral:', error);
      setError(`Erro na sincronização: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // ============ NOVO: LIMPEZA AUTOMÁTICA DE ÓRFÃS ============
  const cleanupOrphans = async () => {
    setLoading(true);
    setError('');
    
    try {
      console.log(`🧹 [ORPHANS] Limpando instâncias órfãs...`);
      
      const result = await instancesUnifiedService.cleanupOrphanedInstances();
      
      console.log(`🧹 [ORPHANS] ${result.cleaned} órfãs removidas`);
      
      if (result.errors.length > 0) {
        setError(`Alguns erros na limpeza: ${result.errors.slice(0, 3).join('; ')}${result.errors.length > 3 ? '...' : ''}`);
      } else {
        setError(''); // Limpar erro se limpeza foi bem-sucedida
      }
      
      // Recarregar lista
      await fetchInstances();
      
    } catch (error: any) {
      console.error('❌ [ORPHANS] Erro geral:', error);
      setError(`Erro na limpeza de órfãs: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Diagnóstico de sincronização
  const diagnoseSyncIssues = () => {
    console.log(`🔍 [DIAGNÓSTICO] Analisando problemas de sincronização...`);
    console.log(`📊 API YUMER: ${instances.length} instâncias`);
    console.log(`🗃️ Supabase: Verificando consistência...`);
    
    // Log detalhado das instâncias
    instances.forEach((instance, index) => {
      console.log(`📝 [${index + 1}] Nome: ${instance.name}`);
      console.log(`   ID: ${instance.id} (tipo: ${typeof instance.id})`);
      console.log(`   Status: ${instance.connectionStatus}`);
      console.log(`   WhatsApp: ${instance.ownerJid ? 'Conectado' : 'Desconectado'}`);
      console.log(`   Fonte: API YUMER (não Supabase)`);
    });
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
        
        {/* Estatísticas e botões de limpeza */}
        {cleanupStats && cleanupStats.total > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <div className="flex space-x-4">
                <span>📊 Total: <strong>{cleanupStats.total}</strong></span>
                <span>🧪 Teste: <strong>{cleanupStats.test}</strong></span>
                <span>📴 Offline: <strong>{cleanupStats.offline}</strong></span>
              </div>
            </div>
            
            {cleanupStats.total > 0 && (
              <div className="flex space-x-2">
                {cleanupStats.test > 0 && (
                  <Button 
                    onClick={() => cleanupInstances('test')} 
                    variant="outline" 
                    size="sm"
                    disabled={loading}
                    className="text-orange-600 border-orange-600 hover:bg-orange-50"
                  >
                    <Trash2 className="w-3 h-3 mr-1" />
                    Limpar Testes ({cleanupStats.test})
                  </Button>
                )}
                
                {cleanupStats.offline > 5 && (
                  <Button 
                    onClick={() => cleanupInstances('offline')} 
                    variant="outline" 
                    size="sm"
                    disabled={loading}
                    className="text-red-600 border-red-600 hover:bg-red-50"
                  >
                    <Trash2 className="w-3 h-3 mr-1" />
                    Limpar Offline ({cleanupStats.offline})
                  </Button>
                )}
                
                <Button 
                  onClick={() => cleanupInstances('all')} 
                  variant="destructive" 
                  size="sm"
                  disabled={loading}
                >
                  <Shield className="w-3 h-3 mr-1" />
                  Excluir TODAS ({cleanupStats.total})
                </Button>
                
                <Button 
                  onClick={forceCleanupAll} 
                  variant="destructive" 
                  size="sm"
                  disabled={loading}
                  className="bg-red-800 hover:bg-red-900 border-red-800"
                >
                  <Trash2 className="w-3 h-3 mr-1" />
                  💀 EXTERMÍNIO TOTAL
                </Button>

                <Button 
                  onClick={diagnoseSyncIssues} 
                  variant="outline" 
                  size="sm"
                  disabled={loading}
                  className="text-blue-600 border-blue-600 hover:bg-blue-50"
                >
                  🔍 Diagnóstico
                </Button>
                
                {/* Novos botões de correção */}
                {syncResult && !syncResult.synchronized && (
                  <>
                    <Button 
                      onClick={cleanupOrphans} 
                      variant="outline" 
                      size="sm"
                      disabled={loading}
                      className="text-purple-600 border-purple-600 hover:bg-purple-50"
                    >
                      🧹 Limpar Órfãs ({syncResult.orphanedInYumer.length + syncResult.orphanedInSupabase.length})
                    </Button>
                    
                    <Button 
                      onClick={forceSynchronization} 
                      variant="outline" 
                      size="sm"
                      disabled={loading}
                      className="text-green-600 border-green-600 hover:bg-green-50"
                    >
                      🔄 SINCRONIZAR
                    </Button>
                  </>
                )}
              </div>
            )}
          </div>
        )}
        
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

        {!loading && instances.length === 0 && (
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
              const isTest = isTestInstance(instance);
              
              return (
                <div key={index} className={`border rounded-lg p-4 ${isTest ? 'border-orange-200 bg-orange-50/30' : ''}`}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center space-x-3">
                      {getStatusIcon(instance.connectionStatus)}
                      <div>
                        <div className="flex items-center space-x-2">
                          <h4 className="font-medium">{instanceName}</h4>
                          {isTest && (
                            <Badge variant="outline" className="text-orange-600 border-orange-600">
                              🧪 Teste
                            </Badge>
                          )}
                        </div>
                        {instance.description && (
                          <p className="text-sm text-muted-foreground">{instance.description}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      {getStatusBadge(instance.connectionStatus)}
                      {isTest && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => cleanupInstances('test')}
                          disabled={loading}
                          className="text-orange-600 border-orange-600 hover:bg-orange-50"
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      )}
                    </div>
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