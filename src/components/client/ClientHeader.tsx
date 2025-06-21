
import { useState, useEffect } from "react";
import { Bell, User, Smartphone, Wifi, WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Badge } from "@/components/ui/badge";
import { whatsappInstancesService } from "@/services/whatsappInstancesService";
import { whatsappService } from "@/services/whatsappMultiClient";

interface ClientHeaderProps {
  clientId?: string;
}

const ClientHeader = ({ clientId }: ClientHeaderProps) => {
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [connectedInstanceName, setConnectedInstanceName] = useState<string>("");

  useEffect(() => {
    if (!clientId) return;

    const checkConnectionStatus = async () => {
      try {
        setIsLoading(true);
        
        // Buscar instâncias do cliente
        const instances = await whatsappInstancesService.getInstancesByClientId(clientId);
        
        if (instances.length === 0) {
          setIsConnected(false);
          setConnectedInstanceName("");
          return;
        }

        // Verificar status de cada instância
        let hasConnectedInstance = false;
        let connectedName = "";

        for (const instance of instances) {
          try {
            const status = await whatsappService.getClientStatus(instance.instance_id);
            
            if (status.status === 'connected' || status.status === 'open') {
              hasConnectedInstance = true;
              connectedName = instance.custom_name || instance.instance_id;
              break;
            }
          } catch (error) {
            console.error('Erro ao verificar status da instância:', instance.instance_id, error);
          }
        }

        setIsConnected(hasConnectedInstance);
        setConnectedInstanceName(connectedName);
        
      } catch (error) {
        console.error('Erro ao verificar status das conexões:', error);
        setIsConnected(false);
        setConnectedInstanceName("");
      } finally {
        setIsLoading(false);
      }
    };

    // Verificar status inicial
    checkConnectionStatus();

    // Verificar status a cada 30 segundos
    const interval = setInterval(checkConnectionStatus, 30000);

    return () => clearInterval(interval);
  }, [clientId]);

  const getConnectionStatus = () => {
    if (isLoading) {
      return {
        icon: <Wifi className="w-5 h-5 text-gray-400 animate-pulse" />,
        badge: <Badge variant="secondary">Verificando...</Badge>
      };
    }

    if (isConnected) {
      return {
        icon: <Wifi className="w-5 h-5 text-green-500" />,
        badge: (
          <Badge variant="default" className="bg-green-500 hover:bg-green-600">
            WhatsApp Conectado
          </Badge>
        )
      };
    }

    return {
      icon: <WifiOff className="w-5 h-5 text-red-500" />,
      badge: (
        <Badge variant="destructive">
          Desconectado
        </Badge>
      )
    };
  };

  const connectionStatus = getConnectionStatus();

  return (
    <header className="h-16 border-b bg-white flex items-center justify-between px-6">
      <div className="flex items-center space-x-4">
        <SidebarTrigger />
        <div className="flex items-center space-x-3">
          <div className="text-lg font-bold bg-gradient-to-r from-green-600 to-blue-600 bg-clip-text text-transparent">
            YumerFlow
          </div>
          <div className="flex items-center space-x-2">
            {connectionStatus.icon}
            {connectionStatus.badge}
            {isConnected && connectedInstanceName && (
              <span className="text-xs text-gray-500">
                ({connectedInstanceName})
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center space-x-4">
        <Button variant="ghost" size="sm" className="relative">
          <Bell className="w-5 h-5" />
          <Badge className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-red-500 text-white text-xs flex items-center justify-center">
            2
          </Badge>
        </Button>
        
        <div className="flex items-center space-x-3">
          <div className="text-right">
            <p className="text-sm font-medium text-gray-900">Cliente {clientId}</p>
            <p className="text-xs text-gray-500">YumerFlow Pro</p>
          </div>
          <Button variant="ghost" size="sm" className="rounded-full p-2">
            <User className="w-5 h-5" />
          </Button>
        </div>
      </div>
    </header>
  );
};

export default ClientHeader;
