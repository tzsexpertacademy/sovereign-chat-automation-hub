
import { useState } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { SidebarProvider } from "@/components/ui/sidebar";
import AdminSidebar from "@/components/admin/AdminSidebar";
import AdminHeader from "@/components/admin/AdminHeader";
import AdminOverview from "@/components/admin/AdminOverview";
import ClientsManagement from "@/components/admin/ClientsManagement";
import InstancesMonitor from "@/components/admin/InstancesMonitor";
import SystemLogsImproved from "@/components/admin/SystemLogsImproved";
import WebSocketStatusDebugSimplified from "@/components/admin/WebSocketStatusDebugSimplified";
import YumerApiKeyConfig from "@/components/admin/YumerApiKeyConfig";
import ConnectionDiagnostics from "@/components/admin/ConnectionDiagnostics";
import ServerConfiguration from "@/components/admin/ServerConfiguration";

const AdminDashboard = () => {
  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-gray-50">
        <AdminSidebar />
        <div className="flex-1 flex flex-col">
          <AdminHeader />
          <main className="flex-1 p-6">
            <Routes>
              <Route path="/" element={<Navigate to="overview" replace />} />
              <Route path="overview" element={<div className="space-y-6"><YumerApiKeyConfig /><AdminOverview /></div>} />
              <Route path="clients" element={<ClientsManagement />} />
              <Route path="instances" element={<InstancesMonitor />} />
              <Route path="server-config" element={<ServerConfiguration />} />
              <Route path="diagnostics" element={<ConnectionDiagnostics />} />
              <Route path="logs" element={<SystemLogsImproved />} />
              <Route path="websocket" element={<WebSocketStatusDebugSimplified />} />
            </Routes>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
};

export default AdminDashboard;
