
import { Routes, Route, Navigate } from "react-router-dom";
import AdminOverview from "./AdminOverview";
import ClientsManagement from "./ClientsManagement";
import InstancesManager from "./InstancesManager";
import { PlansManagement } from "./PlansManagementModern";
import ServerManagement from "./ServerManagement";
import ApiCodechat from "./ApiCodechat";
import SystemLogsModern from "./SystemLogsModern";
import { SystemLogsClean } from "./SystemLogsClean";
import DevelopmentPlan from "./DevelopmentPlan";
import { FixTicketsAssignment } from "./FixTicketsAssignment";
import AudioDiagnostics from "./AudioDiagnostics";
import { AudioProcessingMonitor } from "./AudioProcessingMonitor";
import PersonalizationRequestsManager from "./PersonalizationRequestsManager";

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
      <Route path="/diagnostics" element={<ApiCodechat />} />
      <Route path="/logs" element={<SystemLogsClean />} />
      <Route path="/advanced" element={<DevelopmentPlan />} />
      <Route path="/fix-tickets" element={<FixTicketsAssignment />} />
      <Route path="/audio-diagnostics" element={<AudioDiagnostics />} />
      <Route path="/audio-monitor" element={<AudioProcessingMonitor />} />
      <Route path="/personalization" element={<PersonalizationRequestsManager />} />
    </Routes>
  );
};

export default AdminRouter;
