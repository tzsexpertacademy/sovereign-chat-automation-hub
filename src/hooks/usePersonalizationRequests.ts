import { useState } from 'react';
import { clientPersonalizationService, type PersonalizationRequest } from '@/services/clientPersonalizationService';
import { useToast } from '@/hooks/use-toast';

export const usePersonalizationRequests = () => {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const createRequest = async (clientId: string, request: Omit<Partial<PersonalizationRequest>, 'id' | 'client_id' | 'clients'>) => {
    setLoading(true);
    try {
      const newRequest = await clientPersonalizationService.createRequest(clientId, request);
      toast({
        title: "Solicitação enviada",
        description: "Sua solicitação foi enviada com sucesso.",
      });
      return newRequest;
    } catch (error) {
      toast({
        title: "Erro ao enviar solicitação",
        description: "Não foi possível enviar a solicitação.",
        variant: "destructive",
      });
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const uploadAttachment = async (file: File, requestId: string) => {
    setLoading(true);
    try {
      const url = await clientPersonalizationService.uploadAttachment(file, requestId);
      toast({
        title: "Anexo enviado",
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
    createRequest,
    uploadAttachment
  };
};