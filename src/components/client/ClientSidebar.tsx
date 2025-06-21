
import { Link, useLocation } from "react-router-dom";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import {
  MessageSquare,
  TicketIcon,
  Workflow,
  Bot,
  Users,
  Layers,
  Calendar,
  Zap,
  BarChart3,
  Settings,
  Wifi,
} from "lucide-react";

interface ClientSidebarProps {
  clientId: string;
}

const ClientSidebar = ({ clientId }: ClientSidebarProps) => {
  const location = useLocation();

  const menuItems = [
    {
      title: "Conexão",
      icon: Wifi,
      url: `/client/${clientId}/connect`,
      description: "Conectar WhatsApp"
    },
    {
      title: "Conversas",
      icon: MessageSquare,
      url: `/client/${clientId}/chat`,
      description: "Chat WhatsApp"
    },
    {
      title: "Tickets",
      icon: TicketIcon,
      url: `/client/${clientId}/tickets`,
      description: "Sistema de Atendimento"
    },
    {
      title: "Funil",
      icon: Workflow,
      url: `/client/${clientId}/funnel`,
      description: "Kanban de Leads"
    },
    {
      title: "Assistentes",
      icon: Bot,
      url: `/client/${clientId}/assistants`,
      description: "IA Assistentes"
    },
    {
      title: "Filas",
      icon: Users,
      url: `/client/${clientId}/queues`,
      description: "Gerenciar Filas"
    },
    {
      title: "Instâncias",
      icon: Layers,
      url: `/client/${clientId}/instances`,
      description: "Multi-WhatsApp"
    },
    {
      title: "Agendamentos",
      icon: Calendar,
      url: `/client/${clientId}/booking`,
      description: "Calendário"
    },
    {
      title: "Automação",
      icon: Zap,
      url: `/client/${clientId}/automation`,
      description: "Fluxos"
    },
    {
      title: "Analytics",
      icon: BarChart3,
      url: `/client/${clientId}/analytics`,
      description: "Métricas"
    },
    {
      title: "Configurações",
      icon: Settings,
      url: `/client/${clientId}/settings`,
      description: "Settings"
    },
  ];

  return (
    <Sidebar>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>CRM Dashboard</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton 
                    asChild 
                    isActive={location.pathname === item.url}
                    tooltip={item.description}
                  >
                    <Link to={item.url}>
                      <item.icon className="w-4 h-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
};

export default ClientSidebar;
