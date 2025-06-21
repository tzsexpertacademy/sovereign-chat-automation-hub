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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Search, Send, Paperclip, MoreVertical, Phone, Video, AlertCircle, MessageSquare, Clock, User, Tag, FileText, CheckCircle, XCircle, RefreshCw, Archive, Star, UserCheck, ArrowRight, Zap, Building2, Users } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { ticketsService, type ConversationTicket } from "@/services/ticketsService";
import { customersService, type Customer } from "@/services/customersService";
import { whatsappService } from "@/services/whatsappMultiClient";
import { queuesService } from "@/services/queuesService";
import { useTicketRealtime } from "@/hooks/useTicketRealtime";
import { useTicketMessages } from "@/hooks/useTicketMessages";
import { useMessageStatus } from "@/hooks/useMessageStatus";
import { useTypingStatus } from "@/hooks/useTypingStatus";
import { useWhatsAppTypingEvents } from "@/hooks/useWhatsAppTypingEvents";
import AutomaticProcessorStatus from './AutomaticProcessorStatus';
import TypingIndicator from './TypingIndicator';
import MessageStatus from './MessageStatus';

const TicketChatInterface = () => {
  const { clientId } = useParams<{ clientId: string }>();
  const { toast } = useToast();
  
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<ConversationTicket | null>(null);
  const [newMessage, setNewMessage] = useState("");
  const [internalNote, setInternalNote] = useState("");
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
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Hooks para tempo real - Enhanced with WhatsApp integration
  const { tickets, isLoading, reloadTickets, isTyping: assistantTyping } = useTicketRealtime(clientId || '');
  const { messages: ticketMessages, isLoading: loadingMessages } = useTicketMessages(selectedTicket?.id || null);
  const { getMessageStatus, updateMessageStatus, markMessageAsRead, markMessageAsFailed } = useMessageStatus(clientId, selectedTicket?.chat_id);
  const { isTyping, isRecording, startTyping, stopTyping, startRecording, stopRecording } = useTypingStatus(clientId, selectedTicket?.chat_id);
  const { isContactTyping, getTypingContact } = useWhatsAppTypingEvents(clientId || '');

  // Auto scroll para última mensagem
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [ticketMessages, assistantTyping]);

  useEffect(() => {
    if (clientId) {
      loadCustomers();
      loadQueues();
    }
  }, [clientId]);

  // Selecionar primeiro ticket quando a lista carrega
  useEffect(() => {
    if (tickets.length > 0 && !selectedTicket) {
      setSelectedTicket(tickets[0]);
    }
  }, [tickets, selectedTicket]);

  const loadCustomers = async () => {
    try {
      const customersData = await customersService.getClientCustomers(clientId!);
      setCustomers(customersData);
    } catch (error) {
      console.error('Erro ao carregar clientes:', error);
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
      const result = await ticketsService.importConversationsFromWhatsApp(clientId!);
      
      toast({
        title: "Importação concluída",
        description: `${result.success} conversas importadas, ${result.errors} erros`
      });
      
      reloadTickets();
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
      
      const updatedTicket = { 
        ...selectedTicket, 
        assigned_queue_id: undefined, 
        assigned_assistant_id: undefined,
        status: 'pending' as const
      };
      setSelectedTicket(updatedTicket);
      reloadTickets();

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
      
      const queueName = queues.find(q => q.id === transferQueueId)?.name || 'Fila';
      const updatedTicket = { 
        ...selectedTicket, 
        assigned_queue_id: transferQueueId,
        queue: { id: transferQueueId, name: queueName },
        status: 'open' as const
      };
      setSelectedTicket(updatedTicket);
      reloadTickets();

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

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !selectedTicket || !clientId) return;

    const tempMessageId = `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    try {
      console.log('📤 Enviando mensagem:', newMessage);
      
      // Marcar como enviando
      updateMessageStatus(tempMessageId, 'sending');
      
      // Parar indicador de digitação (também para o WhatsApp)
      await stopTyping();
      
      // Send message to WhatsApp
      const result = await whatsappService.sendMessage(clientId, selectedTicket.chat_id, newMessage);
      
      // Marcar como enviada
      updateMessageStatus(tempMessageId, 'sent');
      
      // Adicionar mensagem ao ticket
      await ticketsService.addTicketMessage({
        ticket_id: selectedTicket.id,
        message_id: result.messageId || tempMessageId,
        from_me: true,
        sender_name: "Operador",
        content: newMessage,
        message_type: 'text',
        is_internal_note: false,
        is_ai_response: false,
        processing_status: 'sent',
        timestamp: new Date().toISOString()
      });

      setNewMessage("");
      
      // Simular entrega após 2 segundos
      setTimeout(() => {
        updateMessageStatus(result.messageId || tempMessageId, 'delivered');
        console.log('📦 Mensagem marcada como entregue');
      }, 2000);
      
      // Marcar como lida automaticamente após 5 segundos (quando assistente "vê" a mensagem)
      setTimeout(() => {
        markMessageAsRead(result.messageId || tempMessageId);
        console.log('👁️ Mensagem marcada como lida (V azul)');
      }, 5000);
      
      toast({
        title: "Mensagem enviada",
        description: "Sua mensagem foi enviada com sucesso"
      });
    } catch (error: any) {
      updateMessageStatus(tempMessageId, 'failed');
      await stopTyping();
      console.error('❌ Erro ao enviar mensagem:', error);
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
      
      setSelectedTicket({ ...selectedTicket, status: status as any });
      reloadTickets();

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
      <Badge variant={config.variant} className="flex items-center gap-1 text-xs">
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

  // Melhorar extração de nome do WhatsApp
  const getDisplayName = (ticket: ConversationTicket) => {
    // Tentar extrair nome do customer primeiro
    if (ticket.customer?.name && 
        ticket.customer.name !== `Contato ${ticket.customer.phone}` &&
        !ticket.customer.name.startsWith('Contato ')) {
      return ticket.customer.name;
    }
    
    // Tentar extrair do título se contém nome real
    if (ticket.title && ticket.title.includes('Conversa com ')) {
      const nameFromTitle = ticket.title.replace('Conversa com ', '').trim();
      if (nameFromTitle && 
          !nameFromTitle.startsWith('Contato ') && 
          nameFromTitle !== ticket.customer?.phone) {
        return nameFromTitle;
      }
    }
    
    // Tentar usar phone formatado
    const phone = ticket.customer?.phone || ticket.chat_id;
    if (phone) {
      // Formatar telefone brasileiro
      const cleanPhone = phone.replace(/\D/g, '');
      if (cleanPhone.length >= 10) {
        const formattedPhone = cleanPhone.replace(/(\d{2})(\d{4,5})(\d{4})/, '($1) $2-$3');
        return formattedPhone;
      }
    }
    
    return 'Contato sem nome';
  };

  const handleInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setNewMessage(value);
    
    if (value.trim() && !isTyping) {
      await startTyping();
    } else if (!value.trim() && isTyping) {
      await stopTyping();
    }
  };

  const handleInputBlur = async () => {
    // Delay para não parar digitação imediatamente
    setTimeout(async () => {
      if (isTyping) {
        await stopTyping();
      }
    }, 1000);
  };

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b p-4 flex-shrink-0">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold">Central de Conversas</h1>
          <div className="flex gap-2">
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
              {isImporting ? 'Importando...' : 'Importar'}
            </Button>
            <Button variant="outline" size="sm">
              <Archive className="w-4 h-4 mr-2" />
              Arquivados
            </Button>
            <Button size="sm" onClick={reloadTickets}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Atualizar
            </Button>
          </div>
        </div>

        {/* Status do Processamento Automático */}
        <AutomaticProcessorStatus clientId={clientId!} />

        {/* Tabs */}
        <div className="flex space-x-2">
          <Button
            variant={activeTab === "tickets" ? "default" : "ghost"}
            onClick={() => setActiveTab("tickets")}
            className="flex items-center gap-2"
            size="sm"
          >
            <MessageSquare className="w-4 h-4" />
            Tickets ({tickets.length})
          </Button>
          <Button
            variant={activeTab === "contacts" ? "default" : "ghost"}
            onClick={() => setActiveTab("contacts")}
            className="flex items-center gap-2"
            size="sm"
          >
            <Users className="w-4 h-4" />
            Contatos ({customers.length})
          </Button>
        </div>
      </div>

      {/* Main Content - Layout Horizontal */}
      <div className="flex-1 flex gap-4 p-4 min-h-0 overflow-hidden">
        {/* Lista de Tickets - Sidebar */}
        <div className="w-80 flex flex-col bg-white rounded-lg border">
          <div className="p-4 border-b">
            {/* Busca */}
            <div className="relative mb-3">
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
              <div className="flex gap-2">
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="flex-1">
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
                  <SelectTrigger className="flex-1">
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
          
          {/* Lista */}
          <ScrollArea className="flex-1">
            {activeTab === "tickets" ? (
              // Lista de Tickets
              filteredTickets.length === 0 ? (
                <div className="p-4 text-center text-gray-500">
                  <MessageSquare className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                  <p className="text-sm">Nenhum ticket encontrado</p>
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
                      <Avatar className="w-12 h-12 flex-shrink-0">
                        <AvatarFallback>
                          {getDisplayName(ticket).charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-start mb-1">
                          <h3 className="font-medium text-gray-900 truncate">
                            {getDisplayName(ticket)}
                          </h3>
                          <div className="flex items-center space-x-1 flex-shrink-0">
                            <Star className={`w-3 h-3 ${getPriorityColor(ticket.priority)}`} />
                            <span className="text-xs text-gray-500">
                              {formatTime(ticket.last_message_at)}
                            </span>
                          </div>
                        </div>
                        
                        {/* Status e Tags */}
                        <div className="flex items-center gap-1 mb-2 flex-wrap">
                          {getStatusBadge(ticket.status)}
                          
                          {ticket.queue && (
                            <Badge variant="outline" className="text-xs bg-green-50 text-green-700">
                              <ArrowRight className="w-3 h-3 mr-1" />
                              {ticket.queue.name}
                            </Badge>
                          )}
                        </div>
                        
                        <p className="text-sm text-gray-600 truncate">
                          {ticket.last_message_preview || 'Sem mensagens'}
                        </p>
                        <div className="flex justify-between items-center mt-2">
                          <span className="text-xs text-gray-500">
                            {ticket.customer?.phone}
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
                  <p className="text-sm">Nenhum contato encontrado</p>
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
                          <AvatarFallback>
                            {customer.name.charAt(0)}
                          </AvatarFallback>
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
        </div>

        {/* Área de Conversa - Main Content */}
        <div className="flex-1 flex flex-col bg-white rounded-lg border min-w-0">
          {selectedTicket && activeTab === "tickets" ? (
            <>
              {/* Header do Ticket */}
              <div className="border-b p-4">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center space-x-3 min-w-0">
                    <Avatar className="w-10 h-10 flex-shrink-0">
                      <AvatarFallback>
                        {getDisplayName(selectedTicket).charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <h3 className="font-medium text-gray-900 truncate">
                        {getDisplayName(selectedTicket)}
                      </h3>
                      <p className="text-sm text-gray-500 truncate">
                        {selectedTicket.customer?.phone}
                      </p>
                    </div>
                  </div>
                  
                  {/* Ações */}
                  <div className="flex items-center gap-2">
                    {getStatusBadge(selectedTicket.status)}
                    
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
                <div className="flex space-x-2">
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
                    Notas ({selectedTicket.internal_notes.length})
                  </Button>
                </div>
              </div>

              {/* Área de Mensagens/Notas */}
              <div className="flex-1 min-h-0 flex flex-col">
                {!showInternalNotes ? (
                  // Conversa
                  <>
                    <ScrollArea className="flex-1 p-4">
                      <div className="space-y-4">
                        {loadingMessages ? (
                          <div className="text-center py-8">
                            <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2" />
                            <p className="text-sm text-gray-500">Carregando mensagens...</p>
                          </div>
                        ) : ticketMessages.length === 0 ? (
                          <div className="text-center text-gray-500 py-8">
                            <MessageSquare className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                            <p className="text-sm">Nenhuma mensagem nesta conversa</p>
                          </div>
                        ) : (
                          ticketMessages.map((message) => (
                            <div
                              key={message.id}
                              className={`flex ${message.from_me ? 'justify-end' : 'justify-start'}`}
                            >
                              <div className={`max-w-md px-4 py-2 rounded-lg ${
                                message.from_me
                                  ? 'bg-blue-500 text-white rounded-br-sm'
                                  : 'bg-gray-100 text-gray-900 rounded-bl-sm'
                              }`}>
                                {!message.from_me && message.sender_name && (
                                  <p className="text-xs font-medium mb-1 opacity-70">
                                    {message.sender_name}
                                  </p>
                                )}
                                <p className="text-sm whitespace-pre-wrap break-words">{message.content}</p>
                                
                                {/* Status da mensagem - só aparece para mensagens enviadas por mim */}
                                {message.from_me && (
                                  <MessageStatus 
                                    status={getMessageStatus(message.message_id)}
                                    timestamp={message.timestamp}
                                    fromMe={message.from_me}
                                  />
                                )}
                                
                                {message.is_ai_response && (
                                  <div className="mt-1">
                                    <Badge variant="secondary" className="text-xs">
                                      🤖 IA
                                    </Badge>
                                  </div>
                                )}
                              </div>
                            </div>
                          ))
                        )}
                        
                        {/* Indicador de digitação do assistente */}
                        {assistantTyping && (
                          <div className="flex justify-start">
                            <TypingIndicator 
                              isTyping={true}
                              isRecording={false}
                              senderName="Assistente"
                            />
                          </div>
                        )}
                        
                        {/* Indicador de digitação do contato (do WhatsApp) */}
                        {selectedTicket && isContactTyping(selectedTicket.chat_id) && (
                          <div className="flex justify-start">
                            <TypingIndicator 
                              isTyping={true}
                              isRecording={false}
                              senderName={getTypingContact(selectedTicket.chat_id) || "Contato"}
                            />
                          </div>
                        )}
                        
                        <div ref={messagesEndRef} />
                      </div>
                    </ScrollArea>

                    {/* Input de Mensagem - Enhanced */}
                    <div className="border-t p-4">
                      <div className="flex space-x-2">
                        <Button variant="ghost" size="sm">
                          <Paperclip className="w-4 h-4" />
                        </Button>
                        <Input
                          placeholder="Digite sua mensagem..."
                          value={newMessage}
                          onChange={handleInputChange}
                          onKeyPress={async (e) => {
                            if (e.key === 'Enter') {
                              await handleSendMessage();
                            }
                          }}
                          onBlur={handleInputBlur}
                          className="flex-1"
                        />
                        <Button 
                          onClick={handleSendMessage} 
                          disabled={!newMessage.trim()} 
                          size="sm"
                        >
                          <Send className="w-4 h-4" />
                        </Button>
                      </div>
                      
                      {/* Indicador de digitação do usuário */}
                      {isTyping && (
                        <div className="mt-2 flex justify-end">
                          <TypingIndicator 
                            isTyping={true}
                            isRecording={isRecording}
                            senderName="Você"
                          />
                        </div>
                      )}
                    </div>
                  </>
                ) : (
                  // Notas Internas
                  <>
                    <ScrollArea className="flex-1 p-4">
                      <div className="space-y-4">
                        {selectedTicket.internal_notes.length === 0 ? (
                          <div className="text-center text-gray-500 py-8">
                            <FileText className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                            <p className="text-sm">Nenhuma nota interna</p>
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
                          <Button onClick={handleAddInternalNote} disabled={!internalNote.trim()} size="sm">
                            <FileText className="w-4 h-4 mr-2" />
                            Adicionar Nota
                          </Button>
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center text-gray-500">
                <MessageSquare className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                <h3 className="text-lg font-medium mb-2">
                  {activeTab === "tickets" ? "Selecione um ticket" : "Área de Contatos"}
                </h3>
                <p className="text-sm">
                  {activeTab === "tickets" 
                    ? "Escolha um ticket da lista para visualizar a conversa" 
                    : "Gerencie seus contatos e informações de clientes"
                  }
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TicketChatInterface;
