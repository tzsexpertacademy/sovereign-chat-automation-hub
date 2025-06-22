
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
  Search,
  AlertTriangle,
  Bug
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
    console.log('🔍 ===== INICIANDO DEBUG COMPLETO =====');
    debugMessages();
    toast({
      title: "🔍 Debug Executado",
      description: "Verifique o console do navegador para logs detalhados. Pressione F12 para abrir as ferramentas de desenvolvedor.",
      duration: 8000,
    });
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header principal com status e controles de debug */}
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
              className="text-red-600 border-red-600 hover:bg-red-50 font-medium"
            >
              <Bug className="w-4 h-4 mr-1" />
              🔍 DEBUG SISTEMA
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

        {/* Alerta de debug MUITO MAIS VISÍVEL */}
        <div className="bg-red-50 border-2 border-red-300 rounded-lg p-4 mb-4">
          <div className="flex items-center space-x-3">
            <Bug className="w-6 h-6 text-red-600 animate-pulse" />
            <div className="flex-1">
              <p className="text-sm font-bold text-red-800 mb-1">
                🚨 NÃO CONSEGUE VER NOVAS CONVERSAS? 🚨
              </p>
              <p className="text-xs text-red-700 mb-2">
                <strong>PASSO A PASSO:</strong> 1) Clique no botão "🔍 DEBUG SISTEMA" acima → 2) Pressione F12 para abrir console → 3) Envie mensagem do WhatsApp → 4) Veja os logs
              </p>
              <div className="bg-red-100 p-2 rounded text-xs text-red-800">
                <strong>Para testar:</strong> Envie uma mensagem do número <strong>47 996451886</strong> para o WhatsApp conectado
              </div>
            </div>
            <Button
              onClick={handleDebugMessages}
              size="sm"
              className="bg-red-600 text-white hover:bg-red-700 font-bold animate-pulse"
            >
              <Bug className="w-4 h-4 mr-1" />
              EXECUTAR DEBUG
            </Button>
          </div>
        </div>

        {/* Alerta de debug */}
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-4">
          <div className="flex items-center space-x-2">
            <AlertTriangle className="w-5 h-5 text-yellow-600" />
            <div>
              <p className="text-sm font-medium text-yellow-800">
                Não consegue ver novas conversas?
              </p>
              <p className="text-xs text-yellow-700">
                Clique em "Debug Sistema" e verifique o console do navegador (F12) para diagnóstico completo.
              </p>
            </div>
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
                      <p className="text-xs mb-4">
                        As conversas aparecerão aqui quando chegarem mensagens
                      </p>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleDebugMessages}
                        className="text-red-600 border-red-600"
                      >
                        <Bug className="w-4 h-4 mr-1" />
                        🔍 DEBUG SISTEMA
                      </Button>
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

export default TicketsInterface;
