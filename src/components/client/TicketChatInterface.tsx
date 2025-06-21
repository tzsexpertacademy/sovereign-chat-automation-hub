import { useState, useEffect, useRef } from "react";
import { useParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Search, Send, Paperclip, MoreVertical, Phone, Video, AlertCircle, MessageSquare, Clock, User, Tag, FileText, CheckCircle, XCircle, RefreshCw, Archive, Star, UserCheck, ArrowRight, Zap, Building2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { ticketsService, type ConversationTicket, type TicketMessage } from "@/services/ticketsService";
import { customersService, type Customer } from "@/services/customersService";
import { whatsappService } from "@/services/whatsappMultiClient";
import { queuesService } from "@/services/queuesService";
import { assistantsService } from "@/services/assistantsService";

const TicketChatInterface = () => {
  const { clientId } = useParams<{ clientId: string }>();
  const { toast } = useToast();
  
  const [tickets, setTickets] = useState<ConversationTicket[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<ConversationTicket | null>(null);
  const [ticketMessages, setTicketMessages] = useState<TicketMessage[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [internalNote, setInternalNote] = useState("");
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [activeTab, setActiveTab] = useState<"tickets" | "contacts">("tickets");
  const [showInternalNotes, setShowInternalNotes] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [queues, setQueues] = useState<any[]>([]);
  const [transferQueueId, setTransferQueueId] = useState("");
  const [transferReason, setTransferReason] = useState("");
  const [showTransferDialog, setShowTransferDialog] = useState(false);

  useEffect(() => {
    if (clientId) {
      loadData();
      loadQueues();
    }
  }, [clientId]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [ticketsData, customersData] = await Promise.all([
        ticketsService.getClientTickets(clientId!),
        customersService.getClientCustomers(clientId!)
      ]);
      
      setTickets(ticketsData);
      setCustomers(customersData);
      
      if (ticketsData.length > 0 && !selectedTicket) {
        setSelectedTicket(ticketsData[0]);
      }
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
      toast({
        title: "Erro",
        description: "Erro ao carregar tickets e contatos",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const loadQueues = async () => {
    try {
      const queuesData = await queuesService.getClientQueues(clientId!);
      setQueues(queuesData);
    } catch (error) {
      console.error('Erro ao carregar filas:', error);
    }
  };

  const handleImportConversations = async () => {
    try {
      setIsImporting(true);
      await ticketsService.importConversationsFromWhatsApp(clientId!);
      await loadData();
      
      toast({
        title: "Importação concluída",
        description: "Conversas do WhatsApp foram importadas com sucesso"
      });
    } catch (error: any) {
      toast({
        title: "Erro na importação",
        description: error.message || "Falha ao importar conversas",
        variant: "destructive"
      });
    } finally {
      setIsImporting(false);
    }
  };

  const handleAssumeTicket = async () => {
    if (!selectedTicket) return;

    try {
      await ticketsService.assumeTicketManually(selectedTicket.id);
      
      // Atualizar ticket local
      const updatedTicket = { 
        ...selectedTicket, 
        assigned_queue_id: undefined, 
        assigned_assistant_id: undefined,
        status: 'pending' as const
      };
      setSelectedTicket(updatedTicket);
      
      // Atualizar lista
      setTickets(prev => prev.map(t => 
        t.id === selectedTicket.id ? updatedTicket : t
      ));

      toast({
        title: "Ticket assumido",
        description: "Você assumiu este ticket manualmente"
      });
    } catch (error: any) {
      toast({
        title: "Erro",
        description: "Erro ao assumir ticket",
        variant: "destructive"
      });
    }
  };

  const handleTransferTicket = async () => {
    if (!selectedTicket || !transferQueueId) return;

    try {
      await ticketsService.transferTicket(selectedTicket.id, transferQueueId, transferReason);
      
      // Atualizar ticket local
      const queueName = queues.find(q => q.id === transferQueueId)?.name || 'Fila';
      const updatedTicket = { 
        ...selectedTicket, 
        assigned_queue_id: transferQueueId,
        queue: { id: transferQueueId, name: queueName },
        status: 'open' as const
      };
      setSelectedTicket(updatedTicket);
      
      // Atualizar lista
      setTickets(prev => prev.map(t => 
        t.id === selectedTicket.id ? updatedTicket : t
      ));

      setShowTransferDialog(false);
      setTransferQueueId("");
      setTransferReason("");

      toast({
        title: "Ticket transferido",
        description: `Ticket transferido para ${queueName}`
      });
    } catch (error: any) {
      toast({
        title: "Erro",
        description: "Erro ao transferir ticket",
        variant: "destructive"
      });
    }
  };

  useEffect(() => {
    if (selectedTicket) {
      loadTicketMessages();
    }
  }, [selectedTicket]);

  const loadTicketMessages = async () => {
    if (!selectedTicket) return;
    
    try {
      const messages = await ticketsService.getTicketMessages(selectedTicket.id);
      setTicketMessages(messages);
    } catch (error) {
      console.error('Erro ao carregar mensagens:', error);
    }
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !selectedTicket || !clientId) return;

    try {
      await whatsappService.sendMessage(clientId, selectedTicket.chat_id, newMessage);
      
      // Adicionar mensagem ao ticket
      await ticketsService.addTicketMessage({
        ticket_id: selectedTicket.id,
        message_id: `manual_${Date.now()}`,
        from_me: true,
        content: newMessage,
        message_type: 'text',
        is_internal_note: false,
        is_ai_response: false,
        processing_status: 'sent',
        timestamp: new Date().toISOString()
      });

      setNewMessage("");
      loadTicketMessages();
      
      toast({
        title: "Mensagem enviada",
        description: "Sua mensagem foi enviada com sucesso"
      });
    } catch (error: any) {
      toast({
        title: "Erro ao enviar",
        description: error.message || "Falha ao enviar mensagem",
        variant: "destructive"
      });
    }
  };

  const handleAddInternalNote = async () => {
    if (!internalNote.trim() || !selectedTicket) return;

    try {
      await ticketsService.addInternalNote(selectedTicket.id, internalNote, "Operador");
      setInternalNote("");
      
      // Recarregar ticket para mostrar nova nota
      const updatedTicket = await ticketsService.getTicketById(selectedTicket.id);
      if (updatedTicket) {
        setSelectedTicket(updatedTicket);
      }
      
      toast({
        title: "Nota adicionada",
        description: "Nota interna foi adicionada ao ticket"
      });
    } catch (error: any) {
      toast({
        title: "Erro",
        description: "Erro ao adicionar nota interna",
        variant: "destructive"
      });
    }
  };

  const handleStatusChange = async (status: string) => {
    if (!selectedTicket) return;

    try {
      await ticketsService.updateTicketStatus(selectedTicket.id, status);
      
      // Atualizar ticket local
      setSelectedTicket({ ...selectedTicket, status: status as any });
      
      // Atualizar lista de tickets
      setTickets(prev => prev.map(t => 
        t.id === selectedTicket.id ? { ...t, status: status as any } : t
      ));

      toast({
        title: "Status atualizado",
        description: `Ticket marcado como ${status}`
      });
    } catch (error: any) {
      toast({
        title: "Erro",
        description: "Erro ao atualizar status",
        variant: "destructive"
      });
    }
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      open: { label: "Aberto", variant: "default" as const, icon: MessageSquare },
      pending: { label: "Pendente", variant: "secondary" as const, icon: Clock },
      resolved: { label: "Resolvido", variant: "default" as const, icon: CheckCircle },
      closed: { label: "Fechado", variant: "outline" as const, icon: XCircle }
    };

    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.open;
    const Icon = config.icon;

    return (
      <Badge variant={config.variant} className="flex items-center gap-1">
        <Icon className="w-3 h-3" />
        {config.label}
      </Badge>
    );
  };

  const getPriorityColor = (priority: number) => {
    if (priority >= 4) return "text-red-500";
    if (priority >= 3) return "text-orange-500";
    if (priority >= 2) return "text-yellow-500";
    return "text-green-500";
  };

  const filteredTickets = tickets.filter(ticket => {
    const matchesSearch = ticket.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         ticket.customer?.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         ticket.last_message_preview?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === "all" || ticket.status === statusFilter;
    const matchesPriority = priorityFilter === "all" || ticket.priority.toString() === priorityFilter;
    
    return matchesSearch && matchesStatus && matchesPriority;
  });

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString('pt-BR', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  const formatDate = (timestamp: string) => {
    return new Date(timestamp).toLocaleDateString('pt-BR');
  };

  if (loading) {
    return (
      <div className="h-[calc(100vh-8rem)] flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-4 text-primary" />
          <p className="text-gray-600">Carregando tickets...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-8rem)] flex flex-col">
      {/* Header com Tabs */}
      <div className="bg-white border-b p-4">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold">Central de Conversas</h1>
          <div className="flex space-x-2">
            <Button 
              onClick={handleImportConversations}
              disabled={isImporting}
              size="sm"
            >
              {isImporting ? (
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Building2 className="w-4 h-4 mr-2" />
              )}
              {isImporting ? 'Importando...' : 'Importar Conversas'}
            </Button>
            <Button variant="outline" size="sm">
              <Archive className="w-4 h-4 mr-2" />
              Arquivados
            </Button>
            <Button size="sm" onClick={loadData}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Atualizar
            </Button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex space-x-4">
          <Button
            variant={activeTab === "tickets" ? "default" : "ghost"}
            onClick={() => setActiveTab("tickets")}
            className="flex items-center gap-2"
          >
            <MessageSquare className="w-4 h-4" />
            Tickets ({tickets.length})
          </Button>
          <Button
            variant={activeTab === "contacts" ? "default" : "ghost"}
            onClick={() => setActiveTab("contacts")}
            className="flex items-center gap-2"
          >
            <User className="w-4 h-4" />
            Contatos ({customers.length})
          </Button>
        </div>
      </div>

      <div className="flex-1 grid grid-cols-12 gap-6 p-6">
        {/* Lista de Tickets/Contatos */}
        <Card className="col-span-4 flex flex-col">
          <CardHeader className="pb-3">
            <div className="space-y-3">
              {/* Busca */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input 
                  placeholder={activeTab === "tickets" ? "Buscar tickets..." : "Buscar contatos..."} 
                  className="pl-10"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>

              {/* Filtros */}
              {activeTab === "tickets" && (
                <div className="flex space-x-2">
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      <SelectItem value="open">Aberto</SelectItem>
                      <SelectItem value="pending">Pendente</SelectItem>
                      <SelectItem value="resolved">Resolvido</SelectItem>
                      <SelectItem value="closed">Fechado</SelectItem>
                    </SelectContent>
                  </Select>

                  <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Prioridade</SelectItem>
                      <SelectItem value="1">Baixa</SelectItem>
                      <SelectItem value="2">Normal</SelectItem>
                      <SelectItem value="3">Alta</SelectItem>
                      <SelectItem value="4">Urgente</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          </CardHeader>
          
          <CardContent className="flex-1 p-0">
            <ScrollArea className="h-full">
              {activeTab === "tickets" ? (
                // Lista de Tickets
                filteredTickets.length === 0 ? (
                  <div className="p-4 text-center text-gray-500">
                    <MessageSquare className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                    <p>Nenhum ticket encontrado</p>
                    <Button 
                      onClick={handleImportConversations}
                      disabled={isImporting}
                      variant="outline"
                      size="sm"
                      className="mt-2"
                    >
                      {isImporting ? 'Importando...' : 'Importar Conversas'}
                    </Button>
                  </div>
                ) : (
                  filteredTickets.map((ticket) => (
                    <div
                      key={ticket.id}
                      onClick={() => setSelectedTicket(ticket)}
                      className={`p-4 border-b cursor-pointer hover:bg-gray-50 transition-colors ${
                        selectedTicket?.id === ticket.id ? 'bg-blue-50 border-r-2 border-r-blue-500' : ''
                      }`}
                    >
                      <div className="flex items-start space-x-3">
                        <Avatar className="w-12 h-12">
                          <AvatarFallback>{ticket.customer?.name.charAt(0) || 'U'}</AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <div className="flex justify-between items-start mb-1">
                            <h3 className="font-medium text-gray-900 truncate">{ticket.title}</h3>
                            <div className="flex items-center space-x-1">
                              <Star className={`w-3 h-3 ${getPriorityColor(ticket.priority)}`} />
                              <span className="text-xs text-gray-500">
                                {formatTime(ticket.last_message_at)}
                              </span>
                            </div>
                          </div>
                          
                          {/* Etiquetas de Conexão, Fila e Tags */}
                          <div className="flex items-center space-x-1 mb-2 flex-wrap gap-1">
                            {getStatusBadge(ticket.status)}
                            
                            {/* Badge da Instância/Conexão */}
                            <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700">
                              <Building2 className="w-3 h-3 mr-1" />
                              Conexão
                            </Badge>
                            
                            {/* Badge da Fila */}
                            {ticket.queue && (
                              <Badge variant="outline" className="text-xs bg-green-50 text-green-700">
                                <ArrowRight className="w-3 h-3 mr-1" />
                                {ticket.queue.name}
                              </Badge>
                            )}
                            
                            {/* Badge do Assistente */}
                            {ticket.assistant && (
                              <Badge variant="outline" className="text-xs bg-purple-50 text-purple-700">
                                <Zap className="w-3 h-3 mr-1" />
                                {ticket.assistant.name}
                              </Badge>
                            )}
                          </div>
                          
                          <p className="text-sm text-gray-600 truncate">
                            {ticket.last_message_preview || 'Sem mensagens'}
                          </p>
                          <div className="flex justify-between items-center mt-2">
                            <span className="text-xs text-gray-500">
                              {ticket.customer?.name}
                            </span>
                            {ticket.internal_notes.length > 0 && (
                              <Badge variant="secondary" className="text-xs">
                                {ticket.internal_notes.length} notas
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                )
              ) : (
                // Lista de Contatos
                customers.length === 0 ? (
                  <div className="p-4 text-center text-gray-500">
                    <User className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                    <p>Nenhum contato encontrado</p>
                  </div>
                ) : (
                  customers
                    .filter(customer => 
                      customer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                      customer.phone.includes(searchTerm) ||
                      customer.email?.toLowerCase().includes(searchTerm.toLowerCase())
                    )
                    .map((customer) => (
                      <div
                        key={customer.id}
                        className="p-4 border-b hover:bg-gray-50 transition-colors"
                      >
                        <div className="flex items-center space-x-3">
                          <Avatar className="w-12 h-12">
                            <AvatarFallback>{customer.name.charAt(0)}</AvatarFallback>
                          </Avatar>
                          <div className="flex-1">
                            <h3 className="font-medium text-gray-900">{customer.name}</h3>
                            <p className="text-sm text-gray-600">{customer.phone}</p>
                            {customer.email && (
                              <p className="text-sm text-gray-500">{customer.email}</p>
                            )}
                            <p className="text-xs text-gray-400">
                              Cliente desde {formatDate(customer.created_at)}
                            </p>
                          </div>
                          <div className="flex space-x-1">
                            <Button variant="ghost" size="sm">
                              <Phone className="w-4 h-4" />
                            </Button>
                            <Button variant="ghost" size="sm">
                              <MessageSquare className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))
                )
              )}
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Área de Conversa/Detalhes */}
        <Card className="col-span-8 flex flex-col">
          {selectedTicket && activeTab === "tickets" ? (
            <>
              {/* Header do Ticket */}
              <CardHeader className="border-b">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <Avatar className="w-10 h-10">
                      <AvatarFallback>{selectedTicket.customer?.name.charAt(0) || 'U'}</AvatarFallback>
                    </Avatar>
                    <div>
                      <h3 className="font-medium text-gray-900">{selectedTicket.title}</h3>
                      <p className="text-sm text-gray-500">{selectedTicket.customer?.name} • {selectedTicket.customer?.phone}</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    {getStatusBadge(selectedTicket.status)}
                    
                    {/* Ações de Ticket */}
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={handleAssumeTicket}
                      disabled={selectedTicket.status === 'pending'}
                    >
                      <UserCheck className="w-4 h-4 mr-2" />
                      Assumir
                    </Button>
                    
                    <Dialog open={showTransferDialog} onOpenChange={setShowTransferDialog}>
                      <DialogTrigger asChild>
                        <Button variant="outline" size="sm">
                          <ArrowRight className="w-4 h-4 mr-2" />
                          Transferir
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Transferir Ticket</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4">
                          <div>
                            <label className="text-sm font-medium">Fila de Destino</label>
                            <Select value={transferQueueId} onValueChange={setTransferQueueId}>
                              <SelectTrigger>
                                <SelectValue placeholder="Selecione uma fila" />
                              </SelectTrigger>
                              <SelectContent>
                                {queues.map((queue) => (
                                  <SelectItem key={queue.id} value={queue.id}>
                                    {queue.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <label className="text-sm font-medium">Motivo (opcional)</label>
                            <Textarea
                              placeholder="Motivo da transferência..."
                              value={transferReason}
                              onChange={(e) => setTransferReason(e.target.value)}
                            />
                          </div>
                          <div className="flex justify-end space-x-2">
                            <Button 
                              variant="outline" 
                              onClick={() => setShowTransferDialog(false)}
                            >
                              Cancelar
                            </Button>
                            <Button 
                              onClick={handleTransferTicket}
                              disabled={!transferQueueId}
                            >
                              Transferir
                            </Button>
                          </div>
                        </div>
                      </DialogContent>
                    </Dialog>
                    
                    <Select value={selectedTicket.status} onValueChange={handleStatusChange}>
                      <SelectTrigger className="w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="open">Aberto</SelectItem>
                        <SelectItem value="pending">Pendente</SelectItem>
                        <SelectItem value="resolved">Resolvido</SelectItem>
                        <SelectItem value="closed">Fechado</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button variant="ghost" size="sm">
                      <MoreVertical className="w-4 h-4" />
                    </Button>
                  </div>
                </div>

                {/* Tabs de Conversa e Notas */}
                <div className="flex space-x-4 mt-4">
                  <Button
                    variant={!showInternalNotes ? "default" : "ghost"}
                    size="sm"
                    onClick={() => setShowInternalNotes(false)}
                  >
                    <MessageSquare className="w-4 h-4 mr-2" />
                    Conversa
                  </Button>
                  <Button
                    variant={showInternalNotes ? "default" : "ghost"}
                    size="sm"
                    onClick={() => setShowInternalNotes(true)}
                  >
                    <FileText className="w-4 h-4 mr-2" />
                    Notas Internas ({selectedTicket.internal_notes.length})
                  </Button>
                </div>
              </CardHeader>

              {/* Área de Mensagens/Notas */}
              <CardContent className="flex-1 p-0">
                {!showInternalNotes ? (
                  // Conversa
                  <div className="flex flex-col h-full">
                    <ScrollArea className="flex-1 p-4">
                      <div className="space-y-4">
                        {ticketMessages.length === 0 ? (
                          <div className="text-center text-gray-500 py-8">
                            <MessageSquare className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                            <p>Nenhuma mensagem nesta conversa</p>
                          </div>
                        ) : (
                          ticketMessages.map((message) => (
                            <div
                              key={message.id}
                              className={`flex ${message.from_me ? 'justify-end' : 'justify-start'}`}
                            >
                              <div className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                                message.from_me
                                  ? 'bg-blue-500 text-white'
                                  : 'bg-gray-100 text-gray-900'
                              }`}>
                                <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                                <div className="flex items-center justify-between mt-1">
                                  <p className={`text-xs ${
                                    message.from_me ? 'text-blue-100' : 'text-gray-500'
                                  }`}>
                                    {formatTime(message.timestamp)}
                                  </p>
                                  {message.is_ai_response && (
                                    <Badge variant="secondary" className="text-xs ml-2">
                                      IA
                                    </Badge>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </ScrollArea>

                    {/* Input de Mensagem */}
                    <div className="border-t p-4">
                      <div className="flex space-x-2">
                        <Button variant="ghost" size="sm">
                          <Paperclip className="w-4 h-4" />
                        </Button>
                        <Input
                          placeholder="Digite sua mensagem..."
                          value={newMessage}
                          onChange={(e) => setNewMessage(e.target.value)}
                          onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                          className="flex-1"
                        />
                        <Button onClick={handleSendMessage} disabled={!newMessage.trim()}>
                          <Send className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ) : (
                  // Notas Internas
                  <div className="flex flex-col h-full">
                    <ScrollArea className="flex-1 p-4">
                      <div className="space-y-4">
                        {selectedTicket.internal_notes.length === 0 ? (
                          <div className="text-center text-gray-500 py-8">
                            <FileText className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                            <p>Nenhuma nota interna</p>
                          </div>
                        ) : (
                          selectedTicket.internal_notes.map((note: any) => (
                            <div key={note.id} className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                              <div className="flex justify-between items-start mb-2">
                                <span className="font-medium text-sm">{note.created_by}</span>
                                <span className="text-xs text-gray-500">
                                  {formatTime(note.created_at)}
                                </span>
                              </div>
                              <p className="text-sm">{note.content}</p>
                            </div>
                          ))
                        )}
                      </div>
                    </ScrollArea>

                    {/* Input de Nota Interna */}
                    <div className="border-t p-4">
                      <div className="space-y-2">
                        <Textarea
                          placeholder="Adicionar nota interna..."
                          value={internalNote}
                          onChange={(e) => setInternalNote(e.target.value)}
                          rows={3}
                        />
                        <div className="flex justify-end">
                          <Button onClick={handleAddInternalNote} disabled={!internalNote.trim()}>
                            <FileText className="w-4 h-4 mr-2" />
                            Adicionar Nota
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center text-gray-500">
                <MessageSquare className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                <h3 className="text-lg font-medium mb-2">
                  {activeTab === "tickets" ? "Selecione um ticket" : "Área de Contatos"}
                </h3>
                <p>
                  {activeTab === "tickets" 
                    ? "Escolha um ticket da lista para visualizar a conversa" 
                    : "Gerencie seus contatos e informações de clientes"
                  }
                </p>
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
};

export default TicketChatInterface;
