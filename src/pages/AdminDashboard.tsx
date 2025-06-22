
import { useState } from "react";
import AdminSidebar from "@/components/admin/AdminSidebar";
import AdminHeader from "@/components/admin/AdminHeader";
import AdminOverview from "@/components/admin/AdminOverview";
import ClientsManagement from "@/components/admin/ClientsManagement";
import ClientInstancesManager from "@/components/admin/ClientInstancesManager";
import InstancesMonitor from "@/components/admin/InstancesMonitor";
import SystemLogs from "@/components/admin/SystemLogs";
import WhatsAppSystemStatus from "@/components/admin/WhatsAppSystemStatus";

const AdminDashboard = () => {
  const [currentView, setCurrentView] = useState("overview");

  const renderCurrentView = () => {
    switch (currentView) {
      case "overview":
        return <AdminOverview />;
      case "clients":
        return <ClientsManagement onShowInstancesManager={() => setCurrentView("client-instances")} />;
      case "client-instances":
        return <ClientInstancesManager />;
      case "instances":
        return <InstancesMonitor />;
      case "logs":
        return <SystemLogs />;
      case "status":
        return <WhatsAppSystemStatus />;
      default:
        return <AdminOverview />;
    }
  };

  return (
    <div className="flex h-screen bg-gray-50">
      <AdminSidebar currentView={currentView} onViewChange={setCurrentView} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <AdminHeader />
        <main className="flex-1 overflow-auto p-6">
          {renderCurrentView()}
        </main>
      </div>
    </div>
  );
};

export default AdminDashboard;
