import { supabase } from "@/integrations/supabase/client";
import unifiedYumerService, { YumerBusiness } from "./unifiedYumerService";

/**
 * Serviço de Sincronização Business-Client
 * Sincroniza businesses da API Yumer com o banco local e vincula aos clientes
 */
export class BusinessSyncService {
  
  /**
   * Sincronizar todos os businesses da API Yumer para o banco local
   */
  async syncBusinessesToLocal(): Promise<void> {
    console.log('🔄 [BUSINESS-SYNC] Iniciando sincronização de businesses...');
    
    try {
      // 1. Buscar businesses da API Yumer
      const response = await unifiedYumerService.listBusinesses();
      if (!response.success || !response.data) {
        throw new Error(response.error || 'Erro ao buscar businesses da API');
      }
      
      const yumerBusinesses = response.data;
      console.log(`📥 [BUSINESS-SYNC] ${yumerBusinesses.length} businesses encontrados na API Yumer`);
      
      // 2. Para cada business, verificar se existe no banco local
      for (const yumerBusiness of yumerBusinesses) {
        await this.syncSingleBusiness(yumerBusiness);
      }
      
      console.log('✅ [BUSINESS-SYNC] Sincronização concluída');
    } catch (error) {
      console.error('❌ [BUSINESS-SYNC] Erro na sincronização:', error);
      throw error;
    }
  }

  /**
   * Sincronizar um business específico
   */
  private async syncSingleBusiness(yumerBusiness: YumerBusiness): Promise<void> {
    try {
      // Verificar se já existe no banco local
      const { data: existingBusiness } = await supabase
        .from('codechat_businesses')
        .select('*')
        .eq('business_id', yumerBusiness.businessId)
        .single();

      if (existingBusiness) {
        // Atualizar business existente
        await supabase
          .from('codechat_businesses')
          .update({
            name: yumerBusiness.name,
            email: yumerBusiness.email,
            phone: yumerBusiness.phone,
            slug: yumerBusiness.slug,
            country: yumerBusiness.country,
            timezone: yumerBusiness.timezone,
            language: yumerBusiness.language,
            active: yumerBusiness.active,
            business_token: yumerBusiness.businessToken,
            updated_at: new Date().toISOString()
          })
          .eq('business_id', yumerBusiness.businessId);
        
        console.log(`🔄 [BUSINESS-SYNC] Business atualizado: ${yumerBusiness.name}`);
      } else {
        // Criar novo business
        await supabase
          .from('codechat_businesses')
          .insert({
            business_id: yumerBusiness.businessId,
            name: yumerBusiness.name,
            email: yumerBusiness.email,
            phone: yumerBusiness.phone,
            slug: yumerBusiness.slug,
            country: yumerBusiness.country,
            timezone: yumerBusiness.timezone,
            language: yumerBusiness.language,
            active: yumerBusiness.active,
            business_token: yumerBusiness.businessToken,
            client_id: null // Será vinculado depois
          });
        
        console.log(`➕ [BUSINESS-SYNC] Novo business criado: ${yumerBusiness.name}`);
      }
    } catch (error) {
      console.error(`❌ [BUSINESS-SYNC] Erro ao sincronizar business ${yumerBusiness.businessId}:`, error);
    }
  }

  /**
   * Vincular um business a um cliente específico
   */
  async linkBusinessToClient(businessId: string, clientId: string): Promise<void> {
    console.log(`🔗 [BUSINESS-SYNC] Vinculando business ${businessId} ao cliente ${clientId}`);
    
    try {
      const { error } = await supabase
        .from('codechat_businesses')
        .update({ client_id: clientId })
        .eq('business_id', businessId);

      if (error) throw error;
      
      console.log('✅ [BUSINESS-SYNC] Business vinculado com sucesso');
    } catch (error) {
      console.error('❌ [BUSINESS-SYNC] Erro ao vincular business:', error);
      throw error;
    }
  }

