import { Routes, Route } from "react-router-dom";
import AdminHeader from "@/components/admin/AdminHeader";
import AdminSidebar from "@/components/admin/AdminSidebar";
import AdminOverview from "@/components/admin/AdminOverview";
import ClientsManagement from "@/components/admin/ClientsManagement";
import InstancesMonitorClean from "@/components/admin/InstancesMonitorClean";
import { SidebarProvider } from "@/components/ui/sidebar";

const AdminDashboard = () => {
  return (
    <SidebarProvider>
      <div className="min-h-screen bg-background w-full">
        <AdminHeader />
        <div className="flex">
          <AdminSidebar />
          <main className="flex-1 p-6">
            <Routes>
              <Route index element={<AdminOverview />} />
              <Route path="clients" element={<ClientsManagement />} />
              <Route path="instances" element={<InstancesMonitorClean />} />
            </Routes>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
};

export default AdminDashboard;
