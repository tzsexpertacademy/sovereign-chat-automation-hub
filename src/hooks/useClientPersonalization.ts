import { useState } from 'react';
import { clientPersonalizationService, type ClientPersonalization } from '@/services/clientPersonalizationService';
import { useToast } from '@/hooks/use-toast';

export const useClientPersonalization = () => {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const updateProfile = async (clientId: string, updates: Partial<ClientPersonalization>) => {
    setLoading(true);
    try {
      const updatedClient = await clientPersonalizationService.updateClient(clientId, updates);
      toast({
        title: "Perfil atualizado",
        description: "Suas informações foram salvas com sucesso.",
      });
      return updatedClient;
    } catch (error) {
      toast({
        title: "Erro ao atualizar perfil",
        description: "Não foi possível salvar as alterações.",
        variant: "destructive",
      });
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const uploadAsset = async (file: File, clientId: string, type: 'avatar' | 'logo') => {
    setLoading(true);
    try {
      const url = await clientPersonalizationService.uploadAsset(file, clientId, type);
      const fieldName = type === 'avatar' ? 'avatar_url' : 'company_logo_url';
      
      await clientPersonalizationService.updateClient(clientId, {
        [fieldName]: url
      });

      toast({
        title: `${type === 'avatar' ? 'Avatar' : 'Logo'} atualizado`,
        description: "Arquivo carregado com sucesso.",
      });
      
      return url;
    } catch (error) {
      toast({
        title: "Erro no upload",
        description: "Não foi possível fazer upload do arquivo.",
        variant: "destructive",
      });
      throw error;
    } finally {
      setLoading(false);
    }
  };

  return {
    loading,
    updateProfile,
    uploadAsset
  };
};