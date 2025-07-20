
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
  Zap,
  Building2,
  Layers3,
  UserCheck
} from "lucide-react";
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
      title: "Conexão", 
      icon: Wifi, 
      path: `/client/${clientId}/connect`,
      description: "Conectar WhatsApp"
    },
    { 
      title: "Conversas", 
      icon: MessageSquare, 
      path: `/client/${clientId}/chat`,
      description: "Tickets e Chat"
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
      title: "Instâncias", 
      icon: Building2, 
      path: `/client/${clientId}/instances`,
      description: "Multi-WhatsApp"
    },
    { 
      title: "Agendamentos", 
      icon: Calendar, 
      path: `/client/${clientId}/booking`,
      description: "Calendário"
    },
    { 
      title: "Automação", 
      icon: Zap, 
      path: `/client/${clientId}/automation`,
      description: "Fluxos"
    },
    { 
      title: "Analytics", 
      icon: BarChart3, 
      path: `/client/${clientId}/analytics`,
      description: "Relatórios"
    },
    { 
      title: "Configurações", 
      icon: Settings, 
      path: `/client/${clientId}/settings`,
      description: "Preferências"
    }
  ];

  return (
    <Sidebar className="border-r bg-white">
      <SidebarHeader className="border-b p-6">
        <div className="flex items-center space-x-2">
          <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
            <UserCheck className="w-4 h-4 text-white" />
          </div>
          <div>
            <h2 className="font-semibold text-gray-900">YumerFlow</h2>
            <p className="text-xs text-gray-500">{clientData?.name || `Cliente: ${clientId.slice(0, 8)}`}</p>
          </div>
        </div>
      </SidebarHeader>
      
      <SidebarContent className="p-4">
        <SidebarMenu>
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            
            return (
              <SidebarMenuItem key={item.path}>
                <SidebarMenuButton
                  asChild
                  className={`w-full justify-start p-3 mb-1 ${
                    isActive 
                      ? 'bg-blue-50 text-blue-700 border-r-2 border-blue-700' 
                      : 'hover:bg-gray-50'
                  }`}
                >
                  <Link to={item.path}>
                    <Icon className={`mr-3 h-4 w-4 ${isActive ? 'text-blue-700' : 'text-gray-500'}`} />
                    <div className="flex flex-col items-start">
                      <span className="font-medium">{item.title}</span>
                      <span className="text-xs text-gray-500">{item.description}</span>
                    </div>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
      </SidebarContent>
      
      <SidebarFooter className="border-t p-4">
        <div className="text-center">
          <p className="text-xs text-gray-500">CRM v2.0</p>
          <p className="text-xs text-gray-400">Powered by AI</p>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
};

export default ClientSidebar;
