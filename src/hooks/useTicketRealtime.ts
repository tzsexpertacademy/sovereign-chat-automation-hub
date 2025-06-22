
import { useTicketSystem } from './useTicketSystem';

// Manter compatibilidade com o código existente
export const useTicketRealtime = (clientId: string) => {
  const { tickets, isLoading, reloadTickets, debugSystem } = useTicketSystem(clientId);

  return {
    tickets,
    isLoading,
    isTyping: false, // Removido por simplicidade
    isOnline: true,  // Removido por simplicidade
    reloadTickets,
    debugMessages: debugSystem
  };
};
