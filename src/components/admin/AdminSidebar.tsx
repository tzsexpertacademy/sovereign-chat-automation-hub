
import { 
  LayoutDashboard, 
  Users, 
  Smartphone, 
  Activity, 
  FileText, 
  Settings,
  Database
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface AdminSidebarProps {
  currentView: string;
  onViewChange: (view: string) => void;
}

const AdminSidebar = ({ currentView, onViewChange }: AdminSidebarProps) => {
  const menuItems = [
    { id: "overview", label: "Visão Geral", icon: LayoutDashboard },
    { id: "clients", label: "Clientes", icon: Users },
    { id: "client-instances", label: "Instâncias por Cliente", icon: Database },
    { id: "instances", label: "Monitor Instâncias", icon: Smartphone },
    { id: "status", label: "Status Sistema", icon: Activity },
    { id: "logs", label: "Logs", icon: FileText },
  ];

  return (
    <div className="w-64 bg-white shadow-lg">
      <div className="p-6">
        <h2 className="text-xl font-bold text-gray-900">Admin Panel</h2>
        <p className="text-sm text-gray-600">Sistema de Gerenciamento</p>
      </div>
      
      <nav className="px-4 pb-4">
        <ul className="space-y-2">
          {menuItems.map((item) => {
            const Icon = item.icon;
            return (
              <li key={item.id}>
                <Button
                  variant={currentView === item.id ? "default" : "ghost"}
                  className={`w-full justify-start ${
                    currentView === item.id 
                      ? "bg-blue-600 text-white hover:bg-blue-700" 
                      : "text-gray-700 hover:bg-gray-100"
                  }`}
                  onClick={() => onViewChange(item.id)}
                >
                  <Icon className="w-4 h-4 mr-3" />
                  {item.label}
                </Button>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
};

export default AdminSidebar;
