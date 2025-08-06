
import { Link, useLocation } from "react-router-dom";
import { useState, useEffect } from "react";
import { 
  Sidebar, 
  SidebarContent, 
  SidebarHeader, 
  SidebarMenu, 
  SidebarMenuItem, 
  SidebarMenuButton,
  SidebarFooter
} from "@/components/ui/sidebar";
import { 
  MessageSquare, 
  BarChart3, 
  Users, 
  Bot, 
  Wifi, 
  Calendar,
  Workflow,
  Settings,
  TrendingUp,
  Palette,
  Building2,
  Layers3,
  UserCheck,
  Target,
  Home,
  Zap,
  Circle
} from "lucide-react";
import { cn } from "@/lib/utils";
import { clientsService, ClientData } from "@/services/clientsService";

interface ClientSidebarProps {
  clientId: string;
}

const ClientSidebar = ({ clientId }: ClientSidebarProps) => {
  const location = useLocation();
  const [clientData, setClientData] = useState<ClientData | null>(null);

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
  
  const menuItems = [
    { 
      title: "Dashboard", 
      icon: Home, 
      path: `/client/${clientId}/dashboard`,
      description: "Visão Geral"
    },
    { 
      title: "Tickets", 
      icon: UserCheck, 
      path: `/client/${clientId}/tickets`,
      description: "Gestão de Tickets"
    },
    { 
      title: "Conversas", 
      icon: MessageSquare, 
      path: `/client/${clientId}/chat`,
      description: "Interface de Chat"
    },
    { 
      title: "Funil", 
      icon: TrendingUp, 
      path: `/client/${clientId}/funnel`,
      description: "Kanban de Leads"
    },
    { 
      title: "Assistentes", 
      icon: Bot, 
      path: `/client/${clientId}/assistants`,
      description: "IA Assistentes"
    },
    { 
      title: "Filas", 
      icon: Layers3, 
      path: `/client/${clientId}/queues`,
      description: "Gerenciar Filas"
    },
    { 
      title: "Campanhas", 
      icon: Target, 
      path: `/client/${clientId}/campaigns`,
      description: "Marketing Auto"
    },
    { 
      title: "Agendamentos", 
      icon: Calendar, 
      path: `/client/${clientId}/booking`,
      description: "Calendário"
    },
    { 
      title: "Personalização", 
      icon: Palette, 
      path: `/client/${clientId}/personalization`,
      description: "Solicitações"
    },
    { 
      title: "Configurações", 
      icon: Settings, 
      path: `/client/${clientId}/settings`,
      description: "Preferências"
    }
  ];

  return (
    <Sidebar className="border-r bg-gradient-to-b from-background to-muted/30 backdrop-blur-sm shadow-lg">
      <SidebarHeader className="border-b border-border/50 p-6 bg-gradient-to-r from-primary/5 to-secondary/5">
        <div className="flex items-center space-x-3">
          <div className="relative">
            <div className="w-10 h-10 bg-gradient-to-br from-primary via-primary/80 to-secondary rounded-xl flex items-center justify-center shadow-lg border border-primary/20">
              <Building2 className="w-5 h-5 text-primary-foreground" />
            </div>
            <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-green-500 rounded-full border-2 border-background shadow-sm animate-pulse" />
          </div>
          <div className="flex-1">
            <h2 className="font-bold text-lg bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
              YumerFlow CRM
            </h2>
            <p className="text-xs text-muted-foreground font-medium">
              {clientData?.name || `Cliente: ${clientId.slice(0, 8)}`}
            </p>
          </div>
        </div>
      </SidebarHeader>
      
      <SidebarContent className="p-3 space-y-1">
        <SidebarMenu>
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            
            return (
              <SidebarMenuItem key={item.path}>
                <SidebarMenuButton
                  asChild
                  className={cn(
                    "group relative w-full justify-start p-3 mb-1 rounded-xl transition-all duration-200",
                    isActive 
                      ? 'bg-gradient-to-r from-primary/10 to-secondary/10 text-primary border-l-4 border-primary shadow-lg backdrop-blur-sm' 
                      : 'hover:bg-muted/30'
                  )}
                >
                  <Link to={item.path}>
                    <div className="flex items-center space-x-3">
                      <div className={cn(
                        "p-2 rounded-lg transition-all duration-300",
                        isActive 
                          ? 'bg-gradient-to-br from-primary to-secondary text-primary-foreground shadow-md' 
                          : 'bg-muted/50 text-muted-foreground group-hover:bg-muted group-hover:text-foreground'
                      )}>
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="flex flex-col items-start">
                        <span className={cn(
                          "font-semibold text-sm transition-colors",
                          isActive ? 'text-primary' : 'text-foreground group-hover:text-foreground'
                        )}>
                          {item.title}
                        </span>
                        <span className="text-xs text-muted-foreground group-hover:text-muted-foreground/80">
                          {item.description}
                        </span>
                      </div>
                    </div>
                    {isActive && (
                      <div className="absolute right-2 top-1/2 -translate-y-1/2">
                        <Circle className="w-2 h-2 fill-primary text-primary animate-pulse" />
                      </div>
                    )}
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
      </SidebarContent>
      
      <SidebarFooter className="border-t border-border/50 p-4 bg-gradient-to-r from-muted/20 to-muted/10">
        <div className="text-center space-y-1">
          <div className="bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
            <p className="text-sm font-bold">CRM YumerFlow V2</p>
          </div>
          <p className="text-xs text-muted-foreground font-medium">Powered By Yumer</p>
          <p className="text-xs text-muted-foreground/70">CEO: Thalis Zulianello</p>
          <p className="text-xs text-muted-foreground/60 font-mono">@yumer.ai</p>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
};

export default ClientSidebar;
