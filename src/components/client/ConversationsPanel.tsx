
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, MessageSquare, Download, RefreshCw, CheckCircle, Bot } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { useTicketRealtime } from "@/hooks/useTicketRealtime";
import { conversationImportService } from "@/services/conversationImportService";
import TicketChatInterface from './TicketChatInterface';

interface ConversationsPanelProps {
  clientId: string;
}

const ConversationsPanel = ({ clientId }: ConversationsPanelProps) => {
  const { chatId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [isImporting, setIsImporting] = useState(false);

  // Hook para tickets em tempo real
  const { tickets, isLoading, reloadTickets } = useTicketRealtime(clientId);

  const filteredTickets = tickets.filter(ticket => {
    const matchesSearch = ticket.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         ticket.customer?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         ticket.last_message_preview?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === "all" || ticket.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  const handleSelectConversation = (ticketId: string) => {
    navigate(`/client/${clientId}/chat/${ticketId}`);
  };

  const handleImportConversations = async () => {
    if (!clientId || isImporting) return;
    
    setIsImporting(true);
    try {
      toast({
        title: "Importando...",
        description: "Iniciando importação de conversas do WhatsApp",
      });

      const result = await conversationImportService.importConversationsFromWhatsApp(clientId);
      
      toast({
        title: "Importação Concluída",
        description: `${result.success} conversas importadas com sucesso. ${result.errors > 0 ? `${result.errors} erros.` : ''}`,
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

  // Auto-refresh a cada 30 segundos
  useEffect(() => {
    const interval = setInterval(() => {
      if (!isLoading && !isImporting) {
        reloadTickets();
      }
    }, 30000);

    return () => clearInterval(interval);
  }, [isLoading, isImporting, reloadTickets]);

  if (isLoading && tickets.length === 0) {
    return (
      <div className="h-[calc(100vh-8rem)] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Carregando conversas...</p>
          <p className="text-sm text-gray-500 mt-2">Sistema moderno ativo...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-8rem)] grid grid-cols-12 gap-6">
      {/* Lista de Conversas - Painel Esquerdo */}
      <Card className="col-span-5 flex flex-col">
        <CardHeader className="pb-3">
          <div className="flex justify-between items-center">
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
                Conversas ({filteredTickets.length})
                {(isLoading || isImporting) && <div className="w-4 h-4 border-2 border-green-500 border-t-transparent rounded-full animate-spin"></div>}
              </CardTitle>
              <CardDescription className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-500" />
                Sistema moderno ativo - LOCAL FIRST
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                size="sm"
                onClick={reloadTickets}
                disabled={isLoading || isImporting}
                title="Recarregar conversas"
              >
                <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
              </Button>
              <Button 
                variant="outline" 
                size="sm"
                onClick={handleImportConversations}
                disabled={isImporting}
                title="Importar conversas do WhatsApp"
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
                placeholder="Buscar conversas..." 
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
                  <span className="text-sm font-medium">Importando conversas...</span>
                </div>
                <p className="text-xs text-blue-600 mt-1">
                  Usando dados locais + extração inteligente de nomes
                </p>
              </div>
            )}
            
            {filteredTickets.length === 0 ? (
              <div className="p-4 text-center text-gray-500">
                <MessageSquare className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                <p>Nenhuma conversa encontrada</p>
                <p className="text-sm">
                  {tickets.length === 0 
                    ? "Importe conversas do WhatsApp para começar"
                    : "Nenhuma conversa corresponde aos filtros aplicados"
                  }
                </p>
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
              filteredTickets.map((ticket) => (
                <div
                  key={ticket.id}
                  onClick={() => handleSelectConversation(ticket.id)}
                  className={`p-4 border-b cursor-pointer hover:bg-gray-50 transition-colors ${
                    chatId === ticket.id ? 'bg-blue-50 border-r-2 border-r-blue-500' : ''
                  }`}
                >
                  <div className="flex items-start space-x-3">
                    <Avatar className="w-10 h-10 flex-shrink-0">
                      <AvatarFallback className="bg-gradient-to-br from-blue-400 to-purple-500 text-white">
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
                            {ticket.last_message_at ? formatTime(ticket.last_message_at) : 'Sem data'}
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

      {/* Interface de Chat - Painel Direito */}
      <Card className="col-span-7 flex flex-col">
        {chatId ? (
          <TicketChatInterface 
            clientId={clientId}
            ticketId={chatId}
          />
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center text-muted-foreground">
              <MessageSquare className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <h3 className="text-lg font-medium mb-2">Selecione uma conversa</h3>
              <p>Escolha uma conversa da lista para ver as mensagens e responder</p>
              <div className="mt-4 space-y-2 text-sm">
                <div className="flex items-center justify-center gap-2 text-green-600">
                  <CheckCircle className="h-4 w-4" />
                  <span>Sistema LOCAL FIRST ativo</span>
                </div>
                <p className="text-xs text-gray-500">
                  Conversas em tempo real com extração inteligente de nomes
                </p>
                <div className="mt-3">
                  <Button 
                    size="sm" 
                    variant="outline" 
                    onClick={handleImportConversations}
                    disabled={isImporting}
                  >
                    {isImporting ? (
                      <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin mr-1" />
                    ) : (
                      <Download className="w-3 h-3 mr-1" />
                    )}
                    {isImporting ? 'Importando...' : 'Importar Conversas'}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
};

export default ConversationsPanel;
