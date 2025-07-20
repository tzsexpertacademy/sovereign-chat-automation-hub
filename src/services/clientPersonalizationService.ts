import { supabase } from "@/integrations/supabase/client";

export interface ClientPersonalization {
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

export const clientPersonalizationService = {
  async updateClient(clientId: string, updates: Partial<ClientPersonalization>) {
    const { data, error } = await supabase
      .from('clients')
      .update(updates)
      .eq('id', clientId)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async uploadAsset(file: File, clientId: string, type: 'avatar' | 'logo') {
    const fileExt = file.name.split('.').pop();
    const fileName = `${clientId}/${type}-${Date.now()}.${fileExt}`;

    const { data, error } = await supabase.storage
      .from('client-assets')
      .upload(fileName, file, {
        cacheControl: '3600',
        upsert: true
      });

    if (error) throw error;

    const { data: { publicUrl } } = supabase.storage
      .from('client-assets')
      .getPublicUrl(fileName);

    return publicUrl;
  },

  async removeAsset(url: string) {
    const path = url.split('/').slice(-2).join('/');
    const { error } = await supabase.storage
      .from('client-assets')
      .remove([path]);

    if (error) throw error;
  }
};