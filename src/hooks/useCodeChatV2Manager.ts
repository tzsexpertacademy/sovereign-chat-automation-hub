import { useState, useEffect } from 'react';
import { codechatV2Service, BusinessData, InstanceData, CreateBusinessRequest } from '@/services/codechatV2Service';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface BusinessWithInstances extends BusinessData {
  instances: InstanceData[];
  supabaseId?: string;
}

export const useCodeChatV2Manager = (clientId?: string) => {
  const [businesses, setBusinesses] = useState<BusinessWithInstances[]>([]);
  const [selectedBusiness, setSelectedBusiness] = useState<BusinessWithInstances | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const { toast } = useToast();

  // Carregar businesses do Supabase
  const loadBusinessesFromSupabase = async () => {
    if (!clientId) return [];

    try {
      console.log('📋 [V2-MANAGER] Carregando businesses do Supabase...');
      
      const { data: businessesData, error } = await supabase
        .from('codechat_businesses')
        .select(`
          *,
          whatsapp_instances (
            id,
            instance_id,
            codechat_instance_name,
            status,
            connection_state,
            auth_jwt,
            api_version,
            created_at,
            updated_at
          )
        `)
        .eq('client_id', clientId)
        .eq('active', true);

      if (error) {
        console.error('❌ [V2-MANAGER] Erro ao carregar businesses:', error);
        throw error;
      }

      console.log('✅ [V2-MANAGER] Businesses carregados:', businessesData);
      return businessesData || [];

    } catch (error) {
      console.error('❌ [V2-MANAGER] Erro:', error);
      toast({
        title: "Erro",
        description: "Erro ao carregar businesses",
        variant: "destructive"
      });
      return [];
    }
  };

  // Carregar businesses completos (API + Supabase)
  const loadBusinesses = async () => {
    setIsLoading(true);
    try {
      const supabaseBusinesses = await loadBusinessesFromSupabase();
      
      const businessesWithInstances: BusinessWithInstances[] = supabaseBusinesses.map(business => ({
        id: business.id,
        businessId: business.business_id,
        name: business.name,
        slug: business.slug,
        email: business.email,
        phone: business.phone,
        country: business.country,
        timezone: business.timezone,
        language: business.language,
        active: business.active,
        businessToken: business.business_token,
        createdAt: business.created_at,
        updatedAt: business.updated_at,
        deletedAt: business.deleted_at,
        supabaseId: business.id,
        instances: business.whatsapp_instances?.map((instance: any) => ({
          id: instance.id,
          instanceId: instance.instance_id,
          name: instance.codechat_instance_name || instance.instance_id,
          state: instance.status === 'connected' ? 'active' : 'inactive',
          connection: instance.connection_state || 'close',
          createdAt: instance.created_at,
          businessBusinessId: business.business_id,
          Auth: {
            id: instance.id,
            jwt: instance.auth_jwt || '',
            createdAt: instance.created_at,
            updatedAt: instance.updated_at
          }
        })) || []
      }));

      setBusinesses(businessesWithInstances);
      console.log('✅ [V2-MANAGER] Businesses processados:', businessesWithInstances);

    } catch (error) {
      console.error('❌ [V2-MANAGER] Erro ao carregar businesses:', error);
      toast({
        title: "Erro",
        description: "Erro ao carregar businesses",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Criar novo business
  const createBusiness = async (businessData: CreateBusinessRequest) => {
    if (!clientId) {
      toast({
        title: "Erro",
        description: "Cliente não identificado",
        variant: "destructive"
      });
      return null;
    }

    setIsCreating(true);
    try {
      console.log('🏢 [V2-MANAGER] Criando novo business...');

      // Criar business via API (quando CORS estiver resolvido)
      // const newBusiness = await codechatV2Service.createBusiness(businessData);
      
      // Por enquanto, criar direto no Supabase para desenvolvimento
      const { data: newBusiness, error } = await supabase
        .from('codechat_businesses')
        .insert({
          business_id: `biz_${Date.now()}`,
          name: businessData.name,
          slug: businessData.slug,
          email: businessData.email,
          phone: businessData.phone,
          country: businessData.country || 'BR',
          timezone: businessData.timezone || 'America/Sao_Paulo',
          language: businessData.language || 'pt-BR',
          active: businessData.active !== false,
          business_token: `token_${Date.now()}`, // Temporário
          client_id: clientId
        })
        .select()
        .single();

      if (error) throw error;

      console.log('✅ [V2-MANAGER] Business criado:', newBusiness);
      
      toast({
        title: "Sucesso",
        description: `Business "${businessData.name}" criado com sucesso`,
      });

      await loadBusinesses();
      return newBusiness;

    } catch (error: any) {
      console.error('❌ [V2-MANAGER] Erro ao criar business:', error);
      toast({
        title: "Erro",
        description: error.message || "Erro ao criar business",
        variant: "destructive"
      });
      return null;
    } finally {
      setIsCreating(false);
    }
  };

  // Criar instância para um business
  const createInstance = async (businessId: string, instanceName?: string) => {
    const business = businesses.find(b => b.id === businessId);
    if (!business) {
      toast({
        title: "Erro",
        description: "Business não encontrado",
        variant: "destructive"
      });
      return null;
    }

    try {
      console.log('📱 [V2-MANAGER] Criando instância...');

      // Criar instância via API (quando CORS estiver resolvido)
      // const newInstance = await codechatV2Service.createInstance(business.businessToken, instanceName);
      
      // Por enquanto, criar direto no Supabase para desenvolvimento
      const instanceId = `inst_${Date.now()}`;
      const { data: newInstance, error } = await supabase
        .from('whatsapp_instances')
        .insert({
          instance_id: instanceId,
          codechat_instance_name: instanceName || instanceId,
          status: 'disconnected',
          connection_state: 'close',
          codechat_business_id: business.supabaseId,
          business_business_id: business.businessId,
          api_version: 'v2.1.3',
          client_id: clientId
        })
        .select()
        .single();

      if (error) throw error;

      console.log('✅ [V2-MANAGER] Instância criada:', newInstance);
      
      toast({
        title: "Sucesso",
        description: `Instância "${instanceName || instanceId}" criada com sucesso`,
      });

      await loadBusinesses();
      return newInstance;

    } catch (error: any) {
      console.error('❌ [V2-MANAGER] Erro ao criar instância:', error);
      toast({
        title: "Erro",
        description: error.message || "Erro ao criar instância",
        variant: "destructive"
      });
      return null;
    }
  };

  // Conectar instância
  const connectInstance = async (businessId: string, instanceId: string) => {
    const business = businesses.find(b => b.id === businessId);
    const instance = business?.instances.find(i => i.instanceId === instanceId);
    
    if (!business || !instance) {
      toast({
        title: "Erro",
        description: "Business ou instância não encontrada",
        variant: "destructive"
      });
      return null;
    }

    try {
      console.log('🔌 [V2-MANAGER] Conectando instância...');

      // Por enquanto, simular conexão
      const { error } = await supabase
        .from('whatsapp_instances')
        .update({
          status: 'connecting',
          connection_state: 'connecting'
        })
        .eq('instance_id', instanceId);

      if (error) throw error;

      toast({
        title: "Conectando",
        description: "Iniciando conexão da instância...",
      });

      await loadBusinesses();
      return true;

    } catch (error: any) {
      console.error('❌ [V2-MANAGER] Erro ao conectar instância:', error);
      toast({
        title: "Erro",
        description: error.message || "Erro ao conectar instância",
        variant: "destructive"
      });
      return null;
    }
  };

  // Obter QR Code
  const getQRCode = async (businessId: string, instanceId: string) => {
    const business = businesses.find(b => b.id === businessId);
    const instance = business?.instances.find(i => i.instanceId === instanceId);
    
    if (!business || !instance) {
      throw new Error('Business ou instância não encontrada');
    }

    try {
      console.log('📱 [V2-MANAGER] Obtendo QR Code...');

      // Por enquanto, retornar QR simulado
      return {
        base64: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
        code: 'QRCODE_SIMULADO'
      };

    } catch (error: any) {
      console.error('❌ [V2-MANAGER] Erro ao obter QR Code:', error);
      throw error;
    }
  };

  // Deletar instância
  const deleteInstance = async (businessId: string, instanceId: string) => {
    try {
      console.log('🗑️ [V2-MANAGER] Deletando instância...');

      const { error } = await supabase
        .from('whatsapp_instances')
        .delete()
        .eq('instance_id', instanceId);

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: "Instância deletada com sucesso",
      });

      await loadBusinesses();

    } catch (error: any) {
      console.error('❌ [V2-MANAGER] Erro ao deletar instância:', error);
      toast({
        title: "Erro",
        description: error.message || "Erro ao deletar instância",
        variant: "destructive"
      });
    }
  };

  // Estatísticas
  const getStats = () => {
    const totalBusinesses = businesses.length;
    const totalInstances = businesses.reduce((acc, b) => acc + b.instances.length, 0);
    const connectedInstances = businesses.reduce(
      (acc, b) => acc + b.instances.filter(i => i.connection === 'open').length, 0
    );

    return {
      totalBusinesses,
      totalInstances,
      connectedInstances,
      disconnectedInstances: totalInstances - connectedInstances
    };
  };

  useEffect(() => {
    if (clientId) {
      loadBusinesses();
    }
  }, [clientId]);

  return {
    businesses,
    selectedBusiness,
    isLoading,
    isCreating,
    stats: getStats(),
    actions: {
      loadBusinesses,
      createBusiness,
      createInstance,
      connectInstance,
      getQRCode,
      deleteInstance,
      setSelectedBusiness
    }
  };
};