  /**
   * Buscar ou criar business para um cliente
   */
  async ensureBusinessForClient(clientId: string, clientName: string, clientEmail: string, clientPhone: string): Promise<string> {
    console.log(`🔍 [BUSINESS-SYNC] Garantindo business para cliente ${clientId}`);
    
    try {
      // 1. Verificar se cliente já tem um business
      const { data: existingBusiness } = await supabase
        .from('codechat_businesses')
        .select('business_id')
        .eq('client_id', clientId)
        .single();

      if (existingBusiness) {
        console.log(`✅ [BUSINESS-SYNC] Business existente encontrado: ${existingBusiness.business_id}`);
        return existingBusiness.business_id;
      }

      // 2. Criar novo business na API Yumer
      const response = await unifiedYumerService.createBusiness({
        name: clientName,
        email: clientEmail,
        phone: clientPhone,
        slug: clientId,
        country: 'BR',
        timezone: 'America/Sao_Paulo',
        language: 'pt-BR'
      });

      if (!response.success || !response.data) {
        throw new Error(response.error || 'Erro ao criar business na API');
      }

      const newBusiness = response.data;

      // 3. Salvar no banco local com vinculação
      await supabase
        .from('codechat_businesses')
        .insert({
          business_id: newBusiness.businessId,
          name: newBusiness.name,
          email: newBusiness.email,
          phone: newBusiness.phone,
          slug: newBusiness.slug,
          country: newBusiness.country,
          timezone: newBusiness.timezone,
          language: newBusiness.language,
          active: newBusiness.active,
          business_token: newBusiness.businessToken,
          client_id: clientId
        });

      console.log(`✅ [BUSINESS-SYNC] Novo business criado e vinculado: ${newBusiness.businessId}`);
      return newBusiness.businessId;
    } catch (error) {
      console.error('❌ [BUSINESS-SYNC] Erro ao garantir business para cliente:', error);
      throw error;
    }
  }

  /**
   * Buscar businesses locais vinculados aos clientes
   */
  async getLocalBusinesses(): Promise<any[]> {
    try {
      const { data: businesses, error } = await supabase
        .from('codechat_businesses')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return businesses || [];
    } catch (error) {
      console.error('❌ [BUSINESS-SYNC] Erro ao buscar businesses locais:', error);
      return [];
    }
  }

  /**
   * Buscar business por ID no banco local
   */
  async getLocalBusinessById(businessId: string): Promise<any | null> {
    try {
      const { data: business, error } = await supabase
        .from('codechat_businesses')
        .select('*')
        .eq('business_id', businessId)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      return business;
    } catch (error) {
      console.error('❌ [BUSINESS-SYNC] Erro ao buscar business local:', error);
      return null;
    }
  }

  /**
   * Auto-vincular businesses órfãos baseado em heurística (nome, email)
   */
  async autoLinkOrphanBusinesses(): Promise<void> {
    console.log('🔄 [BUSINESS-SYNC] Iniciando auto-vinculação de businesses órfãos...');
    
    try {
      // 1. Buscar businesses sem client_id
      const { data: orphanBusinesses } = await supabase
        .from('codechat_businesses')
        .select('*')
        .is('client_id', null);

      if (!orphanBusinesses || orphanBusinesses.length === 0) {
        console.log('✅ [BUSINESS-SYNC] Nenhum business órfão encontrado');
        return;
      }

      // 2. Buscar todos os clientes
      const { data: clients } = await supabase
        .from('clients')
        .select('*');

      if (!clients) return;

      // 3. Tentar vincular por nome ou email
      for (const business of orphanBusinesses) {
        const matchingClient = clients.find(client => 
          client.name === business.name || 
          client.email === business.email ||
          client.phone === business.phone
        );

        if (matchingClient) {
          await this.linkBusinessToClient(business.business_id, matchingClient.id);
          console.log(`🔗 [BUSINESS-SYNC] Auto-vinculado: ${business.name} → ${matchingClient.name}`);
        }
      }
    } catch (error) {
      console.error('❌ [BUSINESS-SYNC] Erro na auto-vinculação:', error);
    }
  }
}

export const businessSyncService = new BusinessSyncService();