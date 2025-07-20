import { Routes, Route } from "react-router-dom";
import AdminHeader from "@/components/admin/AdminHeader";
import AdminSidebar from "@/components/admin/AdminSidebar";
import AdminOverview from "@/components/admin/AdminOverview";
import ClientsManagement from "@/components/admin/ClientsManagement";
import InstancesMonitorClean from "@/components/admin/InstancesMonitorClean";
import SettingsManagement from "@/components/admin/SettingsManagement";
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";

const AdminDashboard = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();

  useEffect(() => {
    if (!user) {
      toast({
        title: "Acesso Restrito",
        description: "Você precisa estar logado para acessar o painel administrativo.",
      });
      navigate("/login");
    }
  }, [user, navigate, toast]);

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <AdminHeader />
      <div className="flex">
        <AdminSidebar />
        <main className="flex-1 p-6">
          <Routes>
            <Route index element={<AdminOverview />} />
            <Route path="clients" element={<ClientsManagement />} />
            <Route path="instances" element={<InstancesMonitorClean />} />
            <Route path="settings" element={<SettingsManagement />} />
          </Routes>
        </main>
      </div>
    </div>
  );
};

export default AdminDashboard;
