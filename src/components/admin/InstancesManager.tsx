
import CodeChatV2BusinessManager from "./CodeChatV2BusinessManager";

const InstancesManager = () => {
  // Por enquanto, usar um clientId fixo para desenvolvimento
  // Em produção, isso viria do contexto de autenticação
  const defaultClientId = "35f36a03-39b2-412c-bba6-01fdd45c2dd3";
  
  return <CodeChatV2BusinessManager clientId={defaultClientId} />;
};

export default InstancesManager;
