import { supabase } from "@/integrations/supabase/client";
import { codechatQRService } from "@/services/codechatQRService";
import { whatsappInstancesService } from "@/services/whatsappInstancesService";
import cleanupInstancesService from "@/services/cleanupInstancesService";
import { SERVER_URL, getYumerGlobalApiKey } from "@/config/environment";

// ============ SERVIÇO UNIFICADO PARA GESTÃO DE INSTÂNCIAS ============
// Este serviço garante que Supabase seja sempre a fonte de verdade
// e mantém a YUMER API sincronizada

interface InstanceSyncResult {
  supabaseInstances: number;
  yumerInstances: number;
  orphanedInYumer: string[];
  orphanedInSupabase: string[];
  synchronized: boolean;
}

export const instancesUnifiedService = {
  
  // ============ MÉTODO PRIVADO: BUSCAR TODAS AS INSTÂNCIAS DA YUMER ============
  async getAllYumerInstances(): Promise<any[]> {
    try {
      console.log('📋 [YUMER-FETCH] Buscando todas as instâncias da YUMER API...');
      
      const apiKey = getYumerGlobalApiKey();
      
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
      console.log(`📊 [YUMER-FETCH] Encontradas ${data.length} instâncias`);
      
      return Array.isArray(data) ? data : [];
      
    } catch (error) {
      console.error('❌ [YUMER-FETCH] Erro ao buscar instâncias:', error);
      return [];
    }
  },
  
  // ============ DIAGNÓSTICO DE CONSISTÊNCIA ============
  async diagnoseSyncConsistency(): Promise<InstanceSyncResult> {
    try {
      console.log('🔍 [UNIFIED-DIAG] Iniciando diagnóstico de consistência...');
      
      // 1. Buscar instâncias do Supabase (fonte de verdade)
      const { data: supabaseInstances, error: supabaseError } = await supabase
        .from('whatsapp_instances')
        .select('instance_id, status, client_id, created_at');
      
      if (supabaseError) throw supabaseError;
      
      // 2. Buscar instâncias da YUMER API
      let yumerInstances: any[] = [];
      try {
        yumerInstances = await this.getAllYumerInstances();
      } catch (error) {
        console.warn('⚠️ [UNIFIED-DIAG] Erro ao buscar YUMER API:', error);
        yumerInstances = [];
      }
      
      // 3. Identificar órfãs
      const supabaseInstanceIds = new Set(supabaseInstances?.map(i => i.instance_id) || []);
      const yumerInstanceIds = new Set(yumerInstances.map(i => i.name || i.instanceName));
      
      const orphanedInYumer = Array.from(yumerInstanceIds).filter(id => !supabaseInstanceIds.has(id));
      const orphanedInSupabase = Array.from(supabaseInstanceIds).filter(id => !yumerInstanceIds.has(id));
      
      const result: InstanceSyncResult = {
        supabaseInstances: supabaseInstances?.length || 0,
        yumerInstances: yumerInstances.length,
        orphanedInYumer,
        orphanedInSupabase,
        synchronized: orphanedInYumer.length === 0 && orphanedInSupabase.length === 0
      };
      
      console.log('📊 [UNIFIED-DIAG] Resultado do diagnóstico:', result);
      return result;
      
    } catch (error) {
      console.error('❌ [UNIFIED-DIAG] Erro no diagnóstico:', error);
      throw error;
    }
  },
  
  // ============ LIMPEZA AUTOMÁTICA DE ÓRFÃS ============
  async cleanupOrphanedInstances(): Promise<{cleaned: number, errors: string[]}> {
    try {
      console.log('🧹 [UNIFIED-CLEANUP] Iniciando limpeza automática de órfãs...');
      
      const diagnosis = await this.diagnoseSyncConsistency();
      const errors: string[] = [];
      let cleaned = 0;
      
      // 1. Remover órfãs da YUMER API (não existem no Supabase)
      for (const orphanedId of diagnosis.orphanedInYumer) {
        try {
          console.log(`🗑️ [UNIFIED-CLEANUP] Removendo órfã da YUMER: ${orphanedId}`);
          await codechatQRService.deleteInstance(orphanedId);
          cleaned++;
        } catch (error) {
          const errorMsg = `Erro ao remover ${orphanedId} da YUMER: ${error.message}`;
          errors.push(errorMsg);
          console.error('❌ [UNIFIED-CLEANUP]', errorMsg);
        }
      }
      
      // 2. Para órfãs no Supabase, verificar se realmente não existem na YUMER
      for (const orphanedId of diagnosis.orphanedInSupabase) {
        try {
          console.log(`🔍 [UNIFIED-CLEANUP] Verificando órfã do Supabase: ${orphanedId}`);
          
          // Tentar buscar na YUMER para confirmar que não existe
          const exists = await codechatQRService.checkInstanceExists(orphanedId);
          
          if (!exists.exists) {
            console.log(`🗑️ [UNIFIED-CLEANUP] Removendo órfã do Supabase: ${orphanedId}`);
            await whatsappInstancesService.deleteInstance(orphanedId);
            cleaned++;
          } else {
            console.log(`✅ [UNIFIED-CLEANUP] Instância ${orphanedId} existe na YUMER, mantendo no Supabase`);
          }
        } catch (error) {
          const errorMsg = `Erro ao verificar ${orphanedId}: ${error.message}`;
          errors.push(errorMsg);
          console.error('❌ [UNIFIED-CLEANUP]', errorMsg);
        }
      }
      
      console.log(`✅ [UNIFIED-CLEANUP] Limpeza concluída. ${cleaned} órfãs removidas, ${errors.length} erros`);
      return { cleaned, errors };
      
    } catch (error) {
      console.error('❌ [UNIFIED-CLEANUP] Erro na limpeza automática:', error);
      throw error;
    }
  },
  
  // ============ SINCRONIZAÇÃO FORÇADA - SUPABASE COMO FONTE DE VERDADE ============
  async forceSyncFromSupabase(): Promise<{created: number, deleted: number, errors: string[]}> {
    try {
      console.log('🔄 [UNIFIED-SYNC] Iniciando sincronização forçada (Supabase → YUMER)...');
      
      // 1. Buscar todas as instâncias do Supabase
      const { data: supabaseInstances, error: supabaseError } = await supabase
        .from('whatsapp_instances')
        .select('instance_id, status, client_id');
      
      if (supabaseError) throw supabaseError;
      
      // 2. Buscar todas as instâncias da YUMER
      const yumerInstances = await this.getAllYumerInstances();
      const yumerInstanceIds = new Set(yumerInstances.map(i => i.name || i.instanceName));
      
      const errors: string[] = [];
      let created = 0;
      let deleted = 0;
      
      // 3. Deletar da YUMER todas que não estão no Supabase
      for (const yumerInstance of yumerInstances) {
        const instanceId = yumerInstance.name || yumerInstance.instanceName;
        const existsInSupabase = supabaseInstances?.some(s => s.instance_id === instanceId);
        
        if (!existsInSupabase) {
          try {
            console.log(`🗑️ [UNIFIED-SYNC] Deletando da YUMER (não existe no Supabase): ${instanceId}`);
            await codechatQRService.deleteInstance(instanceId);
            deleted++;
          } catch (error) {
            errors.push(`Erro ao deletar ${instanceId}: ${error.message}`);
          }
        }
      }
      
      // 4. Criar na YUMER todas que estão no Supabase mas não na YUMER
      for (const supabaseInstance of (supabaseInstances || [])) {
        if (!yumerInstanceIds.has(supabaseInstance.instance_id)) {
          try {
            console.log(`📝 [UNIFIED-SYNC] Criando na YUMER (existe no Supabase): ${supabaseInstance.instance_id}`);
            const result = await codechatQRService.createInstance(
              supabaseInstance.instance_id, 
              `Synced from Supabase: ${supabaseInstance.instance_id}`
            );
            
            if (result.success) {
              created++;
            } else {
              errors.push(`Erro ao criar ${supabaseInstance.instance_id}: ${result.error}`);
            }
          } catch (error) {
            errors.push(`Erro ao criar ${supabaseInstance.instance_id}: ${error.message}`);
          }
        }
      }
      
      console.log(`✅ [UNIFIED-SYNC] Sincronização concluída. Criadas: ${created}, Deletadas: ${deleted}, Erros: ${errors.length}`);
      return { created, deleted, errors };
      
    } catch (error) {
      console.error('❌ [UNIFIED-SYNC] Erro na sincronização forçada:', error);
      throw error;
    }
  },
  
  // ============ EXTERMÍNIO TOTAL DEFINITIVO ============
  async totalExtermination(): Promise<{yumerDeleted: number, supabaseDeleted: number, errors: string[]}> {
    try {
      console.log('💀 [TOTAL-EXTERMINATION] INICIANDO EXTERMÍNIO TOTAL DEFINITIVO...');
      
      const errors: string[] = [];
      let yumerDeleted = 0;
      let supabaseDeleted = 0;
      
      // 1. PRIMEIRO: Buscar TODAS as instâncias da YUMER
      let yumerInstances: any[] = [];
      try {
        yumerInstances = await this.getAllYumerInstances();
        console.log(`💀 [TOTAL-EXTERMINATION] Encontradas ${yumerInstances.length} instâncias na YUMER`);
      } catch (error) {
        console.warn('⚠️ [TOTAL-EXTERMINATION] Erro ao buscar YUMER (continuando):', error);
      }
      
      // 2. DELETAR TODAS da YUMER API com force=true
      for (const instance of yumerInstances) {
        try {
          const instanceId = instance.name || instance.instanceName;
          console.log(`💀 [YUMER-DELETE] Deletando: ${instanceId}`);
          
          await codechatQRService.deleteInstance(instanceId);
          yumerDeleted++;
          
          // Pequena pausa para evitar sobrecarga
          await new Promise(resolve => setTimeout(resolve, 100));
          
        } catch (error) {
          const instanceId = instance.name || instance.instanceName || 'unknown';
          errors.push(`YUMER ${instanceId}: ${error.message}`);
          console.error(`❌ [YUMER-DELETE] Erro:`, error);
        }
      }
      
      // 3. DELETAR TODAS do Supabase
      try {
        console.log(`💀 [SUPABASE-DELETE] Deletando TODAS as instâncias do Supabase...`);
        const result = await cleanupInstancesService.forceCleanupAll();
        supabaseDeleted = result.deletedCount || 0;
        console.log(`💀 [SUPABASE-DELETE] ${supabaseDeleted} instâncias deletadas`);
      } catch (error) {
        errors.push(`Erro no Supabase: ${error.message}`);
        console.error(`❌ [SUPABASE-DELETE] Erro:`, error);
      }
      
      // 4. VERIFICAÇÃO FINAL
      try {
        console.log(`🔍 [VERIFICATION] Verificando se alguma instância sobreviveu...`);
        
        const remainingYumer = await this.getAllYumerInstances();
        const { data: remainingSupabase } = await supabase
          .from('whatsapp_instances')
          .select('instance_id');
        
        console.log(`📊 [VERIFICATION] YUMER restantes: ${remainingYumer.length}`);
        console.log(`📊 [VERIFICATION] Supabase restantes: ${remainingSupabase?.length || 0}`);
        
        if (remainingYumer.length > 0 || (remainingSupabase?.length || 0) > 0) {
          console.warn(`⚠️ [VERIFICATION] Ainda existem instâncias! Pode ser necessária uma segunda rodada.`);
        } else {
          console.log(`✅ [VERIFICATION] EXTERMÍNIO COMPLETO! Nenhuma instância encontrada.`);
        }
        
      } catch (error) {
        console.warn(`⚠️ [VERIFICATION] Erro na verificação final:`, error);
      }
      
      console.log(`💀 [TOTAL-EXTERMINATION] CONCLUÍDO!`);
      console.log(`   🔥 YUMER: ${yumerDeleted} deletadas`);
      console.log(`   🔥 Supabase: ${supabaseDeleted} deletadas`);
      console.log(`   ⚠️ Erros: ${errors.length}`);
      
      return { yumerDeleted, supabaseDeleted, errors };
      
    } catch (error) {
      console.error('❌ [TOTAL-EXTERMINATION] Erro crítico:', error);
      throw error;
    }
  },
  
  // ============ CRIAÇÃO LIMPA DE INSTÂNCIA ============
  async createCleanInstance(clientId: string, customName?: string): Promise<{instanceId: string, success: boolean, error?: string}> {
    try {
      const timestamp = Date.now();
      const instanceId = `${clientId}_${timestamp}`;
      const description = customName || `Clean Instance: ${instanceId}`;
      
      console.log(`📝 [CLEAN-CREATE] Criando instância limpa: ${instanceId}`);
      
      // 1. Criar na YUMER API
      const yumerResult = await codechatQRService.createInstance(instanceId, description);
      
      if (!yumerResult.success) {
        throw new Error(`Falha na YUMER: ${yumerResult.error}`);
      }
      
      // 2. Registrar no Supabase
      await whatsappInstancesService.createInstance({
        instance_id: instanceId,
        client_id: clientId,
        custom_name: customName,
        status: 'disconnected',
        has_qr_code: false
      });
      
      console.log(`✅ [CLEAN-CREATE] Instância criada com sucesso: ${instanceId}`);
      return { instanceId, success: true };
      
    } catch (error) {
      console.error('❌ [CLEAN-CREATE] Erro:', error);
      return { instanceId: '', success: false, error: error.message };
    }
  }
};

export default instancesUnifiedService;