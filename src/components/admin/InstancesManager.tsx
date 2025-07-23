
import CodeChatV2UltimateManager from "./CodeChatV2UltimateManager";

const InstancesManager = () => {
  // Por enquanto, usar um clientId fixo para desenvolvimento
  // Em produção, isso viria do contexto de autenticação
  const defaultClientId = "35f36a03-39b2-412c-bba6-01fdd45c2dd3";
  
  return <CodeChatV2UltimateManager clientId={defaultClientId} />;
};

export default InstancesManager;
