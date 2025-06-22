import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import {
  MessageSquare,
  Users,
  Download,
  RefreshCw,
  Search
} from "lucide-react";
import TicketCard from "./TicketCard";
import TicketChatInterface from "./TicketChatInterface";
import ContactsManager from "./ContactsManager";
import { useTicketRealtime } from "@/hooks/useTicketRealtime";
import { ticketsService } from "@/services/ticketsService";

interface TicketsInterfaceProps {
  clientId: string;
}

const TicketsInterface = ({ clientId }: TicketsInterfaceProps) => {
  const { toast } = useToast();
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'conversations' | 'contacts'>('conversations');
  const [isImporting, setIsImporting] = useState(false);
  
  // Hook para tickets em tempo real
  const { 
    tickets, 
    isLoading, 
    isTyping, 
    isOnline, 
    reloadTickets,
    debugMessages 
  } = useTicketRealtime(clientId);

  const handleTicketAction = (action: string, ticketId: string) => {
    console.log(`Ação ${action} no ticket ${ticketId}`);
    toast({
      title: "Ação realizada",
      description: `Você ${action} o ticket ${ticketId}`
    });
  };

  const handleImport = async () => {
    setIsImporting(true);
    try {
      const result = await ticketsService.importConversationsFromWhatsApp(clientId);
      toast({
        title: "Importação concluída",
        description: result.message
      });
    } catch (error: any) {
      toast({
        title: "Erro ao importar",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setIsImporting(false);
    }
  };

  const handleDebugMessages = () => {
    debugMessages();
    toast({
      title: "Debug executado",
      description: "Verifique o console para logs detalhados das mensagens"
    });
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header com status e controles */}
      <div className="border-b p-4 bg-white">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-4">
            <h2 className="text-lg font-semibold">Conversas</h2>
            <div className="flex items-center space-x-2">
              <div className={`w-2 h-2 rounded-full ${isOnline ? 'bg-green-500' : 'bg-red-500'}`}></div>
              <span className="text-sm text-gray-600">
                {isOnline ? 'Online' : 'Offline'}
              </span>
            </div>
            {isTyping && (
              <div className="flex items-center space-x-1 text-blue-500">
                <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                <span className="text-xs">Assistente digitando...</span>
              </div>
            )}
          </div>
          
          <div className="flex space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleDebugMessages}
              className="text-orange-600 border-orange-600 hover:bg-orange-50"
            >
              <Search className="w-4 h-4 mr-1" />
              Debug
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleImport}
              disabled={isImporting}
              className="text-blue-600 border-blue-600 hover:bg-blue-50"
            >
              {isImporting ? (
                <RefreshCw className="w-4 h-4 mr-1 animate-spin" />
              ) : (
                <Download className="w-4 h-4 mr-1" />
              )}
              {isImporting ? 'Importando...' : 'Importar'}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={reloadTickets}
              disabled={isLoading}
            >
              {isLoading ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4" />
              )}
            </Button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex space-x-1 bg-gray-100 p-1 rounded-lg">
          <button
            onClick={() => setActiveTab('conversations')}
            className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
              activeTab === 'conversations'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <MessageSquare className="w-4 h-4 inline mr-2" />
            Conversas ({tickets.length})
          </button>
          <button
            onClick={() => setActiveTab('contacts')}
            className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
              activeTab === 'contacts'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <Users className="w-4 h-4 inline mr-2" />
            Contatos
          </button>
        </div>
      </div>

      {/* Conteúdo das tabs */}
      <div className="flex-1 flex overflow-hidden">
        {activeTab === 'conversations' ? (
          <>
            {/* Lista de tickets/conversas */}
            <div className="w-1/3 border-r bg-gray-50 overflow-hidden flex flex-col">
              <ScrollArea className="flex-1">
                <div className="p-2">
                  {isLoading && tickets.length === 0 ? (
                    <div className="space-y-3">
                      {[...Array(5)].map((_, i) => (
                        <div key={i} className="p-3 bg-white rounded-lg">
                          <div className="flex items-center space-x-3">
                            <Skeleton className="h-10 w-10 rounded-full" />
                            <div className="flex-1">
                              <Skeleton className="h-4 w-3/4 mb-2" />
                              <Skeleton className="h-3 w-1/2" />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : tickets.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      <MessageSquare className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                      <p className="text-sm font-medium mb-2">Nenhuma conversa</p>
                      <p className="text-xs">
                        As conversas aparecerão aqui quando chegarem mensagens
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {tickets.map((ticket) => (
                        <TicketCard
                          key={ticket.id}
                          ticket={ticket}
                          isSelected={selectedTicketId === ticket.id}
                          onClick={() => setSelectedTicketId(ticket.id)}
                          onAction={handleTicketAction}
                        />
                      ))}
                    </div>
                  )}
                </div>
              </ScrollArea>
            </div>

            {/* Interface de chat */}
            <div className="flex-1 flex flex-col overflow-hidden">
              {selectedTicketId ? (
                <TicketChatInterface 
                  clientId={clientId}
                  ticketId={selectedTicketId}
                />
              ) : (
                <div className="flex-1 flex items-center justify-center bg-gray-50">
                  <div className="text-center text-gray-500">
                    <MessageSquare className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                    <h3 className="text-lg font-medium mb-2">Selecione uma conversa</h3>
                    <p className="text-sm">
                      Escolha uma conversa da lista para visualizar e responder mensagens
                    </p>
                  </div>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="flex-1">
            <ContactsManager clientId={clientId} />
          </div>
        )}
      </div>
    </div>
  );
};

interface TicketCardProps {
  ticket: any;
  isSelected: boolean;
  onClick: () => void;
  onAction: (action: string, ticketId: string) => void;
}

const TicketCardComponent = ({
  ticket,
  isSelected,
  onClick,
  onAction
}: TicketCardProps) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const handleAction = (action: string) => {
    onAction(action, ticket.id);
    setIsMenuOpen(false);
  };

  const getDisplayName = (ticket: any) => {
    if (ticket.customer?.name && 
        ticket.customer.name !== `Contato ${ticket.customer.phone}` &&
        !ticket.customer.name.startsWith('Contato ')) {
      return ticket.customer.name;
    }
    
    if (ticket.title && ticket.title.includes('Conversa com ')) {
      const nameFromTitle = ticket.title.replace('Conversa com ', '').trim();
      if (nameFromTitle && 
          !nameFromTitle.startsWith('Contato ') && 
          nameFromTitle !== ticket.customer?.phone) {
        return nameFromTitle;
      }
    }
    
    const phone = ticket.customer?.phone || ticket.chat_id;
    if (phone) {
      const cleanPhone = phone.replace(/\D/g, '');
      if (cleanPhone.length >= 10) {
        const formattedPhone = cleanPhone.replace(/(\d{2})(\d{4,5})(\d{4})/, '($1) $2-$3');
        return formattedPhone;
      }
    }
    
    return 'Contato sem nome';
  };

  return (
    <Card
      className={`p-3 rounded-lg cursor-pointer transition-colors ${
        isSelected ? 'bg-blue-50 text-blue-900' : 'bg-white hover:bg-gray-50'
      }`}
      onClick={onClick}
    >
      <div className="flex items-center space-x-3">
        <div className="relative">
          <div className="h-10 w-10 rounded-full bg-gray-200 flex items-center justify-center overflow-hidden">
            {ticket.customer?.name ? (
              <span className="text-sm font-semibold">{ticket.customer.name.charAt(0).toUpperCase()}</span>
            ) : (
              <MessageSquare className="w-5 h-5 text-gray-400" />
            )}
          </div>
          {ticket.status === 'open' && (
            <span className="absolute top-0 right-0 w-3 h-3 bg-green-500 rounded-full border border-white"></span>
          )}
        </div>
        <div className="flex-1">
          <div className="flex items-center justify-between">
            <div className="text-sm font-medium">{getDisplayName(ticket)}</div>
            <div className="text-xs text-gray-500">
              {new Date(ticket.last_message_at).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit'
              })}
            </div>
          </div>
          <p className="text-xs text-gray-600 truncate">{ticket.last_message_preview}</p>
        </div>
      </div>
    </Card>
  );
};

const TicketCard = TicketCardComponent;

export default TicketsInterface;
