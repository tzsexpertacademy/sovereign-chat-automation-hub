
import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useContactsCache } from '@/hooks/useContactsCache';
import { ticketsService } from '@/services/ticketsService';
import { supabase } from '@/integrations/supabase/client';
import { contactNameService } from '@/services/contactNameService';
import ContactCard from './contacts/ContactCard';
import ContactsStats from './contacts/ContactsStats';
import ContactsFilters from './contacts/ContactsFilters';
import { 
  RefreshCw, 
  Download,
  Users,
  Loader2,
  UserPlus,
  Wand2
} from 'lucide-react';

interface ContactsManagerProps {
  clientId: string;
}

interface ExtendedContactInfo {
  id: string;
  name: string;
  phone: string;
  email?: string;
  avatar_url?: string;
  last_seen?: string;
  created_at: string;
  updated_at: string;
  ticket?: {
    id: string;
    messagesCount: number;
    lastMessage?: string;
    lastMessageAt?: string;
    status: string;
  };
}

const ContactsManager = ({ clientId }: ContactsManagerProps) => {
  const [contacts, setContacts] = useState<ExtendedContactInfo[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilters, setActiveFilters] = useState<string[]>([]);
  const [isUpdatingNames, setIsUpdatingNames] = useState(false);
  
  const { toast } = useToast();
  const { 
    contacts: cachedContacts, 
    isLoading: cacheLoading, 
    loadContacts: reloadCache,
    forceSync 
  } = useContactsCache(clientId);

  // Carregar contatos com informações de tickets
  const loadContactsWithTickets = async () => {
    if (!clientId) return;
    
    try {
      setIsLoading(true);
      console.log('📱 [CONTACTS] Carregando contatos com tickets para cliente:', clientId);

      // Buscar todos os contatos
      const { data: contactsData, error: contactsError } = await supabase
        .from('customers')
        .select('*')
        .eq('client_id', clientId)
        .order('updated_at', { ascending: false });

      if (contactsError) {
        throw contactsError;
      }

      if (!contactsData || contactsData.length === 0) {
        console.log('📱 [CONTACTS] Nenhum contato encontrado');
        setContacts([]);
        return;
      }

      console.log(`📱 [CONTACTS] ${contactsData.length} contatos encontrados`);

      // Buscar tickets relacionados
      const { data: ticketsData, error: ticketsError } = await supabase
        .from('conversation_tickets')
        .select(`
          id,
          customer_id,
          status,
          last_message_preview,
          last_message_at
        `)
        .eq('client_id', clientId);

      if (ticketsError) {
        console.warn('⚠️ [CONTACTS] Erro ao buscar tickets:', ticketsError);
      }

      // Buscar contagem de mensagens por ticket
      const ticketIds = ticketsData?.map(t => t.id) || [];
      let messagesCount: Record<string, number> = {};

      if (ticketIds.length > 0) {
        const { data: messagesData, error: messagesError } = await supabase
          .from('ticket_messages')
          .select('ticket_id')
          .in('ticket_id', ticketIds);

        if (!messagesError && messagesData) {
          messagesCount = messagesData.reduce((acc, msg) => {
            acc[msg.ticket_id] = (acc[msg.ticket_id] || 0) + 1;
            return acc;
          }, {} as Record<string, number>);
        }
      }

      // Combinar dados
      const extendedContacts: ExtendedContactInfo[] = contactsData.map(contact => {
        const ticket = ticketsData?.find(t => t.customer_id === contact.id);
        
        return {
          id: contact.id,
          name: contact.name,
          phone: contact.phone,
          email: contact.email,
          avatar_url: contact.avatar_url,
          last_seen: contact.last_seen,
          created_at: contact.created_at,
          updated_at: contact.updated_at,
          ticket: ticket ? {
            id: ticket.id,
            messagesCount: messagesCount[ticket.id] || 0,
            lastMessage: ticket.last_message_preview,
            lastMessageAt: ticket.last_message_at,
            status: ticket.status
          } : undefined
        };
      });

      console.log(`✅ [CONTACTS] Dados combinados: ${extendedContacts.length} contatos`);
      setContacts(extendedContacts);

    } catch (error) {
      console.error('❌ [CONTACTS] Erro ao carregar contatos:', error);
      toast({
        title: "Erro ao carregar contatos",
        description: "Não foi possível carregar a lista de contatos",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Atualizar nomes automaticamente
  const updateContactNames = async () => {
    if (!clientId || isUpdatingNames) return;

    try {
      setIsUpdatingNames(true);
      console.log('🔄 [NAMES] Iniciando atualização de nomes de contatos');

      // Buscar contatos que precisam de atualização de nome
      const contactsToUpdate = contacts
        .filter(contact => {
          // Contatos com nomes genéricos (números formatados)
          return contact.name.match(/^\(\d+\)/) || 
                 contact.name.startsWith('Contato ') ||
                 contact.name === contact.phone;
        })
        .map(contact => ({
          phone: contact.phone,
          // Tentar buscar nome na primeira mensagem do ticket
          firstMessage: contact.ticket?.lastMessage
        }));

      if (contactsToUpdate.length === 0) {
        toast({
          title: "Nomes atualizados",
          description: "Todos os contatos já têm nomes válidos",
        });
        return;
      }

      console.log(`🔄 [NAMES] Atualizando ${contactsToUpdate.length} contatos`);

      const result = await contactNameService.batchUpdateContactNames(clientId, contactsToUpdate);

      toast({
        title: "Atualização de nomes concluída",
        description: `${result.updated} nomes atualizados, ${result.errors} erros`,
      });

      // Recarregar dados
      await loadContactsWithTickets();
      forceSync();

    } catch (error) {
      console.error('❌ [NAMES] Erro ao atualizar nomes:', error);
      toast({
        title: "Erro",
        description: "Erro ao atualizar nomes dos contatos",
        variant: "destructive"
      });
    } finally {
      setIsUpdatingNames(false);
    }
  };

  // Filtrar contatos
  const filteredContacts = useMemo(() => {
    let filtered = contacts;

    // Filtro por texto
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(contact =>
        contact.name.toLowerCase().includes(term) ||
        contact.phone.includes(term) ||
        contact.email?.toLowerCase().includes(term)
      );
    }

    // Filtros por categoria
    if (activeFilters.length > 0) {
      filtered = filtered.filter(contact => {
        return activeFilters.every(filter => {
          switch (filter) {
            case 'with-conversation':
              return contact.ticket && contact.ticket.messagesCount > 0;
            case 'without-conversation':
              return !contact.ticket || contact.ticket.messagesCount === 0;
            case 'active-today':
              const today = new Date().toDateString();
              return contact.ticket?.lastMessageAt && 
                     new Date(contact.ticket.lastMessageAt).toDateString() === today;
            case 'new-week':
              const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
              return new Date(contact.created_at) > weekAgo;
            case 'has-real-name':
              return !contact.name.match(/^\(\d+\)/) && 
                     !contact.name.startsWith('Contato ') &&
                     contact.name !== contact.phone;
            default:
              return true;
          }
        });
      });
    }

    return filtered;
  }, [contacts, searchTerm, activeFilters]);

  // Calcular estatísticas
  const stats = useMemo(() => {
    const withConversations = contacts.filter(c => c.ticket && c.ticket.messagesCount > 0).length;
    const totalMessages = contacts.reduce((sum, c) => sum + (c.ticket?.messagesCount || 0), 0);
    const today = new Date().toDateString();
    const activeToday = contacts.filter(c => 
      c.ticket?.lastMessageAt && 
      new Date(c.ticket.lastMessageAt).toDateString() === today
    ).length;
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const newThisWeek = contacts.filter(c => new Date(c.created_at) > weekAgo).length;

    return {
      total: contacts.length,
      withConversations,
      withoutConversations: contacts.length - withConversations,
      totalMessages,
      activeToday,
      newThisWeek
    };
  }, [contacts]);

  // Handlers
  const handleFilterToggle = (filter: string) => {
    setActiveFilters(prev => 
      prev.includes(filter) 
        ? prev.filter(f => f !== filter)
        : [...prev, filter]
    );
  };

  const handleOpenChat = (contactId: string) => {
    const contact = contacts.find(c => c.id === contactId);
    if (contact && contact.ticket) {
      // Navegar para o chat do ticket
      window.location.href = `/client/${clientId}/chat?ticket=${contact.ticket.id}`;
    } else {
      toast({
        title: "Sem conversa",
        description: "Este contato ainda não tem uma conversa ativa",
        variant: "destructive"
      });
    }
  };

  const handleViewProfile = (contactId: string) => {
    // TODO: Implementar modal de perfil do contato
    toast({
      title: "Em desenvolvimento",
      description: "Perfil do contato será implementado em breve"
    });
  };

  const handleRefresh = () => {
    loadContactsWithTickets();
    forceSync();
  };

  const handleExport = () => {
    // TODO: Implementar exportação de contatos
    toast({
      title: "Em desenvolvimento",
      description: "Exportação de contatos será implementada em breve"
    });
  };

  // Carregar dados na inicialização
  useEffect(() => {
    loadContactsWithTickets();
  }, [clientId]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Contatos</h2>
          <p className="text-gray-600">Gerencie todos os seus contatos e conversas</p>
        </div>
        
        <div className="flex space-x-2">
          <Button
            variant="outline"
            onClick={updateContactNames}
            disabled={isUpdatingNames}
          >
            {isUpdatingNames ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Wand2 className="w-4 h-4 mr-2" />
            )}
            Atualizar Nomes
          </Button>
          
          <Button variant="outline" onClick={handleExport}>
            <Download className="w-4 h-4 mr-2" />
            Exportar
          </Button>
          
          <Button onClick={handleRefresh} disabled={isLoading}>
            {isLoading ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4 mr-2" />
            )}
            Atualizar
          </Button>
        </div>
      </div>

      {/* Estatísticas */}
      <ContactsStats stats={stats} />

      {/* Filtros */}
      <ContactsFilters
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        activeFilters={activeFilters}
        onFilterToggle={handleFilterToggle}
        onClearFilters={() => setActiveFilters([])}
      />

      {/* Lista de contatos */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <span className="ml-2 text-gray-600">Carregando contatos...</span>
        </div>
      ) : filteredContacts.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-8">
              <Users className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                {contacts.length === 0 
                  ? "Nenhum contato encontrado" 
                  : "Nenhum contato corresponde aos filtros"
                }
              </h3>
              <p className="text-gray-600 mb-4">
                {contacts.length === 0 
                  ? "Os contatos aparecerão aqui quando você receber mensagens" 
                  : "Tente ajustar os filtros de busca"
                }
              </p>
              {activeFilters.length > 0 && (
                <Button variant="outline" onClick={() => setActiveFilters([])}>
                  Limpar Filtros
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredContacts.map((contact) => (
            <ContactCard
              key={contact.id}
              contact={contact}
              ticketInfo={contact.ticket}
              onOpenChat={handleOpenChat}
              onViewProfile={handleViewProfile}
            />
          ))}
        </div>
      )}

      {/* Rodapé com informações */}
      {filteredContacts.length > 0 && (
        <div className="text-center text-sm text-gray-500 py-4">
          Mostrando {filteredContacts.length} de {contacts.length} contatos
          {activeFilters.length > 0 && (
            <span> • {activeFilters.length} filtro{activeFilters.length !== 1 ? 's' : ''} ativo{activeFilters.length !== 1 ? 's' : ''}</span>
          )}
        </div>
      )}
    </div>
  );
};

export default ContactsManager;
