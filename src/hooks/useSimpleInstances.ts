
import { useState, useEffect } from 'react';
import whatsappService, { WhatsAppClient } from '@/services/whatsappMultiClient';
import { useToast } from '@/hooks/use-toast';

export const useSimpleInstances = () => {
  const [instances, setInstances] = useState<WhatsAppClient[]>([]);
  const [loading, setLoading] = useState(false);
  const [serverOnline, setServerOnline] = useState(false);
  const { toast } = useToast();

  const checkServer = async () => {
    try {
      const result = await whatsappService.testConnection();
      setServerOnline(result.success);
      return result.success;
    } catch (error) {
      setServerOnline(false);
      return false;
    }
  };

  const loadInstances = async () => {
    if (!serverOnline) return;
    
    try {
      setLoading(true);
      const instancesData = await whatsappService.getAllClients();
      setInstances(instancesData);
      
      // Setup WebSocket listeners
      instancesData.forEach(instance => {
        whatsappService.joinClientRoom(instance.clientId);
        whatsappService.onClientStatus(instance.clientId, (updatedClient) => {
          setInstances(prev => 
            prev.map(inst => 
              inst.clientId === updatedClient.clientId ? updatedClient : inst
            )
          );
        });
      });
      
    } catch (error: any) {
      console.error('Erro ao carregar instâncias:', error);
      toast({
        title: "Erro",
        description: "Falha ao carregar instâncias",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const createInstance = async (clientId: string) => {
    try {
      setLoading(true);
      const result = await whatsappService.connectClient(clientId);
      
      toast({
        title: "Sucesso",
        description: "Instância criada! Aguarde o QR Code..."
      });
      
      // Reload instances after creation
      setTimeout(loadInstances, 2000);
      
      return result;
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message || "Falha ao criar instância",
        variant: "destructive"
      });
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const connectInstance = async (clientId: string) => {
    try {
      setLoading(true);
      await whatsappService.connectClient(clientId);
      
      toast({
        title: "Sucesso",
        description: "Conectando instância..."
      });
      
      setTimeout(loadInstances, 2000);
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message || "Falha ao conectar instância",
        variant: "destructive"
      });
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const disconnectInstance = async (clientId: string) => {
    try {
      setLoading(true);
      await whatsappService.disconnectClient(clientId);
      
      toast({
        title: "Sucesso",
        description: "Instância desconectada"
      });
      
      setTimeout(loadInstances, 2000);
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message || "Falha ao desconectar instância",
        variant: "destructive"
      });
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const getInstanceStatus = async (clientId: string) => {
    try {
      return await whatsappService.getClientStatus(clientId);
    } catch (error: any) {
      toast({
        title: "Erro",
        description: "Falha ao buscar status da instância",
        variant: "destructive"
      });
      throw error;
    }
  };

  useEffect(() => {
    const initialize = async () => {
      const isOnline = await checkServer();
      if (isOnline) {
        whatsappService.connectSocket();
        await loadInstances();
      }
    };
    
    initialize();
  }, []);

  return {
    instances,
    loading,
    serverOnline,
    checkServer,
    loadInstances,
    createInstance,
    connectInstance,
    disconnectInstance,
    getInstanceStatus
  };
};
