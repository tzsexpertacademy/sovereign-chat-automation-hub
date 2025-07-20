
import { BarChart3, Users, Activity, FileText, Settings, Shield, Wifi, Stethoscope, Server } from "lucide-react";
import { NavLink, useLocation } from "react-router-dom";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";

const adminItems = [
  { title: "Overview", url: "overview", icon: BarChart3 },
  { title: "Clientes", url: "clients", icon: Users },
  { title: "Instâncias", url: "instances", icon: Activity },
  { title: "Configuração Servidor", url: "server-config", icon: Server },
  { title: "Diagnóstico", url: "diagnostics", icon: Stethoscope },
  { title: "Logs", url: "logs", icon: FileText },
  { title: "Ferramentas Avançadas", url: "advanced", icon: Settings },
];

const AdminSidebar = () => {
  const { state } = useSidebar();
  const location = useLocation();
  const currentPath = location.pathname;
  const collapsed = state === "collapsed";

  const isActive = (path: string) => currentPath.endsWith(path);

  return (
    <Sidebar className={collapsed ? "w-14" : "w-64"} collapsible="icon">
      <SidebarContent className="bg-background border-r border-border">
        {/* Logo/Header */}
        <div className="p-3 lg:p-4 border-b border-border">
          <div className="flex items-center space-x-2 lg:space-x-3">
            <div className="w-7 h-7 lg:w-8 lg:h-8 bg-gradient-to-r from-primary to-primary/80 rounded-lg flex items-center justify-center">
              <Shield className="w-4 h-4 lg:w-5 lg:h-5 text-primary-foreground" />
            </div>
            {!collapsed && (
              <div className="min-w-0 flex-1">
                <h2 className="text-base lg:text-lg font-bold text-foreground truncate">Admin Panel</h2>
                <p className="text-xs lg:text-sm text-muted-foreground truncate">Sistema WhatsApp SaaS</p>
              </div>
            )}
          </div>
        </div>

        <SidebarGroup className="px-2">
          <SidebarGroupLabel className="text-xs text-muted-foreground px-2">Administração</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="space-y-1">
              {adminItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink 
                      to={item.url} 
                      className={({ isActive }) => 
                        `flex items-center px-3 py-2 rounded-lg text-sm transition-colors ${
                          isActive 
                            ? "bg-primary/10 text-primary font-medium" 
                            : "text-muted-foreground hover:text-foreground hover:bg-accent"
                        }`
                      }
                    >
                      <item.icon className={`h-4 w-4 ${collapsed ? '' : 'mr-3'} flex-shrink-0`} />
                      {!collapsed && <span className="truncate">{item.title}</span>}
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

export default AdminSidebar;
