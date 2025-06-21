import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Trash2, Plus, Settings, Power, PowerOff, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { whatsappService } from '@/services/whatsappMultiClient'; // Corrigindo importação

interface WhatsAppClient {
  clientId: string;
  status: string;
  phoneNumber?: string;
  hasQrCode: boolean;
  qrCode?: string;
}

const RealInstancesManager = () => {
  const [clients, setClients] = useState<WhatsAppClient[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    loadClients();
  }, []);

  const loadClients = async () => {
    setLoading(true);
    try {
      const clientsData = await whatsappService.getAllClients();
      setClients(clientsData);
    } catch (error: any) {
      toast({
        title: "Erro ao carregar instâncias",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleConnectClient = async (clientId: string) => {
    try {
      await whatsappService.connectClient(clientId);
      toast({
        title: "Instância conectada",
        description: `Instância ${clientId} conectada com sucesso.`,
      });
      loadClients();
    } catch (error: any) {
      toast({
        title: "Erro ao conectar instância",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleDisconnectClient = async (clientId: string) => {
    try {
      await whatsappService.disconnectClient(clientId);
      toast({
        title: "Instância desconectada",
        description: `Instância ${clientId} desconectada com sucesso.`,
      });
      loadClients();
    } catch (error: any) {
      toast({
        title: "Erro ao desconectar instância",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Gerenciar Instâncias WhatsApp</CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center">
            <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
            Carregando instâncias...
          </div>
        ) : (
          <div className="grid gap-4">
            {clients.map((client) => (
              <Card key={client.clientId}>
                <CardHeader className="flex items-center justify-between">
                  <CardTitle>Instância: {client.clientId}</CardTitle>
                  <div className="flex items-center space-x-2">
                    <Badge variant={client.status === 'connected' ? 'outline' : 'secondary'}>
                      {client.status}
                    </Badge>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleConnectClient(client.clientId)}
                      disabled={client.status === 'connected'}
                    >
                      <Power className="mr-2 h-4 w-4" />
                      Conectar
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDisconnectClient(client.clientId)}
                      disabled={client.status !== 'connected'}
                    >
                      <PowerOff className="mr-2 h-4 w-4" />
                      Desconectar
                    </Button>
                    <Button variant="destructive" size="sm">
                      <Trash2 className="mr-2 h-4 w-4" />
                      Remover
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <p>Número: {client.phoneNumber || 'N/A'}</p>
                </CardContent>
              </Card>
            ))}
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Adicionar Nova Instância
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default RealInstancesManager;
