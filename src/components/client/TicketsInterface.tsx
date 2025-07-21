
import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, MessageSquare, RefreshCw, Download, CheckCircle, Activity } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { useTicketRealtime } from "@/hooks/useTicketRealtime";
import { useRealTimeMessages } from "@/hooks/useRealTimeMessages";
import { ticketsService } from "@/services/ticketsService";
import TicketChatInterface from "./TicketChatInterface";

const TicketsInterface = () => {
  const { clientId } = useParams<{ clientId: string }>();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedTicket, setSelectedTicket] = useState<string>("");
  const [isImporting, setIsImporting] = useState(false);

  // Hook de tempo real para tickets
  const { tickets, isLoading, reloadTickets } = useTicketRealtime(clientId || '');

  // Hook de tempo real para mensagens (webhook + supabase)
  const { isConnected, connectionStatus } = useRealTimeMessages({
    clientId: clientId || '',
    instanceId: 'default', // TODO: pegar instância ativa do cliente
    onNewMessage: (message) => {
      console.log('📨 [TICKETS-UI] Nova mensagem recebida:', message);
      reloadTickets(); // Atualizar lista de tickets
    },
    onNewTicket: (ticket) => {
      console.log('🎫 [TICKETS-UI] Novo ticket criado:', ticket);
      reloadTickets(); // Atualizar lista de tickets
    }
  });

  const filteredTickets = tickets.filter(ticket => {
    const matchesSearch = ticket.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         ticket.customer?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         ticket.last_message_preview?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === "all" || ticket.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  const handleImportConversations = async () => {
    if (!clientId || isImporting) return;
    
    setIsImporting(true);
    try {
      toast({
        title: "Importando...",
        description: "Iniciando importação de conversas do CodeChat v1.3.0",
      });

      const result = await ticketsService.importConversationsFromWhatsApp(clientId);
      
      toast({
        title: "Importação Concluída",
        description: `${result.success} conversas importadas com sucesso. ${result.errors} erros.`,
      });

      reloadTickets();
    } catch (error: any) {
      toast({
        title: "Erro na Importação",
        description: error.message || "Erro ao importar conversas",
        variant: "destructive",
      });
    } finally {
      setIsImporting(false);
    }
  };

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open': return 'bg-green-100 text-green-800';
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'resolved': return 'bg-blue-100 text-blue-800';
      case 'closed': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'open': return 'Aberto';
      case 'pending': return 'Pendente';
      case 'resolved': return 'Resolvido';
      case 'closed': return 'Fechado';
      default: return status;
    }
  };

  const getConnectionStatusColor = () => {
    switch (connectionStatus) {
      case 'connected': return 'text-green-600';
      case 'connecting': return 'text-yellow-600';
      case 'disconnected': return 'text-red-600';
      default: return 'text-gray-600';
    }
  };

  const getConnectionStatusLabel = () => {
    switch (connectionStatus) {
      case 'connected': return 'Conectado';
      case 'connecting': return 'Conectando';
      case 'disconnected': return 'Desconectado';
      default: return 'Verificando';
    }
  };

  // Auto-refresh a cada 10 segundos (mais frequente para tempo real)
  useEffect(() => {
    const interval = setInterval(() => {
      if (!isLoading && !isImporting) {
        reloadTickets();
      }
    }, 10000);

    return () => clearInterval(interval);
  }, [isLoading, isImporting, reloadTickets]);

  if (isLoading && tickets.length === 0) {
    return (
      <div className="h-[calc(100vh-8rem)] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Carregando tickets...</p>
          <p className="text-sm text-gray-500 mt-2">Iniciando sistema de tempo real...</p>
        </div>
      </div>
    );
  }

  // Se um ticket está selecionado, mostrar interface de chat
  if (selectedTicket) {
    return (
      <div className="h-[calc(100vh-8rem)] flex flex-col">
        <div className="flex items-center gap-4 mb-4 p-4 bg-white border-b">
          <Button 
            variant="outline" 
            onClick={() => setSelectedTicket("")}
          >
            ← Voltar aos Tickets
          </Button>
          <div className="flex items-center gap-2">
            <Activity className={`w-4 h-4 ${getConnectionStatusColor()}`} />
            <span className={`text-sm font-medium ${getConnectionStatusColor()}`}>
              {getConnectionStatusLabel()}
            </span>
          </div>
        </div>
        
        <TicketChatInterface 
          clientId={clientId || ''} 
          ticketId={selectedTicket} 
        />
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-8rem)] grid grid-cols-12 gap-6">
      {/* Lista de Tickets */}
      <Card className="col-span-12 flex flex-col">
        <CardHeader className="pb-3">
          <div className="flex justify-between items-center">
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
                Tickets ({filteredTickets.length})
                {(isLoading || isImporting) && <div className="w-4 h-4 border-2 border-green-500 border-t-transparent rounded-full animate-spin"></div>}
              </CardTitle>
              <CardDescription className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <span>Sistema CodeChat v1.3.0 ativo</span>
                </div>
                <div className="flex items-center gap-2">
                  <Activity className={`h-4 w-4 ${getConnectionStatusColor()}`} />
                  <span className={getConnectionStatusColor()}>
                    Tempo Real: {getConnectionStatusLabel()}
                  </span>
                </div>
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                size="sm"
                onClick={reloadTickets}
                disabled={isLoading || isImporting}
                title="Recarregar tickets manualmente"
              >
                <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
              </Button>
              <Button 
                variant="outline" 
                size="sm"
                onClick={handleImportConversations}
                disabled={isImporting}
                title="Importar conversas do CodeChat v1.3.0"
              >
                {isImporting ? (
                  <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-1" />
                ) : (
                  <Download className="w-4 h-4 mr-1" />
                )}
                {isImporting ? 'Importando...' : 'Importar'}
              </Button>
            </div>
          </div>
          
          <div className="space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input 
                placeholder="Buscar tickets..." 
                className="pl-10"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            
            <div className="flex gap-2">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Filtrar por status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os status</SelectItem>
                  <SelectItem value="open">Aberto</SelectItem>
                  <SelectItem value="pending">Pendente</SelectItem>
                  <SelectItem value="resolved">Resolvido</SelectItem>
                  <SelectItem value="closed">Fechado</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        
        <CardContent className="flex-1 p-0">
          <ScrollArea className="h-full">
            {isImporting && (
              <div className="p-4 bg-blue-50 border-b">
                <div className="flex items-center gap-2 text-blue-700">
                  <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                  <span className="text-sm font-medium">Importando conversas do CodeChat v1.3.0...</span>
                </div>
                <p className="text-xs text-blue-600 mt-1">
                  Mensagens chegam automaticamente via webhook
                </p>
              </div>
            )}
            
            {filteredTickets.length === 0 ? (
              <div className="p-4 text-center text-gray-500">
                <MessageSquare className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                <p>Nenhum ticket encontrado</p>
                <p className="text-sm">
                  {tickets.length === 0 
                    ? "Aguardando mensagens do WhatsApp ou importe conversas existentes"
                    : "Nenhum ticket corresponde aos filtros aplicados"
                  }
                </p>
                {!isConnected && (
                  <p className="text-sm text-red-600 mt-2">
                    ⚠️ Sistema de tempo real desconectado
                  </p>
                )}
                <Button 
                  size="sm" 
                  variant="outline" 
                  onClick={handleImportConversations}
                  disabled={isImporting}
                  className="mt-2"
                >
                  {isImporting ? (
                    <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin mr-1" />
                  ) : (
                    <Download className="w-3 h-3 mr-1" />
                  )}
                  {isImporting ? 'Importando...' : 'Importar Conversas'}
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 p-4">
                {filteredTickets.map((ticket) => (
                  <Card
                    key={ticket.id}
                    onClick={() => setSelectedTicket(ticket.id)}
                    className="cursor-pointer hover:bg-gray-50 transition-colors"
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start space-x-3">
                        <Avatar className="w-10 h-10 flex-shrink-0">
                          <AvatarFallback>
                            {ticket.customer?.name?.charAt(0) || 'C'}
                          </AvatarFallback>
                        </Avatar>
                        
                        <div className="flex-1 min-w-0 space-y-1">
                          <div className="flex justify-between items-start">
                            <h3 className="font-medium text-gray-900 truncate">
                              {ticket.customer?.name || ticket.title}
                            </h3>
                            <Badge className={`text-xs ${getStatusColor(ticket.status)}`}>
                              {getStatusLabel(ticket.status)}
                            </Badge>
                          </div>
                          
                          <p className="text-sm text-gray-600 truncate">
                            {ticket.last_message_preview || 'Sem mensagens'}
                          </p>
                          
                          <div className="flex items-center justify-between text-xs text-gray-500">
                            <span>{ticket.customer?.phone}</span>
                            <span>{formatTime(ticket.last_message_at)}</span>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
};

export default TicketsInterface;
