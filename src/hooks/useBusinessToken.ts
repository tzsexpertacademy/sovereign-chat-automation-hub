import { useState } from 'react';
import { businessTokenService, type BusinessTokenResult } from '@/services/businessTokenService';
import { useToast } from '@/hooks/use-toast';

export const useBusinessToken = () => {
  const [isRegenerating, setIsRegenerating] = useState(false);
  const { toast } = useToast();

  const regenerateToken = async (clientId: string): Promise<BusinessTokenResult> => {
    setIsRegenerating(true);
    
    try {
      const result = await businessTokenService.regenerateBusinessToken(clientId);
      
      if (result.success) {
        toast({
          title: "Token regenerado",
          description: "Business token foi renovado com sucesso.",
        });
      } else {
        toast({
          title: "Erro ao regenerar token",
          description: result.error || "Não foi possível regenerar o token.",
          variant: "destructive",
        });
      }
      
      return result;
    } catch (error: any) {
      const errorResult: BusinessTokenResult = {
        success: false,
        error: error.message || 'Erro desconhecido'
      };
      
      toast({
        title: "Erro ao regenerar token",
        description: errorResult.error,
        variant: "destructive",
      });
      
      return errorResult;
    } finally {
      setIsRegenerating(false);
    }
  };

  const validateToken = async (clientId: string): Promise<boolean> => {
    try {
      return await businessTokenService.validateBusinessToken(clientId);
    } catch (error) {
      console.error('Erro ao validar token:', error);
      return false;
    }
  };

  const ensureValidToken = async (clientId: string): Promise<BusinessTokenResult> => {
    try {
      return await businessTokenService.ensureValidToken(clientId);
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Erro desconhecido'
      };
    }
  };

  const getValidToken = async (clientId: string): Promise<string | null> => {
    try {
      return await businessTokenService.getValidBusinessToken(clientId);
    } catch (error) {
      console.error('Erro ao obter token válido:', error);
      return null;
    }
  };

  return {
    isRegenerating,
    regenerateToken,
    validateToken,
    ensureValidToken,
    getValidToken
  };
};