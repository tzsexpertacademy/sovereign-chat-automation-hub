
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Search, 
  Users, 
  MessageSquare, 
  Sparkles, 
  Trash2, 
  RefreshCw,
  UserCheck,
  Phone,
  Clock,
  ChevronRight,
  Loader2
} from 'lucide-react';
import { modernContactsService, ModernContact, ContactsStats as ContactsStatsType } from '@/services/modernContactsService';
import { useContactsCache } from '@/hooks/useContactsCache';
import { useToast } from '@/hooks/use-toast';
import ContactCard from './contacts/ContactCard';
import ContactsStatsComponent from './contacts/ContactsStats';
import ContactsFilters from './contacts/ContactsFilters';

interface ModernContactsInterfaceProps {
  clientId: string;
}

const ModernContactsInterface = ({ clientId }: ModernContactsInterfaceProps) => {
  const [contacts, setContacts] = useState<ModernContact[]>([]);
  const [stats, setStats] = useState<ContactsStatsType>({ total: 0, withConversations: 0, active: 0, needsNameUpdate: 0 });
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState<'all' | 'with_conversation' | 'without_conversation' | 'active'>('all');
  
  const { 
    optimizeContactNames, 
    performFullCleanup, 
    isOptimizing,
    getDisplayName 
  } = useContactsCache(clientId);
  
  const { toast } = useToast();

  // Carregar contatos
  const loadContacts = async () => {
    if (!clientId) return;

    try {
      setIsLoading(true);
      
      const [contactsData, statsData] = await Promise.all([
        modernContactsService.getContacts(clientId, {
          search: searchTerm,
          filter,
          limit: 100
        }),
        modernContactsService.getContactsStats(clientId)
      ]);

      setContacts(contactsData);
      setStats(statsData);

      console.log('📊 [MODERN-CONTACTS] Carregados:', {
        contacts: contactsData.length,
        stats: statsData
      });

    } catch (error) {
      console.error('❌ [MODERN-CONTACTS] Erro ao carregar:', error);
      toast({
        title: "Erro",
        description: "Erro ao carregar contatos",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Carregar quando clientId, search ou filter mudarem
  useEffect(() => {
    const timeoutId = setTimeout(loadContacts, 300);
    return () => clearTimeout(timeoutId);
  }, [clientId, searchTerm, filter]);

  // Corrigir nomes automaticamente
  const handleFixNames = async () => {
    try {
      await optimizeContactNames();
      await loadContacts(); // Recarregar após otimização
    } catch (error) {
      console.error('❌ [FIX-NAMES] Erro:', error);
    }
  };

  // Limpeza completa
  const handleFullCleanup = async () => {
    try {
      await performFullCleanup();
      await loadContacts(); // Recarregar após limpeza
    } catch (error) {
      console.error('❌ [FULL-CLEANUP] Erro:', error);
    }
  };

  const filteredContacts = contacts.filter(contact => {
    if (!searchTerm) return true;
    const searchLower = searchTerm.toLowerCase();
    return (
      contact.name.toLowerCase().includes(searchLower) ||
      contact.phone.includes(searchTerm)
    );
  });

  return (
    <div className="h-full flex flex-col space-y-4">
      {/* Header com Estatísticas */}
      <div className="flex-shrink-0">
        <ContactsStatsComponent stats={{
          total: stats.total,
          withConversations: stats.withConversations,
          withoutConversations: stats.total - stats.withConversations,
          totalMessages: 0,
          activeToday: stats.active,
          newThisWeek: 0
        }} />
      </div>

      {/* Controles */}
      <div className="flex-shrink-0 space-y-4">
        {/* Busca */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
          <Input
            placeholder="Buscar contatos por nome ou telefone..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Filtros e Ações */}
        <div className="flex flex-wrap gap-2 items-center justify-between">
          <div className="flex gap-2">
            <Button
              variant={filter === 'all' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilter('all')}
            >
              Todos
            </Button>
            <Button
              variant={filter === 'with_conversation' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilter('with_conversation')}
            >
              Com Conversa
            </Button>
            <Button
              variant={filter === 'without_conversation' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilter('without_conversation')}
            >
              Sem Conversa
            </Button>
            <Button
              variant={filter === 'active' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilter('active')}
            >
              Ativos
            </Button>
          </div>
          
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={loadContacts}
              disabled={isLoading}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
              Atualizar
            </Button>
            
            <Button
              variant="outline"
              size="sm"
              onClick={handleFixNames}
              disabled={isOptimizing}
            >
              {isOptimizing ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4 mr-2" />
              )}
              Corrigir Nomes
            </Button>
            
            <Button
              variant="outline"
              size="sm"
              onClick={handleFullCleanup}
              disabled={isOptimizing}
            >
              {isOptimizing ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4 mr-2" />
              )}
              Limpar Base
            </Button>
          </div>
        </div>
      </div>

      {/* Lista de Contatos */}
      <div className="flex-1 min-h-0">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
              <p className="text-muted-foreground">Carregando contatos...</p>
            </div>
          </div>
        ) : filteredContacts.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center text-muted-foreground">
              <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-medium">Nenhum contato encontrado</p>
              <p className="text-sm">
                {searchTerm 
                  ? "Tente ajustar sua busca ou filtros"
                  : "Quando você receber mensagens, os contatos aparecerão aqui"
                }
              </p>
            </div>
          </div>
        ) : (
          <div className="h-full overflow-auto">
            <div className="space-y-2 p-1">
              {filteredContacts.map((contact) => (
                <ContactCard
                  key={contact.id}
                  contact={{
                    id: contact.id,
                    name: contact.name,
                    phone: contact.phone,
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                  }}
                  ticketInfo={contact.hasConversation ? {
                    id: contact.ticketId || '',
                    messagesCount: 1,
                    lastMessage: contact.lastMessage,
                    lastMessageAt: contact.lastMessageTime,
                    status: contact.ticketStatus || 'open'
                  } : undefined}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Footer com Resumo */}
      {filteredContacts.length > 0 && (
        <div className="flex-shrink-0 text-center text-sm text-muted-foreground py-2 border-t">
          Exibindo {filteredContacts.length} de {contacts.length} contatos
          {searchTerm && ` para "${searchTerm}"`}
        </div>
      )}
    </div>
  );
};

export default ModernContactsInterface;
