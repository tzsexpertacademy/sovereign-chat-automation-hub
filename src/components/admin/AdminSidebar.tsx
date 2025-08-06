
import { BarChart3, Users, Activity, FileText, Settings, Shield, TestTube, Server, CreditCard, Wrench, RotateCcw, Music, Volume2, Palette } from "lucide-react";
import { NavLink, useLocation } from "react-router-dom";

const adminItems = [
  { title: "Overview", url: "/admin/overview", icon: BarChart3 },
  { title: "Clientes", url: "/admin/clients", icon: Users },
  { title: "Instâncias", url: "/admin/instances", icon: Activity },
  { title: "Planos", url: "/admin/plans", icon: CreditCard },
  { title: "Servidor", url: "/admin/server", icon: Server },
  { title: "Sistema Logs", url: "/admin/logs", icon: FileText },
  { title: "Api Codechat", url: "/admin/diagnostics", icon: TestTube },
  { title: "Corrigir Tickets", url: "/admin/fix-tickets", icon: RotateCcw },
  { title: "Monitor de Áudio", url: "/admin/audio-monitor", icon: Volume2 },
  { title: "Diagnóstico Áudio", url: "/admin/audio-diagnostics", icon: Music },
  { title: "Personalizações", url: "/admin/personalization", icon: Palette },
  { title: "Em Desenvolvimento", url: "/admin/advanced", icon: Wrench },
];

const AdminSidebar = () => {
  const location = useLocation();
  const currentPath = location.pathname;

  const isActive = (path: string) => currentPath === path;

  return (
    <div className="w-64 bg-white border-r border-gray-200 flex flex-col h-full">
      {/* Logo/Header */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 bg-gradient-to-r from-blue-600 to-blue-500 rounded-lg flex items-center justify-center">
            <Shield className="w-5 h-5 text-white" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-bold text-gray-900 truncate">Admin Panel</h2>
            <p className="text-sm text-gray-500 truncate">YumerFlow</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex-1 px-3 py-4">
        <div className="mb-4">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider px-3 mb-3">
            Administração
          </h3>
          <nav className="space-y-1">
            {adminItems.map((item) => (
              <NavLink
                key={item.title}
                to={item.url}
                className={({ isActive }) =>
                  `flex items-center px-3 py-2 rounded-lg text-sm transition-colors ${
                    isActive
                      ? "bg-blue-50 text-blue-700 font-medium border-r-2 border-blue-700"
                      : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
                  }`
                }
              >
                <item.icon className="h-5 w-5 mr-3 flex-shrink-0" />
                <span className="truncate">{item.title}</span>
              </NavLink>
            ))}
          </nav>
        </div>
      </div>
    </div>
  );
};

export default AdminSidebar;
