import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { clientPersonalizationService, type PersonalizationRequest } from "@/services/clientPersonalizationService";
import { 
  Palette, 
  Plus, 
  Clock, 
  CheckCircle, 
  AlertCircle, 
  MessageSquare,
  FileUp,
  Target,
  Calendar,
  DollarSign,
  Settings
} from 'lucide-react';

const CATEGORIES = [
  { value: 'funcionalidade', label: 'Nova Funcionalidade', icon: Plus },
  { value: 'integracao', label: 'Integração', icon: Settings },
  { value: 'design', label: 'Personalização Visual', icon: Palette },
  { value: 'relatorio', label: 'Relatório Customizado', icon: FileUp },
  { value: 'automacao', label: 'Automação', icon: Target },
  { value: 'outros', label: 'Outros', icon: AlertCircle }
];

const PRIORITIES = [
  { value: 'baixa', label: 'Baixa', color: 'bg-gray-100 text-gray-800' },
  { value: 'media', label: 'Média', color: 'bg-blue-100 text-blue-800' },
  { value: 'alta', label: 'Alta', color: 'bg-orange-100 text-orange-800' },
  { value: 'critica', label: 'Crítica', color: 'bg-red-100 text-red-800' }
];

const STATUS_CONFIG = {
  aguardando_analise: { label: 'Aguardando Análise', color: 'bg-yellow-100 text-yellow-800', icon: Clock },
  em_analise: { label: 'Em Análise', color: 'bg-blue-100 text-blue-800', icon: AlertCircle },
  orcamento_enviado: { label: 'Orçamento Enviado', color: 'bg-purple-100 text-purple-800', icon: DollarSign },
  aprovada: { label: 'Aprovada', color: 'bg-green-100 text-green-800', icon: CheckCircle },
  rejeitada: { label: 'Rejeitada', color: 'bg-red-100 text-red-800', icon: AlertCircle },
  concluida: { label: 'Concluída', color: 'bg-emerald-100 text-emerald-800', icon: CheckCircle }
};

