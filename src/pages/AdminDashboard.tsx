
import { Outlet, useLocation } from "react-router-dom";
import { SidebarProvider } from "@/components/ui/sidebar";
import AdminSidebar from "@/components/admin/AdminSidebar";
import AdminHeader from "@/components/admin/AdminHeader";

const AdminDashboard = () => {
  const location = useLocation();

  const getPageTitle = () => {
    switch (location.pathname) {
      case '/admin':
        return 'Painel Administrativo';
      case '/admin/clients':
        return 'Gerenciar Clientes';
      case '/admin/instances':
        return 'Gerenciar Instâncias';
      case '/admin/server-config':
        return 'Configuração do Servidor';
      default:
        return 'Administração';
    }
  };

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-gray-50">
        <AdminSidebar />
        <div className="flex-1 flex flex-col">
          <AdminHeader />
          <main className="flex-1 p-6 overflow-auto">
            <Outlet />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
};

export default AdminDashboard;
