
import { QrCode, MessageSquare, Megaphone, Bot, BarChart3, Settings } from "lucide-react";
import { NavLink, useLocation, useParams } from "react-router-dom";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";

const ClientSidebar = () => {
  const { state } = useSidebar();
  const location = useLocation();
  const { clientId } = useParams();
  const currentPath = location.pathname;
  const collapsed = state === "collapsed";

  const menuItems = [
    { title: "Conectar WhatsApp", url: `/client/${clientId}/connect`, icon: QrCode },
    { title: "Chat", url: `/client/${clientId}/chat`, icon: MessageSquare },
    { title: "Assistentes", url: `/client/${clientId}/assistants`, icon: Bot },
    { title: "Campanhas", url: `/client/${clientId}/campaigns`, icon: Megaphone },
    { title: "Automação", url: `/client/${clientId}/automation`, icon: Settings },
    { title: "Analytics", url: `/client/${clientId}/analytics`, icon: BarChart3 },
  ];

  const isActive = (path: string) => currentPath === path;
  const getNavCls = ({ isActive }: { isActive: boolean }) =>
    isActive ? "bg-green-100 text-green-700 font-medium" : "hover:bg-gray-100";

  return (
    <Sidebar className={collapsed ? "w-14" : "w-64"} collapsible="icon">
      <SidebarContent className="bg-white border-r">
        {/* Logo/Header */}
        <div className="p-4 border-b">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-gradient-to-r from-green-500 to-blue-500 rounded-lg flex items-center justify-center">
              <MessageSquare className="w-5 h-5 text-white" />
            </div>
            {!collapsed && (
              <div>
                <h2 className="text-lg font-bold text-gray-900">WhatsApp Pro</h2>
                <p className="text-sm text-gray-500">Cliente: {clientId}</p>
              </div>
            )}
          </div>
        </div>

        <SidebarGroup>
          <SidebarGroupLabel>Menu Principal</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink to={item.url} className={getNavCls}>
                      <item.icon className="mr-3 h-5 w-5" />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
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
