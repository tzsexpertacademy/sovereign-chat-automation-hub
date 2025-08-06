import { useState } from 'react';
import { supabase } from "@/integrations/supabase/client";
import { useToast } from '@/hooks/use-toast';

export interface ClientProfile {
  id: string;
  name: string;
  email: string;
  avatar_url?: string;
  company_logo_url?: string;
  brand_colors?: {
    primary: string;
    secondary: string;
    accent: string;
  };
  custom_theme?: {
    sidebar_bg: string;
    header_bg: string;
    text_primary: string;
    text_secondary: string;
  };
}

export const useClientProfile = () => {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const updateProfile = async (clientId: string, updates: Partial<ClientProfile>) => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('clients')
        .update(updates)
        .eq('id', clientId)
        .select()
        .single();

      if (error) throw error;
      
      toast({
        title: "Perfil atualizado",
        description: "Suas informações foram salvas com sucesso.",
      });
      return data;
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
      const fileExt = file.name.split('.').pop();
      const fileName = `${clientId}/${type}-${Date.now()}.${fileExt}`;

      console.log('🔄 Iniciando upload:', { fileName, fileSize: file.size, fileType: file.type });

      const { data, error } = await supabase.storage
        .from('client-assets')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: true
        });

      if (error) {
        console.error('❌ Erro no upload:', error);
        throw error;
      }

      console.log('✅ Upload concluído:', data);

      const { data: { publicUrl } } = supabase.storage
        .from('client-assets')
        .getPublicUrl(fileName);

      console.log('🔗 URL pública gerada:', publicUrl);

      // Atualizar o perfil do cliente com a nova URL
      const fieldName = type === 'avatar' ? 'avatar_url' : 'company_logo_url';
      
      await updateProfile(clientId, {
        [fieldName]: publicUrl
      });

      toast({
        title: `${type === 'avatar' ? 'Avatar' : 'Logo'} atualizado`,
        description: "Arquivo carregado com sucesso.",
      });
      
      return publicUrl;
    } catch (error) {
      console.error('💥 Erro geral no upload:', error);
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

  const removeAsset = async (url: string) => {
    try {
      const path = url.split('/').slice(-2).join('/');
      const { error } = await supabase.storage
        .from('client-assets')
        .remove([path]);

      if (error) throw error;
    } catch (error) {
      console.error('Erro ao remover asset:', error);
      throw error;
    }
  };

  return {
    loading,
    updateProfile,
    uploadAsset,
    removeAsset
  };
};