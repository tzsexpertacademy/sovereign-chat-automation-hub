import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { useTicketRealtimeImproved } from '@/hooks/useTicketRealtimeImproved';
import { codechatApiService } from '@/services/codechatApiService';
import { ticketsService } from '@/services/ticketsService';
import TicketChatInterface from './TicketChatInterface';
import { 
  MessageSquare, 
  Search, 
  Clock, 
  User,
  RefreshCw,
  Download,
  Trash2,
  CheckCircle,
  AlertCircle,
  Loader2,
  Settings,
  Wand2
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface ChatInterfaceProps {
  clientId: string;
  selectedChatId: string | null;
  onSelectChat: (chatId: string) => void;
}

const ChatInterface = ({ clientId, selectedChatId, onSelectChat }: ChatInterfaceProps) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [importConfig, setImportConfig] = useState({
    enabled: true,
    limit: 10,
    extractNames: true,
    updateExisting: false
  });
  const [importStats, setImportStats] = useState({
    total: 0,
    processed: 0,
    errors: 0,
    startTime: null as Date | null
  });

  const { 
    tickets, 
    isLoading, 
    reloadTickets, 
    syncStatus,
    forceSyncMessages 
  } = useTicketRealtimeImproved(clientId);
  
  const { toast } = useToast();

  const formatLastSeen = (date: string | undefined) => {
    if (!date) return 'Nunca';
    try {
      return formatDistanceToNow(new Date(date), {
        addSuffix: true,
        locale: ptBR
      });
    } catch (e) {
      return 'Nunca';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open': return 'bg-green-500';
      case 'closed': return 'bg-gray-500';
      case 'pending': return 'bg-yellow-500';
      default: return 'bg-blue-500';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'open': return 'Ativa';
      case 'closed': return 'Fechada';
      case 'pending': return 'Pendente';
      default: return 'Nova';
    }
  };

  const extractPhoneNumber = (chatId: string): string => {
    if (!chatId) return '';
    let phone = chatId.split('@')[0];
    phone = phone.replace(/\D/g, '');
    return phone;
  };

  const formatPhoneForDisplay = (phoneNumber: string): string => {
    const cleanedNumber = phoneNumber.replace(/\D/g, '');

    if (cleanedNumber.length === 10) {
      return cleanedNumber.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3');
    } else if (cleanedNumber.length === 11) {
      return cleanedNumber.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
    }

    return phoneNumber;
  };

  const findTicketByChat = async (clientId: string, chatId: string) => {
    try {
      const { data, error } = await supabase
        .from('conversation_tickets')
        .select('id')
        .eq('client_id', clientId)
        .eq('chat_id', chatId)
        .single();

      if (error) {
        console.error('Erro ao buscar ticket:', error);
        return null;
      }

      return data;
    } catch (error) {
      console.error('Erro ao buscar ticket:', error);
      return null;
    }
  };

  /**
   * Importar conversas do CodeChat com melhorias
   */
  const handleImportConversations = async () => {
    if (!clientId || isImporting) return;

    try {
      setIsImporting(true);
      setImportStats({
        total: 0,
        processed: 0,
        errors: 0,
        startTime: new Date()
      });

      console.log('🚀 [IMPORT] Iniciando importação melhorada de conversas');

      // Buscar instâncias ativas
      const instances = await codechatApiService.getClientInstances(clientId);
      if (!instances || instances.length === 0) {
        throw new Error('Nenhuma instância encontrada');
      }

      console.log(`📱 [IMPORT] ${instances.length} instância(s) encontrada(s)`);

      let totalConversations = 0;
      let totalProcessed = 0;
      let totalErrors = 0;

      for (const instance of instances) {
        try {
          console.log(`🔄 [IMPORT] Processando instância: ${instance.instance_id}`);

          // Buscar chats da instância
          const chats = await codechatApiService.findChats(instance.instance_id);
          console.log(`💬 [IMPORT] ${chats.length} chats encontrados na instância ${instance.instance_id}`);

          totalConversations += chats.length;
          setImportStats(prev => ({ ...prev, total: totalConversations }));

          for (const chat of chats) {
            try {
              console.log(`💾 [IMPORT] Processando conversa: ${chat.name || chat.id}`);

              // Extrair número de telefone limpo
              const phoneNumber = this.extractPhoneNumber(chat.id);
              if (!phoneNumber) {
                console.warn('⚠️ [IMPORT] Número inválido, pulando:', chat.id);
                continue;
              }

              // Verificar se já existe ticket (se não for para atualizar)
              if (!importConfig.updateExisting) {
                const existingTicket = await ticketsService.findTicketByChat(clientId, phoneNumber);
                if (existingTicket) {
                  console.log('✅ [IMPORT] Ticket já existe, pulando:', phoneNumber);
                  totalProcessed++;
                  continue;
                }
              }

              // Criar/atualizar ticket com dados melhorados
              const ticketId = await ticketsService.createOrUpdateTicket({
                clientId,
                chatId: phoneNumber,
                title: chat.name || this.formatPhoneForDisplay(phoneNumber),
                phoneNumber,
                contactName: chat.name,
                instanceId: instance.instance_id,
                lastMessage: chat.lastMessage,
                lastMessageAt: chat.lastMessageTime,
                pushName: chat.name // Para extração de nome real
              });

              console.log('🎫 Ticket criado/atualizado:', ticketId);

              // Importar mensagens se habilitado
              if (importConfig.enabled && importConfig.limit > 0) {
                console.log(`📨 [IMPORT] Importando mensagens para chat ${phoneNumber} (limite: ${importConfig.limit})`);

                const messages = await codechatApiService.findMessages(
                  instance.instance_id, 
                  phoneNumber, 
                  importConfig.limit
                );

                console.log(`📨 [IMPORT] Processando ${messages.length} mensagens para importação`);

                for (const message of messages) {
                  try {
                    // Validar timestamp
                    let timestamp: string;
                    if (message.messageTimestamp) {
                      if (typeof message.messageTimestamp === 'number') {
                        // Converter timestamp Unix para ISO string
                        const timestampMs = message.messageTimestamp * 1000;
                        console.log('🕐 Validando timestamp:', timestampMs);
                        
                        const date = new Date(timestampMs);
                        if (isNaN(date.getTime())) {
                          throw new Error(`Timestamp inválido: ${message.messageTimestamp}`);
                        }
                        
                        timestamp = date.toISOString();
                        console.log('✅ Timestamp validado:', timestamp);
                      } else {
                        timestamp = message.messageTimestamp;
                      }
                    } else {
                      timestamp = new Date().toISOString();
                    }

                    // Extrair nome real se habilitado
                    let senderName = message.keyFromMe ? 'Atendente' : (chat.name || this.formatPhoneForDisplay(phoneNumber));
                    
                    console.log('💾 Salvando mensagem no ticket:', {
                      ticketId,
                      messageId: message.keyId,
                      fromMe: message.keyFromMe,
                      content: message.content.substring(0, 50) + '...'
                    });

                    await ticketsService.addTicketMessage({
                      ticket_id: ticketId,
                      message_id: message.keyId,
                      from_me: message.keyFromMe,
                      sender_name: senderName,
                      content: message.content,
                      message_type: message.messageType,
                      timestamp: timestamp,
                      is_internal_note: false,
                      is_ai_response: false,
                      processing_status: 'completed'
                    });

                    console.log('✅ Mensagem salva com sucesso');

                  } catch (messageError) {
                    console.error('❌ [IMPORT] Erro ao salvar mensagem:', messageError);
                    totalErrors++;
                  }
                }

                console.log('✅ [IMPORT] Mensagens importadas para:', chat.name || phoneNumber);
              }

              totalProcessed++;
              setImportStats(prev => ({ 
                ...prev, 
                processed: totalProcessed,
                errors: totalErrors 
              }));

              console.log('✅ [IMPORT] Conversa importada:', chat.name || phoneNumber);

            } catch (error) {
              console.error('❌ [IMPORT] Erro ao processar conversa:', error);
              totalErrors++;
              setImportStats(prev => ({ ...prev, errors: totalErrors }));
            }
          }

        } catch (error) {
          console.error(`❌ [IMPORT] Erro ao processar instância ${instance.instance_id}:`, error);
          totalErrors++;
        }
      }

      // Relatório final
      const duration = importStats.startTime ? Date.now() - importStats.startTime.getTime() : 0;
      console.log(`🎉 [IMPORT] Importação concluída: ${totalProcessed} processadas, ${totalErrors} erros em ${Math.round(duration/1000)}s`);

      toast({
        title: "Importação Concluída!",
        description: `${totalProcessed} conversas processadas, ${totalErrors} erros`,
        duration: 5000
      });

      // Recarregar dados
      reloadTickets();

    } catch (error) {
      console.error('❌ [IMPORT] Erro crítico na importação:', error);
      toast({
        title: "Erro na Importação",
        description: error instanceof Error ? error.message : "Erro desconhecido",
        variant: "destructive"
      });
    } finally {
      setIsImporting(false);
    }
  };

  /**
   * Reset completo com confirmação dupla
   */
  const handleCompleteReset = async () => {
    const confirmFirst = confirm(
      "⚠️ ATENÇÃO: Esta ação irá DELETAR PERMANENTEMENTE todos os tickets e mensagens deste cliente.\n\nVocê tem certeza?"
    );
    
    if (!confirmFirst) return;

    const confirmSecond = confirm(
      "🚨 CONFIRMAÇÃO FINAL: Todos os dados serão perdidos para sempre!\n\nDigite 'CONFIRMAR' para prosseguir."
    );
    
    if (!confirmSecond) return;

    const finalConfirm = prompt("Digite 'DELETAR TUDO' para confirmar:");
    if (finalConfirm !== 'DELETAR TUDO') {
      toast({
        title: "Reset cancelado",
        description: "Confirmação incorreta"
      });
      return;
    }

    try {
      setIsImporting(true);
      console.log('🗑️ [RESET] Iniciando reset completo para cliente:', clientId);

      await ticketsService.deleteAllClientData(clientId);

      toast({
        title: "Reset Completo",
        description: "Todos os dados foram removidos com sucesso",
      });

      reloadTickets();

    } catch (error) {
      console.error('❌ [RESET] Erro no reset:', error);
      toast({
        title: "Erro no Reset",
        description: "Erro ao limpar dados",
        variant: "destructive"
      });
    } finally {
      setIsImporting(false);
    }
  };

  const filteredTickets = tickets.filter(ticket => {
    const term = searchTerm.toLowerCase();
    return (
      ticket.title.toLowerCase().includes(term) ||
      ticket.customer?.name?.toLowerCase().includes(term) ||
      ticket.customer?.phone?.includes(term)
    );
  });

  return (
    <div className="flex h-full">
      {/* Lista de tickets - manter código existente */}
      <div className="w-1/3 border-r bg-gray-50 flex flex-col">
        {/* Header com configurações melhoradas */}
        <div className="p-4 border-b bg-white">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-semibold">Conversas</h2>
              <p className="text-sm text-gray-600">
                {tickets.length} conversa{tickets.length !== 1 ? 's' : ''}
              </p>
            </div>
            
            <div className="flex space-x-2">
              {/* Status de sincronização */}
              {syncStatus === 'syncing' && (
                <Badge variant="outline" className="text-blue-600">
                  <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                  Sincronizando
                </Badge>
              )}
              
              <Button size="sm" variant="outline" onClick={reloadTickets} disabled={isLoading}>
                <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </div>

          {/* Busca */}
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input
              placeholder="Buscar conversas..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Configurações de importação */}
          <div className="space-y-3 p-3 bg-gray-50 rounded-lg">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Configurações</span>
              <Settings className="w-4 h-4 text-gray-500" />
            </div>
            
            <div className="grid grid-cols-2 gap-2 text-xs">
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={importConfig.extractNames}
                  onChange={(e) => setImportConfig(prev => ({ ...prev, extractNames: e.target.checked }))}
                  className="rounded"
                />
                <span>Extrair nomes reais</span>
              </label>
              
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={importConfig.updateExisting}
                  onChange={(e) => setImportConfig(prev => ({ ...prev, updateExisting: e.target.checked }))}
                  className="rounded"
                />
                <span>Atualizar existentes</span>
              </label>
            </div>

            <div className="flex items-center space-x-2">
              <span className="text-xs">Limite:</span>
              <Input
                type="number"
                value={importConfig.limit}
                onChange={(e) => setImportConfig(prev => ({ ...prev, limit: parseInt(e.target.value) || 10 }))}
                className="w-16 h-6 text-xs"
                min="1"
                max="50"
              />
              <span className="text-xs text-gray-500">msgs/chat</span>
            </div>
          </div>

          {/* Botões de ação */}
          <div className="flex flex-col space-y-2 mt-4">
            <Button 
              onClick={handleImportConversations} 
              disabled={isImporting}
              className="w-full"
            >
              {isImporting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  {importStats.total > 0 ? 
                    `${importStats.processed}/${importStats.total}` : 
                    'Importando...'
                  }
                </>
              ) : (
                <>
                  <Download className="w-4 h-4 mr-2" />
                  Importar Conversas
                </>
              )}
            </Button>

            <div className="flex space-x-2">
              <Button 
                size="sm" 
                variant="outline" 
                onClick={forceSyncMessages}
                className="flex-1"
              >
                <Wand2 className="w-3 h-3 mr-1" />
                Sync
              </Button>
              
              <Button 
                size="sm" 
                variant="destructive" 
                onClick={handleCompleteReset}
                className="flex-1"
              >
                <Trash2 className="w-3 h-3 mr-1" />
                Reset
              </Button>
            </div>
          </div>

          {/* Progresso da importação */}
          {isImporting && importStats.total > 0 && (
            <div className="mt-4 p-3 bg-blue-50 rounded-lg">
              <div className="flex items-center justify-between text-sm mb-2">
                <span>Progresso</span>
                <span>{Math.round((importStats.processed / importStats.total) * 100)}%</span>
              </div>
              <div className="w-full bg-blue-200 rounded-full h-2">
                <div 
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${(importStats.processed / importStats.total) * 100}%` }}
                />
              </div>
              <div className="flex justify-between text-xs text-gray-600 mt-1">
                <span>{importStats.processed} processadas</span>
                <span>{importStats.errors} erros</span>
              </div>
            </div>
          )}
        </div>

        {/* Lista de tickets */}
        {isLoading ? (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-gray-500" />
          </div>
        ) : filteredTickets.length === 0 ? (
          <div className="flex-1 flex items-center justify-center">
            <Card className="w-full max-w-md">
              <CardContent className="flex flex-col items-center justify-center p-6">
                <MessageSquare className="w-10 h-10 text-gray-400 mb-4" />
                <CardTitle className="text-lg font-semibold text-gray-800 mb-2">
                  Nenhuma conversa encontrada
                </CardTitle>
                <p className="text-sm text-gray-500 text-center">
                  Comece uma nova conversa ou ajuste os termos de busca.
                </p>
              </CardContent>
            </Card>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto">
            {filteredTickets.map(ticket => (
              <Button
                key={ticket.id}
                variant="ghost"
                className={`w-full justify-start rounded-none hover:bg-gray-100 ${selectedChatId === ticket.id ? 'bg-gray-200' : ''}`}
                onClick={() => onSelectChat(ticket.id)}
              >
                <div className="flex items-center space-x-2 w-full">
                  <div className="relative">
                    <User className="w-5 h-5 text-gray-500" />
                    {ticket.status !== 'closed' && (
                      <CheckCircle className="absolute bottom-0 right-0 w-3 h-3 text-green-500" />
                    )}
                    {ticket.status === 'pending' && (
                      <AlertCircle className="absolute bottom-0 right-0 w-3 h-3 text-yellow-500" />
                    )}
                  </div>
                  <div className="truncate text-left">
                    <p className="text-sm font-medium text-gray-900 truncate">{ticket.title}</p>
                    <p className="text-xs text-gray-500 truncate">
                      {ticket.last_message_preview ? ticket.last_message_preview : 'Nenhuma mensagem'}
                    </p>
                  </div>
                  <div className="ml-auto flex flex-col items-end">
                    {ticket.last_message_at && (
                      <span className="text-xs text-gray-400">{formatLastSeen(ticket.last_message_at)}</span>
                    )}
                    <Badge variant="secondary" className={`ml-2 text-xs ${getStatusColor(ticket.status)}`}>
                      {getStatusText(ticket.status)}
                    </Badge>
                  </div>
                </div>
              </Button>
            ))}
          </div>
        )}
      </div>

      {/* Chat selecionado */}
      <div className="flex-1">
        {selectedChatId ? (
          <TicketChatInterface
            clientId={clientId}
            ticketId={selectedChatId}
          />
        ) : (
          <div className="flex-1 flex items-center justify-center bg-gray-50">
            <div className="text-center">
              <MessageSquare className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                Selecione uma conversa
              </h3>
              <p className="text-gray-600">
                Escolha uma conversa da lista para começar a atender
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ChatInterface;
