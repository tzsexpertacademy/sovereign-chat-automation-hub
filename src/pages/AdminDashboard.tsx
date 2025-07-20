
import { useState } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { SidebarProvider } from "@/components/ui/sidebar";
import AdminSidebar from "@/components/admin/AdminSidebar";
import AdminHeader from "@/components/admin/AdminHeader";
import AdminOverview from "@/components/admin/AdminOverview";
import ClientsManagement from "@/components/admin/ClientsManagement";
import InstancesMonitor from "@/components/admin/InstancesMonitor";
import SystemLogsModern from "@/components/admin/SystemLogsModern";
import AdvancedTools from "@/components/admin/AdvancedTools";
import YumerApiKeyConfig from "@/components/admin/YumerApiKeyConfig";
import ConnectionDiagnostics from "@/components/admin/ConnectionDiagnostics";
import ServerConfiguration from "@/components/admin/ServerConfiguration";

const AdminDashboard = () => {
  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-gradient-to-br from-slate-50 to-slate-100">
        <AdminSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <AdminHeader />
          <main className="flex-1 p-3 sm:p-4 lg:p-6 overflow-x-auto">
            <Routes>
              <Route path="/" element={<Navigate to="overview" replace />} />
              <Route path="overview" element={<AdminOverview />} />
              <Route path="clients" element={<ClientsManagement />} />
              <Route path="instances" element={<InstancesMonitor />} />
              <Route path="server-config" element={<ServerConfiguration />} />
              <Route path="diagnostics" element={<ConnectionDiagnostics />} />
              <Route path="logs" element={<SystemLogsModern />} />
              <Route path="advanced" element={<AdvancedTools />} />
            </Routes>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
};

export default AdminDashboard;
