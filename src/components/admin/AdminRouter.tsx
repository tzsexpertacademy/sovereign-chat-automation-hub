
import { Routes, Route, Navigate } from "react-router-dom";
import AdminOverview from "./AdminOverview";
import ClientsManagement from "./ClientsManagement";
import InstancesManager from "./InstancesManager";
import { PlansManagement } from "./PlansManagementModern";
import ServerManagement from "./ServerManagement";
import YumerV2Diagnostic from "./YumerV2Diagnostic";
import SystemLogs from "./SystemLogs";
import AdvancedTools from "./AdvancedTools";

const AdminRouter = () => {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/admin/overview" replace />} />
      <Route path="/overview" element={<AdminOverview />} />
      <Route path="/clients" element={<ClientsManagement />} />
      <Route path="/instances" element={<InstancesManager />} />
      <Route path="/plans" element={<PlansManagement />} />
      <Route path="/server" element={<ServerManagement />} />
      <Route path="/server-config" element={<ServerManagement />} />
      <Route path="/server-config-v2" element={<ServerManagement />} />
      <Route path="/diagnostics" element={<YumerV2Diagnostic />} />
      <Route path="/logs" element={<SystemLogs />} />
      <Route path="/advanced" element={<AdvancedTools />} />
    </Routes>
  );
};

export default AdminRouter;
