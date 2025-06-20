
import { supabase } from "@/integrations/supabase/client";

export interface CustomFile {
  id: string;
  name: string;
  type: 'image' | 'pdf' | 'video';
  url: string;
  description?: string;
}

export const fileUploadService = {
  async uploadFile(file: File, clientId: string): Promise<CustomFile> {
    const fileExt = file.name.split('.').pop();
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
    const filePath = `${clientId}/assistant-files/${fileName}`;

    // Upload para o storage do Supabase
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('assistant-files')
      .upload(filePath, file);

    if (uploadError) {
      throw new Error(`Erro no upload: ${uploadError.message}`);
    }

    // Obter URL pública
    const { data: urlData } = supabase.storage
      .from('assistant-files')
      .getPublicUrl(filePath);

    const fileType = file.type.startsWith('image/') ? 'image' : 
                    file.type === 'application/pdf' ? 'pdf' : 'video';

    return {
      id: `file_${Date.now()}_${Math.random().toString(36).substring(2)}`,
      name: file.name,
      type: fileType as 'image' | 'pdf' | 'video',
      url: urlData.publicUrl,
      description: ''
    };
  },

  async deleteFile(filePath: string): Promise<void> {
    const { error } = await supabase.storage
      .from('assistant-files')
      .remove([filePath]);

    if (error) {
      throw new Error(`Erro ao deletar arquivo: ${error.message}`);
    }
  },

  getFileTypeIcon(type: string): string {
    switch (type) {
      case 'image': return '🖼️';
      case 'pdf': return '📄';
      case 'video': return '🎥';
      default: return '📎';
    }
  }
};
