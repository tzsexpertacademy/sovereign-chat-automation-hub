
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Search, 
  Users, 
  MessageSquare, 
  RefreshCw, 
  Settings, 
  Filter,
  Phone,
  Clock,
  CheckCircle,
  AlertCircle,
  Trash2,
  Sparkles
} from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { modernContactsService, ModernContact, ContactsStats } from "@/services/modernContactsService";

interface ModernContactsInterfaceProps {
  clientId: string;
}

const ModernContactsInterface = ({ clientId }: ModernContactsInterfaceProps) => {
  const [contacts, setContacts] = useState<ModernContact[]>([]);
  const [stats, setStats] = useState<ContactsStats>({ total: 0, withConversations: 0, active: 0, needsNameUpdate: 0 });
  const [searchTerm, setSearchTerm] = useState("");
  const [filter, setFilter] = useState<'all' | 'with_conversation' | 'without_conversation' | 'active'>('all');
  const [loading, setLoading] = useState(false);
  const [fixingNames, setFixingNames] = useState(false);
  const [removingDuplicates, setRemovingDuplicates] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadContacts();
    loadStats();
  }, [clientId, filter, searchTerm]);

  const loadContacts = async () => {
    try {
      setLoading(true);
      const contactsData = await modernContactsService.getContacts(clientId, {
        search: searchTerm || undefined,
        filter: filter,
        limit: 100
      });
      setContacts(contactsData);
    } catch (error: any) {
      console.error('Erro ao carregar contatos:', error);
      toast({
        title: "Erro",
        description: "Falha ao carregar contatos",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const statsData = await modernContactsService.getContactsStats(clientId);
      setStats(statsData);
    } catch (error) {
      console.error('Erro ao carregar estatísticas:', error);
    }
  };

  const handleFixNames = async () => {
    try {
      setFixingNames(true);
      
      toast({
        title: "Corrigindo nomes...",
        description: "Analisando conversas para extrair nomes reais",
      });

      const result = await modernContactsService.fixContactNames(clientId);

      toast({
        title: "Correção concluída",
        description: `${result.updated} nomes corrigidos, ${result.errors} erros`,
      });

      // Recarregar dados
      await Promise.all([loadContacts(), loadStats()]);

    } catch (error: any) {
      toast({
        title: "Erro na correção",
        description: error.message || "Falha ao corrigir nomes",
        variant: "destructive",
      });
    } finally {
      setFixingNames(false);
    }
  };

  const handleRemoveDuplicates = async () => {
    try {
      setRemovingDuplicates(true);

      toast({
        title: "Removendo duplicatas...",
        description: "Identificando e removendo contatos duplicados",
      });

      const result = await modernContactsService.removeDuplicates(clientId);

      toast({
        title: "Limpeza concluída",
        description: `${result.removed} duplicatas removidas, ${result.kept} contatos mantidos`,
      });

      // Recarregar dados
      await Promise.all([loadContacts(), loadStats()]);

    } catch (error: any) {
      toast({
        title: "Erro na limpeza",
        description: error.message || "Falha ao remover duplicatas",
        variant: "destructive",
      });
    } finally {
      setRemovingDuplicates(false);
    }
  };

  const getConfidenceColor = (confidence: string) => {
    switch (confidence) {
      case 'high': return 'bg-green-100 text-green-800';
      case 'medium': return 'bg-yellow-100 text-yellow-800';
      case 'low': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getConfidenceIcon = (confidence: string) => {
    switch (confidence) {
      case 'high': return <CheckCircle className="w-3 h-3" />;
      case 'medium': return <AlertCircle className="w-3 h-3" />;
      case 'low': return <AlertCircle className="w-3 h-3" />;
      default: return null;
    }
  };

  const formatTime = (timestamp?: string) => {
    if (!timestamp) return 'Nunca';
    return new Date(timestamp).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatPhone = (phone: string) => {
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length === 13 && cleaned.startsWith('55')) {
      const ddd = cleaned.substring(2, 4);
      const number = cleaned.substring(4);
      if (number.length === 9) {
        return `(${ddd}) ${number.substring(0, 5)}-${number.substring(5)}`;
      }
    } else if (cleaned.length === 11) {
      const ddd = cleaned.substring(0, 2);
      const number = cleaned.substring(2);
      return `(${ddd}) ${number.substring(0, 5)}-${number.substring(5)}`;
    }
    return phone;
  };

  return (
    <div className="space-y-6">
      {/* Header com Estatísticas */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold">{stats.total}</p>
                <p className="text-sm text-muted-foreground">Total</p>
              </div>
              <Users className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold">{stats.withConversations}</p>
                <p className="text-sm text-muted-foreground">Com Conversa</p>
              </div>
              <MessageSquare className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold">{stats.active}</p>
                <p className="text-sm text-muted-foreground">Ativos</p>
              </div>
              <CheckCircle className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold">{stats.needsNameUpdate}</p>
                <p className="text-sm text-muted-foreground">Precisam Correção</p>
              </div>
              <AlertCircle className="h-8 w-8 text-orange-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Controles */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Contatos Modernos
              </CardTitle>
              <CardDescription>
                Gestão inteligente de contatos com nomes reais extraídos das conversas
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                size="sm"
                onClick={handleFixNames}
                disabled={fixingNames}
              >
                {fixingNames ? (
                  <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-1" />
                ) : (
                  <Sparkles className="w-4 h-4 mr-1" />
                )}
                Corrigir Nomes
              </Button>
              <Button 
                variant="outline" 
                size="sm"
                onClick={handleRemoveDuplicates}
                disabled={removingDuplicates}
              >
                {removingDuplicates ? (
                  <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-1" />
                ) : (
                  <Trash2 className="w-4 h-4 mr-1" />
                )}
                Limpar Duplicatas
              </Button>
              <Button 
                variant="outline" 
                size="sm"
                onClick={loadContacts}
                disabled={loading}
              >
                <RefreshCw className={`w-4 h-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
                Atualizar
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input 
                placeholder="Buscar por nome ou telefone..." 
                className="pl-10"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            
            <Select value={filter} onValueChange={(value: any) => setFilter(value)}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Filtrar contatos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="with_conversation">Com Conversa</SelectItem>
                <SelectItem value="without_conversation">Sem Conversa</SelectItem>
                <SelectItem value="active">Ativos</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <ScrollArea className="h-[600px]">
            {loading ? (
              <div className="flex items-center justify-center h-32">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : contacts.length === 0 ? (
              <div className="text-center py-12">
                <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">Nenhum contato encontrado</h3>
                <p className="text-gray-600">
                  {searchTerm || filter !== 'all' 
                    ? "Nenhum contato corresponde aos filtros aplicados"
                    : "Importe conversas para ver seus contatos aqui"
                  }
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {contacts.map((contact) => (
                  <Card key={contact.id} className="hover:shadow-md transition-shadow">
                    <CardContent className="pt-4">
                      <div className="flex items-center space-x-4">
                        <Avatar className="w-12 h-12">
                          <AvatarFallback className="bg-gradient-to-br from-blue-400 to-purple-500 text-white">
                            {contact.name.charAt(0).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1">
                            <h3 className="font-medium text-gray-900 truncate">
                              {contact.name}
                            </h3>
                            <div className="flex items-center gap-2">
                              <Badge className={`text-xs ${getConfidenceColor(contact.confidence)}`}>
                                {getConfidenceIcon(contact.confidence)}
                                <span className="ml-1">
                                  {contact.confidence === 'high' ? 'Nome Real' : 
                                   contact.confidence === 'medium' ? 'Provável' : 'Telefone'}
                                </span>
                              </Badge>
                              {contact.hasConversation && (
                                <Badge variant={contact.isActive ? "default" : "secondary"} className="text-xs">
                                  <MessageSquare className="w-3 h-3 mr-1" />
                                  {contact.isActive ? 'Ativo' : 'Conversa'}
                                </Badge>
                              )}
                            </div>
                          </div>
                          
                          <div className="flex items-center text-sm text-gray-600 mb-2">
                            <Phone className="w-3 h-3 mr-1" />
                            <span>{formatPhone(contact.phone)}</span>
                          </div>
                          
                          {contact.lastMessage && (
                            <p className="text-sm text-gray-600 truncate mb-2">
                              {contact.lastMessage}
                            </p>
                          )}
                          
                          {contact.lastMessageTime && (
                            <div className="flex items-center text-xs text-gray-500">
                              <Clock className="w-3 h-3 mr-1" />
                              <span>Última atividade: {formatTime(contact.lastMessageTime)}</span>
                            </div>
                          )}
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

export default ModernContactsInterface;
