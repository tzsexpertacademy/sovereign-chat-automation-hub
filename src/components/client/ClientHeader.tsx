import { useState, useEffect } from 'react';
import { Bell, Wifi, WifiOff, Edit, Smartphone, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { clientsService, type ClientData } from '@/services/clientsService';
import { EditProfileModal } from './EditProfileModal';
import { ConfigureLogoModal } from './ConfigureLogoModal';
import { cn } from '@/lib/utils';

interface ClientHeaderProps {
  clientId?: string;
}

export function ClientHeader({ clientId }: ClientHeaderProps) {
  const [clientData, setClientData] = useState<ClientData | null>(null);
  const [editProfileOpen, setEditProfileOpen] = useState(false);
  const [configureLogoOpen, setConfigureLogoOpen] = useState(false);
  const isConnected = true; // Simulado

  useEffect(() => {
    const loadClientData = async () => {
      try {
        const clients = await clientsService.getAllClients();
        const client = clients.find(c => c.id === clientId);
        setClientData(client || null);
      } catch (error) {
        console.error('Erro ao carregar dados do cliente:', error);
      }
    };

    if (clientId) {
      loadClientData();
    }
  }, [clientId]);

  const getClientInitials = (name: string) => {
    return name
      .split(' ')
      .map(word => word.charAt(0).toUpperCase())
      .join('')
      .substring(0, 2);
  };

  return (
    <header className="h-16 border-b bg-gradient-to-r from-background to-muted/20 backdrop-blur-sm flex items-center justify-between px-6 shadow-sm">
      <div className="flex items-center space-x-4">
        <SidebarTrigger className="hover:bg-muted/50 rounded-lg p-2 transition-colors" />
        <div className="flex items-center space-x-3">
          {clientData?.company_logo_url ? (
            <img 
              src={clientData.company_logo_url} 
              alt="Logo da empresa" 
              className="h-8 w-auto"
            />
          ) : (
            <div className="text-lg font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
              YumerFlow
            </div>
          )}
          <div className="flex items-center space-x-2">
            {isConnected ? (
              <Wifi className="w-5 h-5 text-green-500" />
            ) : (
              <WifiOff className="w-5 h-5 text-red-500" />
            )}
            <Badge 
              variant={isConnected ? "default" : "secondary"}
              className={cn(
                "transition-all duration-200",
                isConnected 
                  ? "bg-green-100 text-green-800 border-green-200 hover:bg-green-200" 
                  : "bg-red-100 text-red-800 border-red-200"
              )}
            >
              {isConnected ? "WhatsApp Conectado" : "Desconectado"}
            </Badge>
          </div>
        </div>
      </div>

      <div className="flex items-center space-x-4">
        <Button variant="ghost" size="sm" className="relative hover:bg-muted/50 rounded-lg transition-colors">
          <Bell className="w-5 h-5" />
          <Badge className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-destructive text-destructive-foreground text-xs flex items-center justify-center animate-pulse">
            2
          </Badge>
        </Button>
        
        <div className="flex items-center space-x-3">
          <div className="text-right">
            <p className="text-sm font-medium text-foreground">
              {clientData?.name || `Cliente ${clientId}`}
            </p>
            <p className="text-xs text-muted-foreground">
              YumerFlow {clientData?.plan ? clientData.plan.charAt(0).toUpperCase() + clientData.plan.slice(1) : 'Basic'}
            </p>
          </div>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="rounded-full p-2 hover:bg-muted/50 transition-colors">
                <Avatar className="w-8 h-8 shadow-md border border-border/50">
                  <AvatarImage src={clientData?.avatar_url} />
                  <AvatarFallback className="bg-gradient-to-br from-primary to-secondary text-primary-foreground text-sm font-semibold">
                    {clientData?.name ? getClientInitials(clientData.name) : 'U'}
                  </AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuItem onClick={() => setEditProfileOpen(true)}>
                <Edit className="mr-2 h-4 w-4" />
                Editar Perfil
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setConfigureLogoOpen(true)}>
                <Smartphone className="mr-2 h-4 w-4" />
                Configurar Logo
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-red-600">
                <LogOut className="mr-2 h-4 w-4" />
                Sair
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {clientData && (
        <>
          <EditProfileModal
            open={editProfileOpen}
            onOpenChange={setEditProfileOpen}
            client={clientData}
            onUpdate={setClientData}
          />
          <ConfigureLogoModal
            open={configureLogoOpen}
            onOpenChange={setConfigureLogoOpen}
            client={clientData}
            onUpdate={setClientData}
          />
        </>
      )}
    </header>
  );
}

export default ClientHeader;