export default function ClientPersonalization() {
  const { clientId } = useParams();
  const { toast } = useToast();
  const [requests, setRequests] = useState<PersonalizationRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  
  const [formData, setFormData] = useState({
    title: '',
    category: '',
    priority: 'media',
    description: '',
    business_impact: '',
    deadline: '',
    budget_estimate: '',
    technical_requirements: ''
  });

  useEffect(() => {
    if (clientId) {
      loadRequests();
    }
  }, [clientId]);

  const loadRequests = async () => {
    try {
      setLoading(true);
      const data = await clientPersonalizationService.getClientRequests(clientId!);
      setRequests((data || []) as PersonalizationRequest[]);
    } catch (error) {
      console.error('Erro ao carregar solicitações:', error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar suas solicitações.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.title || !formData.category || !formData.description) {
      toast({
        title: "Campos obrigatórios",
        description: "Por favor, preencha todos os campos obrigatórios.",
        variant: "destructive",
      });
      return;
    }

    try {
      setLoading(true);
      await clientPersonalizationService.createRequest(clientId!, formData);
      
      toast({
        title: "Solicitação enviada!",
        description: "Sua solicitação foi enviada com sucesso. Nossa equipe entrará em contato em breve.",
      });
      
      setFormData({
        title: '',
        category: '',
        priority: 'media',
        description: '',
        business_impact: '',
        deadline: '',
        budget_estimate: '',
        technical_requirements: ''
      });
      setShowForm(false);
      loadRequests();
    } catch (error) {
      console.error('Erro ao enviar solicitação:', error);
      toast({
        title: "Erro",
        description: "Não foi possível enviar sua solicitação. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

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
        {/* Modern Header */}
        <div className="relative overflow-hidden rounded-xl bg-gradient-to-r from-primary/10 via-secondary/5 to-accent/10 p-4 lg:p-6 border border-border/50 backdrop-blur-sm">
          <div className="absolute inset-0 bg-grid-white/[0.02] bg-[size:60px_60px]" />
          <div className="relative text-center space-y-3">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium">
              <Palette className="h-4 w-4" />
              Personalização
            </div>
            <h1 className="text-3xl lg:text-4xl font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
              Solicite Personalizações
            </h1>
            <p className="text-muted-foreground text-sm lg:text-base max-w-2xl mx-auto">
              Envie suas ideias e necessidades. Nossa equipe desenvolverá soluções personalizadas para sua empresa.
            </p>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-100 text-blue-600">
                  <FileUp className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total</p>
                  <p className="text-2xl font-bold">{requests.length}</p>
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
                  <p className="text-2xl font-bold">
                    {requests.filter(r => ['aguardando_analise', 'em_analise'].includes(r.status)).length}
                  </p>
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
                  <p className="text-2xl font-bold">
                    {requests.filter(r => r.status === 'aprovada').length}
                  </p>
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
                  <p className="text-2xl font-bold">
                    {requests.filter(r => r.status === 'concluida').length}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Action Button */}
        <div className="flex justify-center">
          <Button 
            onClick={() => setShowForm(true)} 
            size="lg" 
            className="bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70"
          >
            <Plus className="h-5 w-5 mr-2" />
            Nova Solicitação
          </Button>
        </div>

        {/* Form Modal */}
        {showForm && (
          <Card className="border-border/50 bg-card/95 backdrop-blur-sm">
            <CardHeader>
              <CardTitle>Nova Solicitação de Personalização</CardTitle>
              <CardDescription>
                Preencha os detalhes da sua solicitação para que nossa equipe possa entender e desenvolver a melhor solução.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="title">Título da Solicitação *</Label>
                    <Input
                      id="title"
                      value={formData.title}
                      onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                      placeholder="Ex: Integração com sistema de vendas"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="category">Categoria *</Label>
                    <Select value={formData.category} onValueChange={(value) => setFormData(prev => ({ ...prev, category: value }))}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione a categoria" />
                      </SelectTrigger>
                      <SelectContent>
                        {CATEGORIES.map((cat) => (
                          <SelectItem key={cat.value} value={cat.value}>
                            <div className="flex items-center gap-2">
                              <cat.icon className="h-4 w-4" />
                              {cat.label}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="priority">Prioridade</Label>
                    <Select value={formData.priority} onValueChange={(value) => setFormData(prev => ({ ...prev, priority: value }))}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {PRIORITIES.map((priority) => (
                          <SelectItem key={priority.value} value={priority.value}>
                            {priority.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="deadline">Deadline Desejado</Label>
                    <Input
                      id="deadline"
                      type="date"
                      value={formData.deadline}
                      onChange={(e) => setFormData(prev => ({ ...prev, deadline: e.target.value }))}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Descrição Detalhada *</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Descreva detalhadamente o que você precisa, como funciona atualmente e como gostaria que funcionasse..."
                    rows={4}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="business_impact">Impacto no Negócio</Label>
                  <Textarea
                    id="business_impact"
                    value={formData.business_impact}
                    onChange={(e) => setFormData(prev => ({ ...prev, business_impact: e.target.value }))}
                    placeholder="Como essa personalização irá impactar positivamente seu negócio?"
                    rows={2}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="budget_estimate">Orçamento Disponível</Label>
                    <Input
                      id="budget_estimate"
                      value={formData.budget_estimate}
                      onChange={(e) => setFormData(prev => ({ ...prev, budget_estimate: e.target.value }))}
                      placeholder="Ex: R$ 5.000 - R$ 10.000"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="technical_requirements">Observações Técnicas</Label>
                    <Input
                      id="technical_requirements"
                      value={formData.technical_requirements}
                      onChange={(e) => setFormData(prev => ({ ...prev, technical_requirements: e.target.value }))}
                      placeholder="Requisitos técnicos especiais"
                    />
                  </div>
                </div>

                <Separator />

                <div className="flex gap-3 justify-end">
                  <Button type="button" variant="outline" onClick={() => setShowForm(false)}>
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={loading}>
                    {loading ? 'Enviando...' : 'Enviar Solicitação'}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        {/* Requests List */}
        <div className="space-y-4">
          <h2 className="text-xl font-semibold">Suas Solicitações</h2>
          
          {loading ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">Carregando solicitações...</p>
            </div>
          ) : requests.length === 0 ? (
            <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
              <CardContent className="text-center py-8">
                <Palette className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground mb-4">
                  Você ainda não fez nenhuma solicitação de personalização.
                </p>
                <Button onClick={() => setShowForm(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Fazer primeira solicitação
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {requests.map((request) => {
                const statusInfo = STATUS_CONFIG[request.status as keyof typeof STATUS_CONFIG];
                const categoryInfo = CATEGORIES.find(c => c.value === request.category);
                const priorityInfo = PRIORITIES.find(p => p.value === request.priority);
                
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
                              {categoryInfo?.icon && <categoryInfo.icon className="h-3 w-3 mr-1" />}
                              {categoryInfo?.label}
                            </Badge>
                            <Badge variant="outline" className={priorityInfo?.color}>
                              {priorityInfo?.label}
                            </Badge>
                          </div>
                        </div>
                        <div className="text-right text-sm text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {formatDate(request.created_at)}
                          </div>
                        </div>
                      </div>
                      
                      <p className="text-muted-foreground mb-4 line-clamp-2">
                        {request.description}
                      </p>
                      
                      {request.business_impact && (
                        <div className="bg-muted/50 rounded-lg p-3 mb-4">
                          <p className="text-sm">
                            <span className="font-medium">Impacto no negócio:</span> {request.business_impact}
                          </p>
                        </div>
                      )}
                      
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
                        
                        <Button variant="outline" size="sm">
                          <MessageSquare className="h-4 w-4 mr-2" />
                          Comentários
                        </Button>
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