// Redirecionamento para o ClientDashboard principal
import { useParams, Navigate } from "react-router-dom";

const ClientDashboardFixed = () => {
  const { clientId, tab } = useParams();
  
  // Redireciona para o dashboard principal
  return <Navigate to={`/client/${clientId}/${tab || 'overview'}`} replace />;
};

export default ClientDashboardFixed;