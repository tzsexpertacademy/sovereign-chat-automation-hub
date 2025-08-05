import { useState, useEffect, useMemo } from "react";
import { useParams } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MessageSquare, RefreshCw, Download, CheckCircle, Activity, Settings } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { useTicketRealtimeImproved } from "@/hooks/useTicketRealtimeImproved";
import { useTicketFilters } from "@/hooks/useTicketFilters";
import { useTicketRealtimeSync } from "@/hooks/useTicketRealtimeSync";
import { incrementalImportService } from "@/services/incrementalImportService";
import TicketChatInterface from "./TicketChatInterface";
import SystemHealthIndicator from "./SystemHealthIndicator";
import TicketActionsMenu from "./TicketActionsMenu";
import TicketFiltersBar from "./TicketFiltersBar";

const TicketTabsInterface = () => {
  const { clientId } = useParams<{ clientId: string }>();
  const { toast } = useToast();
  const [selectedTicket, setSelectedTicket] = useState<string>("");
  const [isImporting, setIsImporting] = useState(false);
  const [activeTab, setActiveTab] = useState<"open" | "closed">("open");

  // Hook de tempo real aprimorado
  const { 
    tickets, 
    isLoading, 
    syncStatus, 
    lastSyncTime,
    reloadTickets, 
    forceSyncMessages 
  } = useTicketRealtimeImproved(clientId || '');

  // Hook de filtros avançados
  const {
    filters,
    availableQueues,
    availableInstances,
    updateFilter,
    clearFilters,
    activeFiltersCount,
    hasActiveFilters
  } = useTicketFilters(clientId || '');

  // Hook de sincronização de tickets em tempo real
  useTicketRealtimeSync({
    clientId: clientId || '',
    onTicketUpdate: () => {
      console.log('🔄 [TABS] Forçando reload de tickets por mudança detectada');
      reloadTickets();
    },
    onTicketReopen: (ticketId, newQueueId) => {
      console.log('🔓 [TABS] Ticket reaberto:', { ticketId, newQueueId });
      // Forçar mudança para aba "Abertos" se um ticket foi reaberto
      if (activeTab === 'closed') {
        setActiveTab('open');
      }
      reloadTickets();
    },
    onQueueTransfer: (ticketId, fromQueueId, toQueueId) => {
      console.log('🔄 [TABS] Ticket transferido:', { ticketId, fromQueueId, toQueueId });
      reloadTickets();
    }
  });

  // Filtrar tickets com base nos filtros aplicados
  const filteredTickets = useMemo(() => {
    let statusFilter: string[] = [];
    
    if (activeTab === "open") {
      statusFilter = ["open", "pending"];
    } else {
      statusFilter = ["closed", "resolved"];
    }

    return tickets.filter(ticket => {
      // Filtro por status (aba)
      const matchesStatus = statusFilter.includes(ticket.status);
      
      // Filtro por busca de texto
      const matchesSearch = !filters.search || (
        ticket.title.toLowerCase().includes(filters.search.toLowerCase()) ||
        ticket.customer?.name?.toLowerCase().includes(filters.search.toLowerCase()) ||
        ticket.last_message_preview?.toLowerCase().includes(filters.search.toLowerCase()) ||
        ticket.customer?.phone?.includes(filters.search)
      );
      
      // Filtro por fila
      const matchesQueue = filters.queues.length === 0 || 
        filters.queues.includes(ticket.assigned_queue_id || '');
      
      // Filtro por instância
      const matchesInstance = filters.instances.length === 0 ||
        filters.instances.some(instanceId => {
          // Encontrar a instância no availableInstances e comparar com ticket.instance_id
          const instance = availableInstances.find(i => i.value === instanceId);
          return instance && ticket.instance_id;
        });
      
      // Filtro por período
      const matchesPeriod = (() => {
        if (filters.period === 'all') return true;
        
        const ticketDate = new Date(ticket.last_message_at);
        const now = new Date();
        const diffDays = Math.floor((now.getTime() - ticketDate.getTime()) / (1000 * 60 * 60 * 24));
        
        switch (filters.period) {
          case '7d': return diffDays <= 7;
          case '30d': return diffDays <= 30;
          case '90d': return diffDays <= 90;
          default: return true;
        }
      })();
      
      return matchesStatus && matchesSearch && matchesQueue && matchesInstance && matchesPeriod;
    });
  }, [tickets, activeTab, filters, availableInstances]);

  // Contar tickets por status
  const openTicketsCount = tickets.filter(t => ['open', 'pending'].includes(t.status)).length;
  const closedTicketsCount = tickets.filter(t => ['closed', 'resolved'].includes(t.status)).length;

  const handleSmartImport = async () => {
    if (!clientId || isImporting) return;
    
    setIsImporting(true);
    try {
      toast({
        title: "🚀 Importação Inteligente",
        description: "Importando apenas mensagens novas com retry automático...",
      });

      const result = await incrementalImportService.performImportWithRetry(clientId, 3);
      
      toast({
        title: "✅ Importação Concluída",
        description: `${result.imported} mensagens novas importadas. ${result.errors > 0 ? `${result.errors} erros.` : ''}`,
      });

      // Recarregar após pequeno delay para sincronização
      setTimeout(() => {
        reloadTickets();
        forceSyncMessages();
      }, 2000);

    } catch (error: any) {
      console.error('❌ [UI] Erro na importação inteligente:', error);
      toast({
        title: "❌ Erro na Importação",
        description: error.message || "Erro ao importar mensagens",
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

  const getSyncStatusColor = () => {
    switch (syncStatus) {
      case 'success': return 'text-green-600';
      case 'syncing': return 'text-blue-600';
      case 'error': return 'text-red-600';
      default: return 'text-gray-600';
    }
  };

  const getSyncStatusLabel = () => {
    switch (syncStatus) {
      case 'success': return 'Sincronizado';
      case 'syncing': return 'Sincronizando';
      case 'error': return 'Erro na Sincronização';
      default: return 'Iniciando';
    }
  };

  const handleTicketUpdate = () => {
    reloadTickets();
  };

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
            <Activity className={`w-4 h-4 ${getSyncStatusColor()}`} />
            <span className={`text-sm font-medium ${getSyncStatusColor()}`}>
              {getSyncStatusLabel()}
            </span>
            {lastSyncTime && (
              <span className="text-xs text-gray-500">
                - {formatTime(lastSyncTime.toISOString())}
              </span>
            )}
          </div>
        </div>
        
        <TicketChatInterface 
          clientId={clientId || ''} 
          ticketId={selectedTicket} 
        />
      </div>
    );
  }

  if (isLoading && tickets.length === 0) {
    return (
      <div className="h-[calc(100vh-8rem)] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Carregando tickets...</p>
          <p className="text-sm text-gray-500 mt-2">Inicializando sistema YUMER...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-8rem)] flex flex-col space-y-4">
      {/* Status do Sistema - Horizontal no Topo */}
      <div className="flex-shrink-0">
        <SystemHealthIndicator clientId={clientId || ''} />
      </div>

      {/* Lista de Tickets */}
      <Card className="flex-1 flex flex-col min-h-0">
        <CardHeader className="pb-3">
          <div className="flex justify-between items-center">
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
                Gestão de Tickets
                {(isLoading || isImporting) && <div className="w-4 h-4 border-2 border-green-500 border-t-transparent rounded-full animate-spin"></div>}
              </CardTitle>
              <CardDescription className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <span>Sistema YumerFlow V2</span>
                </div>
                <div className="flex items-center gap-2">
                  <Activity className={`h-4 w-4 ${getSyncStatusColor()}`} />
                  <span className={getSyncStatusColor()}>
                    {getSyncStatusLabel()}
                  </span>
                  {lastSyncTime && (
                    <span className="text-xs text-gray-400">
                      ({formatTime(lastSyncTime.toISOString())})
                    </span>
                  )}
                </div>
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => {
                  console.log('🔄 [REFRESH] Refresh manual da página');
                  window.location.reload();
                }}
                title="⚡ Refresh Completo da Página"
                className="bg-blue-50 hover:bg-blue-100 text-blue-600"
              >
                ⚡ Refresh
              </Button>
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
                onClick={forceSyncMessages}
                disabled={isImporting}
                title="Forçar sincronização YUMER"
              >
                <Settings className="w-4 h-4" />
              </Button>
              <Button 
                variant="secondary" 
                size="sm"
                onClick={handleSmartImport}
                disabled={isImporting}
                title="Importação inteligente com retry automático"
              >
                {isImporting ? (
                  <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-1" />
                ) : (
                  <Download className="w-4 h-4 mr-1" />
                )}
                {isImporting ? 'Importando...' : 'Import Smart'}
              </Button>
            </div>
          </div>
          
          <div className="space-y-3">
            <TicketFiltersBar
              filters={filters}
              availableQueues={availableQueues}
              availableInstances={availableInstances}
              onUpdateFilter={updateFilter}
              onClearFilters={clearFilters}
              activeFiltersCount={activeFiltersCount}
            />
          </div>
        </CardHeader>
        
        <CardContent className="flex-1 p-0">
          <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as "open" | "closed")} className="h-full">
            <div className="px-4 pb-2">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="open" className="flex items-center gap-2">
                  Tickets Abertos
                  {openTicketsCount > 0 && (
                    <Badge variant="secondary" className="ml-1 bg-green-100 text-green-700">
                      {openTicketsCount}
                    </Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger value="closed" className="flex items-center gap-2">
                  Tickets Fechados
                  {closedTicketsCount > 0 && (
                    <Badge variant="secondary" className="ml-1 bg-gray-100 text-gray-700">
                      {closedTicketsCount}
                    </Badge>
                  )}
                </TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="open" className="h-[calc(100%-3rem)] mt-0">
              <ScrollArea className="h-full">
                {filteredTickets.length === 0 ? (
                  <div className="p-4 text-center text-gray-500">
                    <MessageSquare className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                    <p>Nenhum ticket aberto encontrado</p>
                    <p className="text-sm">
                      {openTicketsCount === 0 
                        ? "Todos os tickets estão fechados ou resolvidos"
                        : hasActiveFilters 
                          ? "Nenhum ticket corresponde aos filtros aplicados"
                          : "Nenhum ticket aberto no momento"
                      }
                    </p>
                    {hasActiveFilters && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={clearFilters}
                        className="mt-2"
                      >
                        Limpar Filtros
                      </Button>
                    )}
                    <Button 
                      size="sm" 
                      variant="outline" 
                      onClick={handleSmartImport}
                      disabled={isImporting}
                      className="mt-2"
                    >
                      {isImporting ? (
                        <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin mr-1" />
                      ) : (
                        <Download className="w-3 h-3 mr-1" />
                      )}
                      {isImporting ? 'Importando...' : 'Importação Inteligente'}
                    </Button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4 p-3 sm:p-4">
                    {filteredTickets.map((ticket) => (
                      <Card
                        key={ticket.id}
                        className="cursor-pointer hover:bg-gray-50 transition-colors relative min-h-[120px]"
                      >
                        <CardContent className="p-4">
                          <div className="absolute top-2 right-2">
                            <TicketActionsMenu 
                              ticket={ticket} 
                              onTicketUpdate={handleTicketUpdate}
                            />
                          </div>
                          
                          <div 
                            className="flex items-start space-x-3"
                            onClick={() => setSelectedTicket(ticket.id)}
                          >
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
                              
                              {ticket.queue && (
                                <div className="flex items-center gap-1 mb-1">
                                  <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full">
                                    📋 {ticket.queue.name}
                                  </span>
                                </div>
                              )}
                              
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
            </TabsContent>

            <TabsContent value="closed" className="h-[calc(100%-3rem)] mt-0">
              <ScrollArea className="h-full">
                {filteredTickets.length === 0 ? (
                  <div className="p-4 text-center text-gray-500">
                    <MessageSquare className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                    <p>Nenhum ticket fechado encontrado</p>
                    <p className="text-sm">
                      {closedTicketsCount === 0 
                        ? "Nenhum ticket foi fechado ainda"
                        : hasActiveFilters
                          ? "Nenhum ticket corresponde aos filtros aplicados"
                          : "Nenhum ticket fechado no período selecionado"
                      }
                    </p>
                    {hasActiveFilters && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={clearFilters}
                        className="mt-2"
                      >
                        Limpar Filtros
                      </Button>
                    )}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4 p-3 sm:p-4">
                    {filteredTickets.map((ticket) => (
                      <Card
                        key={ticket.id}
                        className="cursor-pointer hover:bg-gray-50 transition-colors relative opacity-75 min-h-[120px]"
                      >
                        <CardContent className="p-4">
                          <div className="absolute top-2 right-2">
                            <TicketActionsMenu 
                              ticket={ticket} 
                              onTicketUpdate={handleTicketUpdate}
                            />
                          </div>
                          
                          <div 
                            className="flex items-start space-x-3"
                            onClick={() => setSelectedTicket(ticket.id)}
                          >
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
                              
                              {ticket.queue && (
                                <div className="flex items-center gap-1 mb-1">
                                  <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full">
                                    📋 {ticket.queue.name}
                                  </span>
                                </div>
                              )}
                              
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
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};

export default TicketTabsInterface;