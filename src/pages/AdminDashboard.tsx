
import { Outlet } from "react-router-dom";
import AdminHeader from "@/components/admin/AdminHeader";
import AdminSidebar from "@/components/admin/AdminSidebar";
import AdminRouter from "@/components/admin/AdminRouter";
import SafeComponent from "@/components/SafeComponent";
import { QuickApiTest } from "@/components/admin/QuickApiTest";

const AdminDashboard = () => {
  return (
    <div className="min-h-screen flex w-full bg-gray-50">
      <AdminSidebar />
      
      <div className="flex-1 flex flex-col">
        <AdminHeader />
        
        <main className="flex-1 p-6 overflow-auto">
          <div className="max-w-7xl mx-auto">
            <div className="mb-8">
              <h1 className="text-3xl font-bold text-gray-900">Painel Administrativo</h1>
              <p className="text-gray-600 mt-2">
                Gerencie clientes, planos e monitore o sistema Yumer v2
              </p>
            </div>

            {/* Teste Rápido da API */}
            <div className="mb-6">
              <QuickApiTest />
            </div>

            <SafeComponent 
              fallbackTitle="Erro no Dashboard Admin"
              fallbackMessage="Houve um problema ao carregar o dashboard administrativo."
            >
              <AdminRouter />
            </SafeComponent>
          </div>
        </main>
      </div>
    </div>
  );
};

export default AdminDashboard;
