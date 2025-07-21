import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { contactDisplayService } from '@/services/contactDisplayService';
import { 
  RefreshCw, 
  Search,
  Users,
  Loader2,
  Wand2,
  MessageCircle,
  User
} from 'lucide-react';

interface ContactsManagerProps {
  clientId: string;
}

interface Contact {
  id: string;
  name: string;
  phone: string;
  email?: string;
  created_at: string;
  updated_at: string;
}

const ContactsManagerSimplified = ({ clientId }: ContactsManagerProps) => {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [isUpdatingNames, setIsUpdatingNames] = useState(false);
  const { toast } = useToast();

  // Carregar contatos
  const loadContacts = async () => {
    if (!clientId) return;

    try {
      setIsLoading(true);
      console.log('🔄 [CONTACTS] Carregando contatos do cliente:', clientId);

      const { data: contactsData, error } = await supabase
        .from('customers')
        .select('*')
        .eq('client_id', clientId)
        .order('updated_at', { ascending: false });

      if (error) {
        throw error;
      }

      console.log(`✅ [CONTACTS] ${contactsData?.length || 0} contatos carregados`);
      setContacts(contactsData || []);

    } catch (error) {
      console.error('❌ [CONTACTS] Erro ao carregar contatos:', error);
      toast({
        title: "Erro ao carregar contatos",
        description: error instanceof Error ? error.message : "Erro desconhecido",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Atualizar nomes baseado nas mensagens
  const handleUpdateNames = async () => {
    if (!clientId || isUpdatingNames) return;

    try {
      setIsUpdatingNames(true);
      console.log('🔄 [NAMES] Iniciando atualização de nomes');

      const result = await contactDisplayService.updateContactDisplayNames(clientId);

      toast({
        title: "Atualização de nomes concluída",
        description: `${result.updated} nomes atualizados, ${result.errors} erros`,
      });

      // Recarregar contatos
      await loadContacts();

    } catch (error) {
      console.error('❌ [NAMES] Erro na atualização:', error);
      toast({
        title: "Erro na atualização",
        description: "Erro ao atualizar nomes",
        variant: "destructive"
      });
    } finally {
      setIsUpdatingNames(false);
    }
  };

  // Filtrar contatos
  const filteredContacts = contacts.filter(contact => {
    const term = searchTerm.toLowerCase();
    return (
      contact.name.toLowerCase().includes(term) ||
      contact.phone.includes(term) ||
      contact.email?.toLowerCase().includes(term)
    );
  });

  // Carregar dados iniciais
  useEffect(() => {
    loadContacts();
  }, [clientId]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Contatos</h2>
          <p className="text-gray-600">
            {contacts.length} contato{contacts.length !== 1 ? 's' : ''} total{contacts.length !== 1 ? 'is' : ''}
          </p>
        </div>
        
        <div className="flex space-x-2">
          <Button 
            variant="outline" 
            onClick={handleUpdateNames}
            disabled={isUpdatingNames}
          >
            {isUpdatingNames ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Wand2 className="w-4 h-4 mr-2" />
            )}
            Corrigir Nomes
          </Button>
          
          <Button onClick={loadContacts} disabled={isLoading}>
            {isLoading ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4 mr-2" />
            )}
            Atualizar
          </Button>
        </div>
      </div>

      {/* Busca */}
      <Card>
        <CardContent className="pt-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input
              placeholder="Buscar contatos..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

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
                  : "Nenhum contato corresponde à busca"
                }
              </h3>
              <p className="text-gray-600">
                {contacts.length === 0 
                  ? "Os contatos aparecerão aqui quando você importar conversas" 
                  : "Tente ajustar os termos de busca"
                }
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredContacts.map((contact) => (
            <Card key={contact.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                      <User className="w-5 h-5 text-primary" />
                    </div>
                    
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900 text-sm">
                        {contactDisplayService.getDisplayName(contact.name, contact.phone)}
                      </h3>
                      <p className="text-xs text-gray-500">
                        {contactDisplayService.formatPhoneDisplay(contact.phone)}
                      </p>
                      {contact.email && (
                        <p className="text-xs text-gray-500">
                          {contact.email}
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex space-x-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1 text-xs"
                  >
                    <MessageCircle className="w-3 h-3 mr-1" />
                    Chat
                  </Button>
                  
                  <Button
                    size="sm"
                    variant="outline"
                    className="px-3"
                  >
                    <User className="w-3 h-3" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Rodapé */}
      {filteredContacts.length > 0 && (
        <div className="text-center text-sm text-gray-500 py-4">
          Mostrando {filteredContacts.length} de {contacts.length} contatos
        </div>
      )}
    </div>
  );
};

export default ContactsManagerSimplified;