
import { useState, useEffect } from 'react';
import { codechatBusinessService, BusinessData, InstanceData } from '@/services/codechatBusinessService';
import { useToast } from '@/hooks/use-toast';

interface BusinessWithInstances extends BusinessData {
  instances: InstanceData[];
}

export const useCodeChatV2 = () => {
  const [businesses, setBusinesses] = useState<BusinessWithInstances[]>([]);
  const [selectedBusiness, setSelectedBusiness] = useState<BusinessData | null>(null);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadBusinesses();
  }, []);

  const loadBusinesses = async () => {
    try {
      setLoading(true);
      const businessData = await codechatBusinessService.getAllBusinesses();
      
      // Load instances for each business
      const businessesWithInstances = await Promise.all(
        businessData.map(async (business) => {
          try {
            const instances = await codechatBusinessService.getInstancesByBusiness(business.businessToken);
            return { ...business, instances };
          } catch (error) {
            console.error(`Erro ao carregar instâncias do business ${business.businessId}:`, error);
            return { ...business, instances: [] };
          }
        })
      );
      
      setBusinesses(businessesWithInstances);
      console.log(`✅ [CODECHAT-V2] ${businessesWithInstances.length} businesses carregados`);
      
    } catch (error: any) {
      console.error('Erro ao carregar businesses:', error);
      toast({
        title: "Erro",
        description: "Falha ao carregar businesses",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const createBusiness = async (businessData: {
    name: string;
    slug: string;
    email: string;
    phone: string;
    country?: string;
    timezone?: string;
    language?: string;
  }) => {
    try {
      setCreating(true);
      
      const newBusiness = await codechatBusinessService.createBusiness({
        name: businessData.name,
        slug: businessData.slug,
        email: businessData.email,
        phone: businessData.phone,
        country: businessData.country || 'BR',
        timezone: businessData.timezone || 'America/Sao_Paulo',
        language: businessData.language || 'pt-BR',
        active: true
      });

      toast({
        title: "Business Criado",
        description: `Business ${newBusiness.name} criado com sucesso`,
      });

      await loadBusinesses();
      return newBusiness;
      
    } catch (error: any) {
      console.error('Erro ao criar business:', error);
      toast({
        title: "Erro",
        description: error.message || "Falha ao criar business",
        variant: "destructive",
      });
      throw error;
    } finally {
      setCreating(false);
    }
  };

  const createInstance = async (businessId: string, instanceName?: string) => {
    const business = businesses.find(b => b.businessId === businessId);
    if (!business) {
      throw new Error('Business não encontrado');
    }

    try {
      const newInstance = await codechatBusinessService.createInstance(
        business.businessToken, 
        instanceName
      );

      toast({
        title: "Instância Criada",
        description: `Instância ${newInstance.name} criada com sucesso`,
      });

      await loadBusinesses();
      return newInstance;
      
    } catch (error: any) {
      console.error('Erro ao criar instância:', error);
      toast({
        title: "Erro",
        description: error.message || "Falha ao criar instância",
        variant: "destructive",
      });
      throw error;
    }
  };

  const connectInstance = async (businessId: string, instanceId: string) => {
    const business = businesses.find(b => b.businessId === businessId);
    const instance = business?.instances.find(i => i.instanceId === instanceId);
    
    if (!business || !instance) {
      throw new Error('Business ou instância não encontrada');
    }

    try {
      await codechatBusinessService.connectInstance(instance.Auth.jwt, instanceId);
      
      toast({
        title: "Instância Conectada",
        description: "Instância conectada com sucesso",
      });

      await loadBusinesses();
      
    } catch (error: any) {
      console.error('Erro ao conectar instância:', error);
      toast({
        title: "Erro",
        description: error.message || "Falha ao conectar instância",
        variant: "destructive",
      });
      throw error;
    }
  };

  const getQRCode = async (businessId: string, instanceId: string) => {
    const business = businesses.find(b => b.businessId === businessId);
    const instance = business?.instances.find(i => i.instanceId === instanceId);
    
    if (!business || !instance) {
      throw new Error('Business ou instância não encontrada');
    }

    try {
      return await codechatBusinessService.getQRCode(instance.Auth.jwt, instanceId);
    } catch (error: any) {
      console.error('Erro ao buscar QR Code:', error);
      throw error;
    }
  };

  const deleteInstance = async (businessId: string, instanceId: string) => {
    const business = businesses.find(b => b.businessId === businessId);
    
    if (!business) {
      throw new Error('Business não encontrado');
    }

    try {
      await codechatBusinessService.deleteInstance(business.businessToken, instanceId);
      
      toast({
        title: "Instância Removida",
        description: "Instância removida com sucesso",
      });

      await loadBusinesses();
      
    } catch (error: any) {
      console.error('Erro ao remover instância:', error);
      toast({
        title: "Erro",
        description: error.message || "Falha ao remover instância",
        variant: "destructive",
      });
      throw error;
    }
  };

  return {
    businesses,
    selectedBusiness,
    setSelectedBusiness,
    loading,
    creating,
    loadBusinesses,
    createBusiness,
    createInstance,
    connectInstance,
    getQRCode,
    deleteInstance
  };
};
