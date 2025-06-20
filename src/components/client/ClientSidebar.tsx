
import { Home, MessageSquare, Bot, Calendar, Megaphone, Settings, Zap, BarChart3, Phone } from "lucide-react";
import { useParams, useLocation } from "react-router-dom";
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

const ClientSidebar = () => {
  const { clientId } = useParams();
  const location = useLocation();

  const menuItems = [
    {
      title: "Conexão WhatsApp",
      url: `/client/${clientId}/connect`,
      icon: Phone,
    },
    {
      title: "Chat Interface",
      url: `/client/${clientId}/chat`,
      icon: MessageSquare,
    },
    {
      title: "Assistentes IA",
      url: `/client/${clientId}/assistants`,
      icon: Bot,
    },
    {
      title: "Sistema de Agendamento",
      url: `/client/${clientId}/booking`,
      icon: Calendar,
    },
    {
      title: "Campanhas",
      url: `/client/${clientId}/campaigns`,
      icon: Megaphone,
    },
    {
      title: "Automação",
      url: `/client/${clientId}/automation`,
      icon: Zap,
    },
    {
      title: "Analytics",
      url: `/client/${clientId}/analytics`,
      icon: BarChart3,
    },
  ];

  return (
    <Sidebar>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Dashboard</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild isActive={location.pathname === item.url}>
                    <a href={item.url}>
                      <item.icon />
                      <span>{item.title}</span>
                    </a>
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
