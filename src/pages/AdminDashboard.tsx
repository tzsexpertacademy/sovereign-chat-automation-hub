
import { Outlet } from "react-router-dom";
import AdminHeader from "@/components/admin/AdminHeader";
import AdminSidebar from "@/components/admin/AdminSidebar";
import AdminRouter from "@/components/admin/AdminRouter";
import SafeComponent from "@/components/SafeComponent";
import { QuickApiTest } from "@/components/admin/QuickApiTest";
import { QuickBusinessTokenRegenerator } from "@/components/admin/QuickBusinessTokenRegenerator";
import { ManualMessageTester } from "@/components/admin/ManualMessageTester";

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

            {/* Regenerador de Business Token */}
            <div className="mb-6">
              <SafeComponent 
                fallbackTitle="Erro no Regenerador"
                fallbackMessage="Problema ao carregar o regenerador de tokens."
              >
                <QuickBusinessTokenRegenerator />
              </SafeComponent>
            </div>

            {/* Testador Manual de Mensagens */}
            <div className="mb-6">
              <SafeComponent 
                fallbackTitle="Erro no Testador"
                fallbackMessage="Problema ao carregar o testador de mensagens."
              >
                <ManualMessageTester />
              </SafeComponent>
            </div>

            {/* Sistema Unificado de Mídia */}
            <div className="mb-6">
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  ✅ Sistema de Mídia Unificado
                </h3>
                <p className="text-gray-600 text-sm">
                  Fluxo: <code>process-received-media</code> → <code>process-media-analysis</code> → <code>process-message-batches</code>
                </p>
                <div className="mt-2 text-xs text-green-600">
                  • API directly-download para descriptografia<br/>
                  • GPT-4 Vision para análise de imagens<br/>
                  • Sem duplicidades ou conflitos
                </div>
              </div>
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
