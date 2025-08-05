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
import { useSimpleTicketSync } from "@/hooks/useSimpleTicketSync";
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

  // Hook SIMPLIFICADO de sincronização FORÇA BRUTA  
  useSimpleTicketSync({
    clientId: clientId || '',
    onUpdate: () => {
      console.log('🔄 [TABS] FORÇA BRUTA - reload imediato por mudança');
      reloadTickets();
    },
    onTicketReopen: (ticketId, newQueueId) => {
      console.log('🔓 [TABS] REABERTURA DETECTADA - auto-switch para Abertos');
      setActiveTab('open'); // AUTO-SWITCH crítico
      reloadTickets();
      
      // FEEDBACK VISUAL DE REABERTURA
      toast({
        title: "🔓 Ticket Reaberto",
        description: `Ticket foi reaberto automaticamente por nova mensagem`,
        duration: 4000,
      });
    },
    onAutoSwitchTab: (targetTab) => {
      console.log('🔄 [TABS] AUTO-SWITCH para aba:', targetTab);
      setActiveTab(targetTab);
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
      case 'open': return 'bg-success/10 text-success border-success/20';
      case 'pending': return 'bg-warning/10 text-warning border-warning/20';
      case 'resolved': return 'bg-primary/10 text-primary border-primary/20';
      case 'closed': return 'bg-muted text-muted-foreground border-border';
      default: return 'bg-muted text-muted-foreground border-border';
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
      case 'success': return 'text-success';
      case 'syncing': return 'text-primary';
      case 'error': return 'text-destructive';
      default: return 'text-muted-foreground';
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
      <Card className="flex-1 flex flex-col min-h-0 bg-gradient-to-br from-card to-card/50 border-0 shadow-elegant">
        <CardHeader className="pb-3 bg-gradient-to-r from-primary/5 to-accent/5 border-b border-border/50">
          <div className="flex flex-col lg:flex-row lg:justify-between lg:items-center gap-4">
            <div className="space-y-2">
              <CardTitle className="text-xl flex items-center gap-3 text-foreground">
                <div className="p-2 rounded-lg bg-primary/10">
                  <MessageSquare className="h-5 w-5 text-primary" />
                </div>
                Gestão de Tickets
                {(isLoading || isImporting) && (
                  <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                )}
              </CardTitle>
              <CardDescription className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-success" />
                  <span className="text-muted-foreground">Sistema YumerFlow V2</span>
                </div>
                <div className="flex items-center gap-2">
                  <Activity className={`h-4 w-4 ${getSyncStatusColor()}`} />
                  <span className={`text-sm font-medium ${getSyncStatusColor()}`}>
                    {getSyncStatusLabel()}
                  </span>
                  {lastSyncTime && (
                    <span className="text-xs text-muted-foreground">
                      ({formatTime(lastSyncTime.toISOString())})
                    </span>
                  )}
                </div>
              </CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => {
                  console.log('🔄 [REFRESH] Refresh manual da página');
                  window.location.reload();
                }}
                title="⚡ Refresh Completo da Página"
                className="hover-scale"
              >
                ⚡ Refresh
              </Button>
              <Button 
                variant="outline" 
                size="sm"
                onClick={reloadTickets}
                disabled={isLoading || isImporting}
                title="Recarregar tickets manualmente"
                className="hover-scale"
              >
                <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
              </Button>
              <Button 
                variant="outline" 
                size="sm"
                onClick={forceSyncMessages}
                disabled={isImporting}
                title="Forçar sincronização YUMER"
                className="hover-scale"
              >
                <Settings className="w-4 h-4" />
              </Button>
              <Button 
                variant="secondary" 
                size="sm"
                onClick={handleSmartImport}
                disabled={isImporting}
                title="Importação inteligente com retry automático"
                className="hover-scale bg-gradient-to-r from-primary to-primary/80 text-primary-foreground border-0"
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
              <TabsList className="grid w-full grid-cols-2 bg-muted/50 p-1">
                <TabsTrigger value="open" className="flex items-center gap-2 data-[state=active]:bg-gradient-to-r data-[state=active]:from-success/10 data-[state=active]:to-success/5 data-[state=active]:text-success">
                  Tickets Abertos
                  {openTicketsCount > 0 && (
                    <Badge variant="secondary" className="ml-1 bg-success/20 text-success border-success/30">
                      {openTicketsCount}
                    </Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger value="closed" className="flex items-center gap-2 data-[state=active]:bg-gradient-to-r data-[state=active]:from-muted data-[state=active]:to-muted/50">
                  Tickets Fechados
                  {closedTicketsCount > 0 && (
                    <Badge variant="secondary" className="ml-1 bg-muted text-muted-foreground">
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
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4 p-4">
                    {filteredTickets.map((ticket) => (
                      <Card
                        key={ticket.id}
                        className="group cursor-pointer hover:shadow-lg transition-all duration-300 border-0 bg-gradient-to-br from-card to-card/80 hover:from-card/80 hover:to-card/60 relative overflow-hidden hover-scale"
                      >
                        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                        
                        <CardContent className="p-4 relative">
                          <div className="absolute top-3 right-3 z-10">
                            <TicketActionsMenu 
                              ticket={ticket} 
                              onTicketUpdate={handleTicketUpdate}
                            />
                          </div>
                          
                          <div 
                            className="space-y-3"
                            onClick={() => setSelectedTicket(ticket.id)}
                          >
                            {/* Header com Avatar e Status */}
                            <div className="flex items-start justify-between">
                              <div className="flex items-center space-x-3">
                                <Avatar className="w-12 h-12 border-2 border-primary/20 shadow-md">
                                  <AvatarFallback className="bg-gradient-to-br from-primary to-primary/80 text-primary-foreground font-semibold">
                                    {ticket.customer?.name?.charAt(0) || 'C'}
                                  </AvatarFallback>
                                </Avatar>
                                <div className="min-w-0 flex-1">
                                  <h3 className="font-semibold text-foreground truncate text-sm">
                                    {ticket.customer?.name || ticket.title}
                                  </h3>
                                  <p className="text-xs text-muted-foreground truncate">
                                    {ticket.customer?.phone || 'Sem telefone'}
                                  </p>
                                </div>
                              </div>
                              <Badge className={`text-xs border ${getStatusColor(ticket.status)} font-medium`}>
                                {getStatusLabel(ticket.status)}
                              </Badge>
                            </div>
                            
                            {/* Informações do Ticket */}
                            <div className="space-y-2">
                              {ticket.queue && (
                                <div className="flex items-center gap-2">
                                  <Badge variant="outline" className="text-xs bg-accent/10 text-accent-foreground border-accent/30">
                                    📋 {ticket.queue.name}
                                  </Badge>
                                  {ticket.priority > 1 && (
                                    <Badge variant="destructive" className="text-xs">
                                      Alta P{ticket.priority}
                                    </Badge>
                                  )}
                                </div>
                              )}
                              
                              {ticket.last_message_preview && (
                                <p className="text-sm text-muted-foreground line-clamp-2 leading-relaxed">
                                  {ticket.last_message_preview}
                                </p>
                              )}
                              
                               <div className="flex justify-between items-center text-xs">
                                 <span className="text-muted-foreground">
                                   {formatTime(ticket.last_message_at)}
                                 </span>
                                 <div className="flex items-center gap-1">
                                   {ticket.priority > 2 && (
                                     <Badge variant="outline" className="text-xs bg-warning/10 text-warning">
                                       Urgente
                                     </Badge>
                                   )}
                                 </div>
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
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4 p-4">
                    {filteredTickets.map((ticket) => (
                      <Card
                        key={ticket.id}
                        className="group cursor-pointer hover:shadow-lg transition-all duration-300 border-0 bg-gradient-to-br from-card/60 to-card/40 hover:from-card/50 hover:to-card/30 relative overflow-hidden opacity-80 hover-scale"
                      >
                        <div className="absolute inset-0 bg-gradient-to-br from-muted/10 to-transparent opacity-50" />
                        
                        <CardContent className="p-4 relative">
                          <div className="absolute top-3 right-3 z-10">
                            <TicketActionsMenu 
                              ticket={ticket} 
                              onTicketUpdate={handleTicketUpdate}
                            />
                          </div>
                          
                          <div 
                            className="space-y-3"
                            onClick={() => setSelectedTicket(ticket.id)}
                          >
                            {/* Header com Avatar e Status */}
                            <div className="flex items-start justify-between">
                              <div className="flex items-center space-x-3">
                                <Avatar className="w-12 h-12 border-2 border-muted/30 shadow-md">
                                  <AvatarFallback className="bg-gradient-to-br from-muted to-muted/80 text-muted-foreground font-semibold">
                                    {ticket.customer?.name?.charAt(0) || 'C'}
                                  </AvatarFallback>
                                </Avatar>
                                <div className="min-w-0 flex-1">
                                  <h3 className="font-semibold text-foreground/80 truncate text-sm">
                                    {ticket.customer?.name || ticket.title}
                                  </h3>
                                  <p className="text-xs text-muted-foreground truncate">
                                    {ticket.customer?.phone || 'Sem telefone'}
                                  </p>
                                </div>
                              </div>
                              <Badge className={`text-xs border ${getStatusColor(ticket.status)} font-medium opacity-80`}>
                                {getStatusLabel(ticket.status)}
                              </Badge>
                            </div>
                            
                            {/* Informações do Ticket */}
                            <div className="space-y-2">
                              {ticket.queue && (
                                <div className="flex items-center gap-2">
                                  <Badge variant="outline" className="text-xs bg-muted/20 text-muted-foreground border-muted/40">
                                    📋 {ticket.queue.name}
                                  </Badge>
                                  {ticket.priority > 1 && (
                                    <Badge variant="outline" className="text-xs bg-muted/20 text-muted-foreground">
                                      P{ticket.priority}
                                    </Badge>
                                  )}
                                </div>
                              )}
                              
                              {ticket.last_message_preview && (
                                <p className="text-sm text-muted-foreground/80 line-clamp-2 leading-relaxed">
                                  {ticket.last_message_preview}
                                </p>
                              )}
                              
                              <div className="flex justify-between items-center text-xs">
                                <span className="text-muted-foreground/70">
                                  {formatTime(ticket.last_message_at)}
                                </span>
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