import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { 
  Settings, 
  Eye, 
  MessageSquare, 
  Clock, 
  CheckCircle, 
  AlertCircle, 
  DollarSign,
  Calendar,
  User,
  Building2,
  Search,
  Filter
} from 'lucide-react';

interface PersonalizationRequest {
  id: string;
  client_id: string;
  title: string;
  category: string;
  priority: string;
  description: string;
  business_impact?: string;
  deadline?: string;
  budget_estimate?: string;
  technical_requirements?: any;
  attachments?: any[];
  status: string;
  admin_notes?: string;
  created_at: string;
  updated_at: string;
  completed_at?: string;
  clients?: {
    name: string;
    email: string;
    company?: string;
  };
}

const STATUS_CONFIG = {
  aguardando_analise: { label: 'Aguardando Análise', color: 'bg-yellow-100 text-yellow-800', icon: Clock },
  em_analise: { label: 'Em Análise', color: 'bg-blue-100 text-blue-800', icon: AlertCircle },
  orcamento_enviado: { label: 'Orçamento Enviado', color: 'bg-purple-100 text-purple-800', icon: DollarSign },
  aprovada: { label: 'Aprovada', color: 'bg-green-100 text-green-800', icon: CheckCircle },
  rejeitada: { label: 'Rejeitada', color: 'bg-red-100 text-red-800', icon: AlertCircle },
  concluida: { label: 'Concluída', color: 'bg-emerald-100 text-emerald-800', icon: CheckCircle }
};

const CATEGORIES = {
  funcionalidade: 'Nova Funcionalidade',
  integracao: 'Integração',
  design: 'Personalização Visual',
  relatorio: 'Relatório Customizado',
  automacao: 'Automação',
  outros: 'Outros'
};

const PRIORITIES = {
  baixa: { label: 'Baixa', color: 'bg-gray-100 text-gray-800' },
  media: { label: 'Média', color: 'bg-blue-100 text-blue-800' },
  alta: { label: 'Alta', color: 'bg-orange-100 text-orange-800' },
  critica: { label: 'Crítica', color: 'bg-red-100 text-red-800' }
};

