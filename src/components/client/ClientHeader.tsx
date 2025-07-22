
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Bell, 
  User, 
  Settings, 
  LogOut,
  Activity,
  Bot
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/components/ui/use-toast";
import AIConfigIndicator from "./AIConfigIndicator";

interface ClientHeaderProps {
  clientId: string;
  clientName?: string;
}

const ClientHeader = ({ clientId, clientName }: ClientHeaderProps) => {
  const [instancesCount, setInstancesCount] = useState(0);
  const [onlineInstances, setOnlineInstances] = useState(0);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    loadInstancesStats();
  }, [clientId]);

  const loadInstancesStats = async () => {
    try {
      const { data: instances, error } = await supabase
        .from('whatsapp_instances')
        .select('status')
        .eq('client_id', clientId);

      if (error) throw error;

      setInstancesCount(instances?.length || 0);
      setOnlineInstances(
        instances?.filter(i => i.status === 'connected' || i.status === 'online')?.length || 0
      );
    } catch (error) {
      console.error('❌ [CLIENT-HEADER] Erro ao carregar stats:', error);
    }
  };

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      navigate('/');
      toast({
        title: "Logout realizado",
        description: "Você foi desconectado com sucesso",
      });
    } catch (error) {
      console.error('❌ [CLIENT-HEADER] Erro no logout:', error);
      toast({
        title: "Erro no logout",
        description: "Erro ao realizar logout",
        variant: "destructive"
      });
    }
  };

  return (
    <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex h-16 items-center justify-between px-6">
        <div className="flex items-center gap-4">
          <div>
            <h1 className="text-xl font-semibold">{clientName || 'Dashboard'}</h1>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Activity className="h-3 w-3" />
              <span>{instancesCount} instância(s)</span>
              <span>•</span>
              <span className="text-green-600">{onlineInstances} online</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {/* AI Config Indicator */}
          <AIConfigIndicator clientId={clientId} compact />

          {/* User Menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="gap-2">
                <User className="h-4 w-4" />
                <span className="hidden md:inline">Conta</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <div className="px-2 py-1.5">
                <div className="text-sm font-medium">{clientName}</div>
                <div className="text-xs text-muted-foreground">Cliente</div>
              </div>
              <DropdownMenuSeparator />
              
              <DropdownMenuItem onClick={() => navigate('/client/assistants')}>
                <Bot className="mr-2 h-4 w-4" />
                Configurar IA
              </DropdownMenuItem>
              
              <DropdownMenuItem onClick={() => navigate('/client/settings')}>
                <Settings className="mr-2 h-4 w-4" />
                Configurações
              </DropdownMenuItem>
              
              <DropdownMenuSeparator />
              
              <DropdownMenuItem onClick={handleLogout} className="text-red-600">
                <LogOut className="mr-2 h-4 w-4" />
                Sair
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
};

export default ClientHeader;
