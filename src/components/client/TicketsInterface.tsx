
import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, MessageSquare, Clock, User, Bot, AlertCircle, RefreshCw, Settings, Filter } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { useTicketRealtime } from "@/hooks/useTicketRealtime";
import { ticketsService } from "@/services/ticketsService";

const TicketsInterface = () => {
  const { clientId } = useParams<{ clientId: string }>();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedTicket, setSelectedTicket] = useState<string>("");

  // Hook de tempo real
  const { tickets, isLoading, reloadTickets } = useTicketRealtime(clientId || '');

  const filteredTickets = tickets.filter(ticket => {
    const matchesSearch = ticket.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         ticket.customer?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         ticket.last_message_preview?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === "all" || ticket.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  const handleImportConversations = async () => {
    if (!clientId) return;
    
    try {
      toast({
        title: "Importando...",
        description: "Iniciando importação de conversas do WhatsApp",
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

  if (isLoading && tickets.length === 0) {
    return (
      <div className="h-[calc(100vh-8rem)] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Carregando tickets...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-8rem)] grid grid-cols-12 gap-6">
      {/* Lista de Tickets */}
      <Card className="col-span-5 flex flex-col">
        <CardHeader className="pb-3">
          <div className="flex justify-between items-center">
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
                Tickets ({filteredTickets.length})
              </CardTitle>
              <CardDescription>
                Sistema de atendimento em tempo real
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                size="sm"
                onClick={reloadTickets}
                disabled={isLoading}
              >
                <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
              </Button>
              <Button 
                variant="outline" 
                size="sm"
                onClick={handleImportConversations}
              >
                <Settings className="w-4 h-4 mr-1" />
                Importar
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
            {filteredTickets.length === 0 ? (
              <div className="p-4 text-center text-gray-500">
                <MessageSquare className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                <p>Nenhum ticket encontrado</p>
                <p className="text-sm">Importe conversas do WhatsApp</p>
              </div>
            ) : (
              filteredTickets.map((ticket) => (
                <div
                  key={ticket.id}
                  onClick={() => setSelectedTicket(ticket.id)}
                  className={`p-4 border-b cursor-pointer hover:bg-gray-50 transition-colors ${
                    selectedTicket === ticket.id ? 'bg-blue-50 border-r-2 border-r-blue-500' : ''
                  }`}
                >
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
                        <div className="flex flex-col items-end gap-1">
                          <Badge className={`text-xs ${getStatusColor(ticket.status)}`}>
                            {getStatusLabel(ticket.status)}
                          </Badge>
                          <span className="text-xs text-gray-500">
                            {formatTime(ticket.last_message_at)}
                          </span>
                        </div>
                      </div>
                      
                      <p className="text-sm text-gray-600 truncate">
                        {ticket.last_message_preview || 'Sem mensagens'}
                      </p>
                      
                      <div className="flex items-center justify-between text-xs text-gray-500">
                        <div className="flex items-center gap-1">
                          <span>{ticket.customer?.phone}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          {ticket.assigned_assistant_id && (
                            <div className="flex items-center gap-1 text-blue-600">
                              <Bot className="w-3 h-3" />
                              <span>IA</span>
                            </div>
                          )}
                          {ticket.priority > 1 && (
                            <Badge variant="outline" className="text-xs">
                              P{ticket.priority}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Detalhes do Ticket */}
      <Card className="col-span-7 flex flex-col">
        {selectedTicket ? (
          <div className="h-full flex flex-col">
            <CardHeader className="border-b">
              <CardTitle>Detalhes do Ticket</CardTitle>
              <CardDescription>
                Visualização e gerenciamento do atendimento
              </CardDescription>
            </CardHeader>
            <CardContent className="flex-1 p-4">
              <div className="flex items-center justify-center h-full text-muted-foreground">
                <div className="text-center">
                  <MessageSquare className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>Detalhes do ticket em desenvolvimento</p>
                  <p className="text-sm">Em breve: visualização de mensagens, histórico e ações</p>
                </div>
              </div>
            </CardContent>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center text-muted-foreground">
              <MessageSquare className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <h3 className="text-lg font-medium mb-2">Selecione um ticket</h3>
              <p>Escolha um ticket da lista para ver os detalhes</p>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
};

export default TicketsInterface;