export default function PersonalizationRequestsManager() {
  const { toast } = useToast();
  const [requests, setRequests] = useState<PersonalizationRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [selectedRequest, setSelectedRequest] = useState<PersonalizationRequest | null>(null);
  const [adminNotes, setAdminNotes] = useState('');
  const [newStatus, setNewStatus] = useState('');

  useEffect(() => {
    loadRequests();
  }, []);

  const loadRequests = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('personalization_requests')
        .select(`
          *,
          clients (
            name,
            email,
            company
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setRequests((data || []) as PersonalizationRequest[]);
    } catch (error) {
      console.error('Erro ao carregar solicitações:', error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar as solicitações.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const updateRequestStatus = async () => {
    if (!selectedRequest || !newStatus) return;

    try {
      const updates: any = {
        status: newStatus,
        admin_notes: adminNotes,
        updated_at: new Date().toISOString()
      };

      if (newStatus === 'concluida') {
        updates.completed_at = new Date().toISOString();
      }

      const { error } = await supabase
        .from('personalization_requests')
        .update(updates)
        .eq('id', selectedRequest.id);

      if (error) throw error;

      toast({
        title: "Status atualizado",
        description: "O status da solicitação foi atualizado com sucesso.",
      });

      setSelectedRequest(null);
      setAdminNotes('');
      setNewStatus('');
      loadRequests();
    } catch (error) {
      console.error('Erro ao atualizar status:', error);
      toast({
        title: "Erro",
        description: "Não foi possível atualizar o status.",
        variant: "destructive",
      });
    }
  };

  const filteredRequests = requests.filter(request => {
    const matchesSearch = request.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         request.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         request.clients?.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         request.clients?.company?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = !statusFilter || request.status === statusFilter;
    const matchesCategory = !categoryFilter || request.category === categoryFilter;
    
    return matchesSearch && matchesStatus && matchesCategory;
  });

  const getMetrics = () => {
    return {
      total: requests.length,
      pending: requests.filter(r => ['aguardando_analise', 'em_analise'].includes(r.status)).length,
      approved: requests.filter(r => r.status === 'aprovada').length,
      completed: requests.filter(r => r.status === 'concluida').length
    };
  };

  const metrics = getMetrics();

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/30">
      <div className="max-w-7xl mx-auto p-4 lg:p-6 space-y-6">
        {/* Header */}
        <div className="relative overflow-hidden rounded-xl bg-gradient-to-r from-primary/10 via-secondary/5 to-accent/10 p-4 lg:p-6 border border-border/50 backdrop-blur-sm">
          <div className="absolute inset-0 bg-grid-white/[0.02] bg-[size:60px_60px]" />
          <div className="relative text-center space-y-3">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium">
              <Settings className="h-4 w-4" />
              Admin - Personalizações
            </div>
            <h1 className="text-3xl lg:text-4xl font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
              Gerenciar Solicitações
            </h1>
            <p className="text-muted-foreground text-sm lg:text-base max-w-2xl mx-auto">
              Visualize, analise e gerencie todas as solicitações de personalização dos clientes.
            </p>
          </div>
        </div>

        {/* Metrics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-100 text-blue-600">
                  <Settings className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total</p>
                  <p className="text-2xl font-bold">{metrics.total}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-yellow-100 text-yellow-600">
                  <Clock className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Pendentes</p>
                  <p className="text-2xl font-bold">{metrics.pending}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-green-100 text-green-600">
                  <CheckCircle className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Aprovadas</p>
                  <p className="text-2xl font-bold">{metrics.approved}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-emerald-100 text-emerald-600">
                  <CheckCircle className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Concluídas</p>
                  <p className="text-2xl font-bold">{metrics.completed}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
          <CardContent className="p-4">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar por título, descrição, cliente..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full md:w-48">
                  <SelectValue placeholder="Filtrar por status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Todos os status</SelectItem>
                  {Object.entries(STATUS_CONFIG).map(([key, config]) => (
                    <SelectItem key={key} value={key}>
                      {config.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-full md:w-48">
                  <SelectValue placeholder="Filtrar por categoria" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Todas as categorias</SelectItem>
                  {Object.entries(CATEGORIES).map(([key, label]) => (
                    <SelectItem key={key} value={key}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Requests List */}
        <div className="space-y-4">
          {loading ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">Carregando solicitações...</p>
            </div>
          ) : filteredRequests.length === 0 ? (
            <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
              <CardContent className="text-center py-8">
                <Settings className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">
                  Nenhuma solicitação encontrada com os filtros aplicados.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {filteredRequests.map((request) => {
                const statusInfo = STATUS_CONFIG[request.status as keyof typeof STATUS_CONFIG];
                const priorityInfo = PRIORITIES[request.priority as keyof typeof PRIORITIES];
                
                return (
                  <Card key={request.id} className="border-border/50 bg-card/50 backdrop-blur-sm">
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex-1">
                          <h3 className="font-semibold text-lg mb-2">{request.title}</h3>
                          <div className="flex flex-wrap gap-2 mb-3">
                            <Badge variant="outline" className={statusInfo?.color}>
                              <statusInfo.icon className="h-3 w-3 mr-1" />
                              {statusInfo?.label}
                            </Badge>
                            <Badge variant="outline">
                              {CATEGORIES[request.category as keyof typeof CATEGORIES]}
                            </Badge>
                            <Badge variant="outline" className={priorityInfo?.color}>
                              {priorityInfo?.label}
                            </Badge>
                          </div>
                        </div>
                        <div className="text-right text-sm text-muted-foreground">
                          <div className="flex items-center gap-1 mb-1">
                            <Calendar className="h-3 w-3" />
                            {formatDate(request.created_at)}
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2 mb-3">
                        <User className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">{request.clients?.name}</span>
                        {request.clients?.company && (
                          <>
                            <span className="text-muted-foreground">-</span>
                            <div className="flex items-center gap-1">
                              <Building2 className="h-4 w-4 text-muted-foreground" />
                              <span className="text-muted-foreground">{request.clients.company}</span>
                            </div>
                          </>
                        )}
                      </div>
                      
                      <p className="text-muted-foreground mb-4 line-clamp-2">
                        {request.description}
                      </p>
                      
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          {request.deadline && (
                            <div className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              Deadline: {new Date(request.deadline).toLocaleDateString('pt-BR')}
                            </div>
                          )}
                          {request.budget_estimate && (
                            <div className="flex items-center gap-1">
                              <DollarSign className="h-3 w-3" />
                              {request.budget_estimate}
                            </div>
                          )}
                        </div>
                        
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => {
                                setSelectedRequest(request);
                                setAdminNotes(request.admin_notes || '');
                                setNewStatus(request.status);
                              }}
                            >
                              <Eye className="h-4 w-4 mr-2" />
                              Gerenciar
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                            <DialogHeader>
                              <DialogTitle>{selectedRequest?.title}</DialogTitle>
                              <DialogDescription>
                                Solicitação de {selectedRequest?.clients?.name} - {formatDate(selectedRequest?.created_at || '')}
                              </DialogDescription>
                            </DialogHeader>
                            
                            {selectedRequest && (
                              <div className="space-y-6">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                  <div>
                                    <Label>Cliente</Label>
                                    <p className="text-sm mt-1">{selectedRequest.clients?.name}</p>
                                    <p className="text-xs text-muted-foreground">{selectedRequest.clients?.email}</p>
                                  </div>
                                  <div>
                                    <Label>Categoria</Label>
                                    <p className="text-sm mt-1">{CATEGORIES[selectedRequest.category as keyof typeof CATEGORIES]}</p>
                                  </div>
                                  <div>
                                    <Label>Prioridade</Label>
                                    <p className="text-sm mt-1">{PRIORITIES[selectedRequest.priority as keyof typeof PRIORITIES]?.label}</p>
                                  </div>
                                  <div>
                                    <Label>Orçamento</Label>
                                    <p className="text-sm mt-1">{selectedRequest.budget_estimate || 'Não informado'}</p>
                                  </div>
                                </div>
                                
                                <div>
                                  <Label>Descrição</Label>
                                  <p className="text-sm mt-1 whitespace-pre-wrap">{selectedRequest.description}</p>
                                </div>
                                
                                {selectedRequest.business_impact && (
                                  <div>
                                    <Label>Impacto no Negócio</Label>
                                    <p className="text-sm mt-1 whitespace-pre-wrap">{selectedRequest.business_impact}</p>
                                  </div>
                                )}
                                
                                <Separator />
                                
                                <div className="space-y-4">
                                  <div>
                                    <Label htmlFor="new-status">Atualizar Status</Label>
                                    <Select value={newStatus} onValueChange={setNewStatus}>
                                      <SelectTrigger className="mt-1">
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {Object.entries(STATUS_CONFIG).map(([key, config]) => (
                                          <SelectItem key={key} value={key}>
                                            {config.label}
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  </div>
                                  
                                  <div>
                                    <Label htmlFor="admin-notes">Notas Internas</Label>
                                    <Textarea
                                      id="admin-notes"
                                      value={adminNotes}
                                      onChange={(e) => setAdminNotes(e.target.value)}
                                      placeholder="Adicione observações internas sobre esta solicitação..."
                                      rows={3}
                                      className="mt-1"
                                    />
                                  </div>
                                  
                                  <div className="flex gap-3">
                                    <Button onClick={updateRequestStatus} className="flex-1">
                                      Atualizar Status
                                    </Button>
                                  </div>
                                </div>
                              </div>
                            )}
                          </DialogContent>
                        </Dialog>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}