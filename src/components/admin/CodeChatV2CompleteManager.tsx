
import React, { useState } from 'react';
import { useCodeChatV2Complete } from '@/hooks/useCodeChatV2Complete';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { 
  MessageSquare, 
  Users, 
  Settings, 
  Send, 
  Archive, 
  Unarchive,
  Webhook,
  Phone,
  Mail,
  Building,
  Globe,
  Clock,
  CheckCircle,
  XCircle,
  MessageCircle,
  UserPlus
} from 'lucide-react';

interface Props {
  clientId: string;
}

const CodeChatV2CompleteManager: React.FC<Props> = ({ clientId }) => {
  const manager = useCodeChatV2Complete(clientId);
  const [selectedBusinessId, setSelectedBusinessId] = useState<string>('');
  const [selectedInstanceId, setSelectedInstanceId] = useState<string>('');
  const [newMessage, setNewMessage] = useState('');
  const [webhookUrl, setWebhookUrl] = useState('');

  const selectedBusiness = manager.businesses.find(b => b.id === selectedBusinessId);
  const selectedInstance = selectedBusiness?.instances.find(i => i.instanceId === selectedInstanceId);

  const handleLoadChats = async () => {
    if (selectedBusinessId && selectedInstanceId) {
      await manager.actions.loadChats(selectedBusinessId, selectedInstanceId);
    }
  };

  const handleLoadContacts = async () => {
    if (selectedBusinessId && selectedInstanceId) {
      await manager.actions.loadContacts(selectedBusinessId, selectedInstanceId);
    }
  };

  const handleSendMessage = async () => {
    if (selectedBusinessId && selectedInstanceId && manager.selectedChat && newMessage.trim()) {
      await manager.actions.sendTextMessage(selectedBusinessId, selectedInstanceId, manager.selectedChat.id, newMessage);
      setNewMessage('');
    }
  };

  const handleConfigureWebhook = async () => {
    if (selectedBusinessId && selectedInstanceId && webhookUrl.trim()) {
      await manager.actions.configureWebhook(selectedBusinessId, selectedInstanceId, webhookUrl);
      setWebhookUrl('');
    }
  };

  const handleSelectChat = async (chat: any) => {
    manager.actions.setSelectedChat(chat);
    if (selectedBusinessId && selectedInstanceId) {
      await manager.actions.loadChatMessages(selectedBusinessId, selectedInstanceId, chat.id);
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building className="h-5 w-5" />
            CodeChat API v2.2.1 - Gerenciamento Completo
          </CardTitle>
          <CardDescription>
            Interface completa para gerenciar todas as funcionalidades da API CodeChat v2.2.1
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Status do Manager */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">Businesses</p>
                    <p className="text-2xl font-bold">{manager.stats.totalBusinesses}</p>
                  </div>
                  <Building className="h-8 w-8 text-muted-foreground" />
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">Instâncias</p>
                    <p className="text-2xl font-bold">{manager.stats.totalInstances}</p>
                  </div>
                  <Phone className="h-8 w-8 text-muted-foreground" />
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">Conectadas</p>
                    <p className="text-2xl font-bold text-green-600">{manager.stats.connectedInstances}</p>
                  </div>
                  <CheckCircle className="h-8 w-8 text-green-600" />
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">Chats</p>
                    <p className="text-2xl font-bold">{manager.chats.length}</p>
                  </div>
                  <MessageSquare className="h-8 w-8 text-muted-foreground" />
                </div>
              </CardContent>
            </Card>
          </div>

          <Tabs defaultValue="businesses" className="w-full">
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="businesses">Businesses</TabsTrigger>
              <TabsTrigger value="chats">Chats</TabsTrigger>
              <TabsTrigger value="contacts">Contatos</TabsTrigger>
              <TabsTrigger value="messages">Mensagens</TabsTrigger>
              <TabsTrigger value="settings">Configurações</TabsTrigger>
            </TabsList>

            {/* Tab Businesses */}
            <TabsContent value="businesses" className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Businesses e Instâncias</h3>
                <Button 
                  onClick={manager.actions.loadBusinesses}
                  disabled={manager.isLoading}
                >
                  Atualizar
                </Button>
              </div>

              <div className="grid gap-4">
                {manager.businesses.map((business) => (
                  <Card key={business.id} className="p-4">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h4 className="font-semibold">{business.name}</h4>
                        <p className="text-sm text-muted-foreground">{business.email}</p>
                      </div>
                      <Badge variant={business.active ? "default" : "secondary"}>
                        {business.active ? "Ativo" : "Inativo"}
                      </Badge>
                    </div>

                    <div className="space-y-2">
                      <p className="text-sm"><strong>Slug:</strong> {business.slug}</p>
                      <p className="text-sm"><strong>País:</strong> {business.country}</p>
                      <p className="text-sm"><strong>Fuso:</strong> {business.timezone}</p>
                    </div>

                    {business.instances.length > 0 && (
                      <>
                        <Separator className="my-4" />
                        <div>
                          <h5 className="font-medium mb-2">Instâncias ({business.instances.length})</h5>
                          <div className="grid gap-2">
                            {business.instances.map((instance) => (
                              <div 
                                key={instance.instanceId}
                                className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                                  selectedInstanceId === instance.instanceId 
                                    ? 'border-primary bg-primary/5' 
                                    : 'border-border hover:bg-muted/50'
                                }`}
                                onClick={() => {
                                  setSelectedBusinessId(business.id);
                                  setSelectedInstanceId(instance.instanceId);
                                }}
                              >
                                <div className="flex items-center justify-between">
                                  <div>
                                    <p className="font-medium">{instance.name}</p>
                                    <p className="text-sm text-muted-foreground">ID: {instance.instanceId}</p>
                                  </div>
                                  <Badge 
                                    variant={instance.connection === 'open' ? "default" : "destructive"}
                                  >
                                    {instance.connection === 'open' ? "Conectada" : "Desconectada"}
                                  </Badge>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </>
                    )}
                  </Card>
                ))}
              </div>
            </TabsContent>

            {/* Tab Chats */}
            <TabsContent value="chats" className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Chats da Instância</h3>
                <div className="flex gap-2">
                  <Button 
                    onClick={handleLoadChats}
                    disabled={!selectedInstanceId || manager.isLoadingChats}
                  >
                    Carregar Chats
                  </Button>
                </div>
              </div>

              {!selectedInstanceId && (
                <Card>
                  <CardContent className="p-6 text-center">
                    <MessageSquare className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">Selecione uma instância para carregar os chats</p>
                  </CardContent>
                </Card>
              )}

              {selectedInstanceId && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {/* Lista de Chats */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Chats ({manager.chats.length})</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ScrollArea className="h-96">
                        <div className="space-y-2">
                          {manager.chats.map((chat) => (
                            <div
                              key={chat.id}
                              className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                                manager.selectedChat?.id === chat.id
                                  ? 'border-primary bg-primary/5'
                                  : 'border-border hover:bg-muted/50'
                              }`}
                              onClick={() => handleSelectChat(chat)}
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex-1">
                                  <p className="font-medium">{chat.name || chat.id}</p>
                                  <p className="text-sm text-muted-foreground truncate">
                                    {chat.lastMessage?.content || 'Sem mensagens'}
                                  </p>
                                </div>
                                <div className="flex flex-col items-end gap-1">
                                  {chat.unreadCount > 0 && (
                                    <Badge variant="destructive" className="text-xs">
                                      {chat.unreadCount}
                                    </Badge>
                                  )}
                                  {chat.isGroup && (
                                    <Badge variant="secondary" className="text-xs">
                                      Grupo
                                    </Badge>
                                  )}
                                  {chat.archived && (
                                    <Badge variant="outline" className="text-xs">
                                      Arquivado
                                    </Badge>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </ScrollArea>
                    </CardContent>
                  </Card>

                  {/* Área de Mensagens */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">
                        {manager.selectedChat ? `Chat: ${manager.selectedChat.name || manager.selectedChat.id}` : 'Selecione um chat'}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {manager.selectedChat ? (
                        <div className="space-y-4">
                          {/* Mensagens */}
                          <ScrollArea className="h-64 border rounded-lg p-4">
                            <div className="space-y-3">
                              {manager.chatMessages.map((message) => (
                                <div 
                                  key={message.id}
                                  className={`flex ${message.fromMe ? 'justify-end' : 'justify-start'}`}
                                >
                                  <div className={`max-w-[70%] p-3 rounded-lg ${
                                    message.fromMe 
                                      ? 'bg-primary text-primary-foreground' 
                                      : 'bg-muted'
                                  }`}>
                                    <p className="text-sm">{message.content?.text || 'Mensagem de mídia'}</p>
                                    <p className="text-xs opacity-70 mt-1">
                                      {new Date(message.timestamp).toLocaleTimeString()}
                                    </p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </ScrollArea>

                          {/* Enviar Mensagem */}
                          <div className="flex gap-2">
                            <Input
                              placeholder="Digite sua mensagem..."
                              value={newMessage}
                              onChange={(e) => setNewMessage(e.target.value)}
                              onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                            />
                            <Button onClick={handleSendMessage} disabled={!newMessage.trim()}>
                              <Send className="h-4 w-4" />
                            </Button>
                          </div>

                          {/* Ações do Chat */}
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => manager.actions.toggleArchiveChat(
                                selectedBusinessId, 
                                selectedInstanceId, 
                                manager.selectedChat!.id, 
                                !manager.selectedChat!.archived
                              )}
                            >
                              {manager.selectedChat.archived ? (
                                <>
                                  <Unarchive className="h-4 w-4 mr-2" />
                                  Desarquivar
                                </>
                              ) : (
                                <>
                                  <Archive className="h-4 w-4 mr-2" />
                                  Arquivar
                                </>
                              )}
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="h-64 flex items-center justify-center text-muted-foreground">
                          <div className="text-center">
                            <MessageCircle className="h-12 w-12 mx-auto mb-4" />
                            <p>Selecione um chat para ver as mensagens</p>
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              )}
            </TabsContent>

            {/* Tab Contatos */}
            <TabsContent value="contacts" className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Contatos da Instância</h3>
                <Button 
                  onClick={handleLoadContacts}
                  disabled={!selectedInstanceId}
                >
                  Carregar Contatos
                </Button>
              </div>

              {!selectedInstanceId && (
                <Card>
                  <CardContent className="p-6 text-center">
                    <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">Selecione uma instância para carregar os contatos</p>
                  </CardContent>
                </Card>
              )}

              {selectedInstanceId && (
                <div className="grid gap-4">
                  {manager.contacts.map((contact) => (
                    <Card key={contact.id}>
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                              <UserPlus className="h-5 w-5" />
                            </div>
                            <div>
                              <p className="font-medium">{contact.name}</p>
                              <p className="text-sm text-muted-foreground">{contact.id}</p>
                              {contact.pushName && (
                                <p className="text-xs text-muted-foreground">Push: {contact.pushName}</p>
                              )}
                            </div>
                          </div>
                          <div className="flex flex-col gap-1">
                            {contact.isMyContact && (
                              <Badge variant="default" className="text-xs">Meu Contato</Badge>
                            )}
                            {contact.isWAContact && (
                              <Badge variant="secondary" className="text-xs">WhatsApp</Badge>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>

            {/* Tab Mensagens */}
            <TabsContent value="messages" className="space-y-4">
              <h3 className="text-lg font-semibold">Mensagens Avançadas</h3>
              <p className="text-muted-foreground">
                Recursos avançados de mensagens serão implementados aqui (áudio, documento, localização, etc.)
              </p>
            </TabsContent>

            {/* Tab Configurações */}
            <TabsContent value="settings" className="space-y-4">
              <h3 className="text-lg font-semibold">Configurações da Instância</h3>
              
              {!selectedInstanceId && (
                <Card>
                  <CardContent className="p-6 text-center">
                    <Settings className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">Selecione uma instância para configurar</p>
                  </CardContent>
                </Card>
              )}

              {selectedInstanceId && (
                <div className="grid gap-6">
                  {/* Configurar Webhook */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Webhook className="h-5 w-5" />
                        Configurar Webhook
                      </CardTitle>
                      <CardDescription>
                        Configure um webhook para receber eventos em tempo real
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div>
                        <Label htmlFor="webhook-url">URL do Webhook</Label>
                        <Input
                          id="webhook-url"
                          placeholder="https://seu-webhook.com/codechat"
                          value={webhookUrl}
                          onChange={(e) => setWebhookUrl(e.target.value)}
                        />
                      </div>
                      <Button onClick={handleConfigureWebhook} disabled={!webhookUrl.trim()}>
                        Configurar Webhook
                      </Button>
                    </CardContent>
                  </Card>

                  {/* Informações da Instância */}
                  {selectedInstance && (
                    <Card>
                      <CardHeader>
                        <CardTitle>Informações da Instância</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label>Nome</Label>
                            <p className="text-sm font-mono bg-muted p-2 rounded">{selectedInstance.name}</p>
                          </div>
                          <div>
                            <Label>Instance ID</Label>
                            <p className="text-sm font-mono bg-muted p-2 rounded">{selectedInstance.instanceId}</p>
                          </div>
                          <div>
                            <Label>Estado</Label>
                            <p className="text-sm font-mono bg-muted p-2 rounded">{selectedInstance.state}</p>
                          </div>
                          <div>
                            <Label>Conexão</Label>
                            <p className="text-sm font-mono bg-muted p-2 rounded">{selectedInstance.connection}</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};

export default CodeChatV2CompleteManager;
