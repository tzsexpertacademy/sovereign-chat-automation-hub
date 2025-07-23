
import { useState } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { SidebarProvider } from "@/components/ui/sidebar";
import AdminSidebar from "@/components/admin/AdminSidebar";
import AdminHeader from "@/components/admin/AdminHeader";
import AdminOverview from "@/components/admin/AdminOverview";
import ClientsManagement from "@/components/admin/ClientsManagement";
import PlansManagement from "@/components/admin/PlansManagement";
import SystemLogsModern from "@/components/admin/SystemLogsModern";
import { YumerApiManager } from "@/components/admin/YumerApiManager";

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
              <Route path="api" element={<YumerApiManager />} />
              <Route path="plans" element={<PlansManagement />} />
              <Route path="logs" element={<SystemLogsModern />} />
            </Routes>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
};

export default AdminDashboard;
