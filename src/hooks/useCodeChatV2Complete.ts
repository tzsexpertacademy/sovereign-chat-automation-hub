
import { useState, useEffect } from 'react';
import { codechatV2ApiService, ChatInfo, ContactInfo, MessageInfo, GroupInfo } from '@/services/codechatV2ApiService';
import { useCodeChatV2Manager } from './useCodeChatV2Manager';
import { useToast } from '@/hooks/use-toast';

export const useCodeChatV2Complete = (clientId?: string) => {
  const baseManager = useCodeChatV2Manager(clientId);
  const [chats, setChats] = useState<ChatInfo[]>([]);
  const [contacts, setContacts] = useState<ContactInfo[]>([]);
  const [selectedChat, setSelectedChat] = useState<ChatInfo | null>(null);
  const [chatMessages, setChatMessages] = useState<MessageInfo[]>([]);
  const [isLoadingChats, setIsLoadingChats] = useState(false);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const { toast } = useToast();

  // Carregar chats de uma instância
  const loadChats = async (businessId: string, instanceId: string) => {
    const business = baseManager.businesses.find(b => b.id === businessId);
    const instance = business?.instances.find(i => i.instanceId === instanceId);
    
    if (!business || !instance) {
      toast({
        title: "Erro",
        description: "Business ou instância não encontrada",
        variant: "destructive"
      });
      return;
    }

    try {
      setIsLoadingChats(true);
      console.log('📨 [CHATS] Carregando chats para instância:', instanceId);
      
      const chatsData = await codechatV2ApiService.getChats(instance.Auth.jwt, instanceId);
      setChats(chatsData);
      
      console.log(`✅ [CHATS] ${chatsData.length} chats carregados`);
      
    } catch (error: any) {
      console.error('❌ [CHATS] Erro ao carregar chats:', error);
      toast({
        title: "Erro ao carregar chats",
        description: error.message || "Erro desconhecido",
        variant: "destructive"
      });
    } finally {
      setIsLoadingChats(false);
    }
  };

  // Carregar contatos de uma instância
  const loadContacts = async (businessId: string, instanceId: string) => {
    const business = baseManager.businesses.find(b => b.id === businessId);
    const instance = business?.instances.find(i => i.instanceId === instanceId);
    
    if (!business || !instance) {
      toast({
        title: "Erro",
        description: "Business ou instância não encontrada",
        variant: "destructive"
      });
      return;
    }

    try {
      console.log('👥 [CONTACTS] Carregando contatos para instância:', instanceId);
      
      const contactsData = await codechatV2ApiService.getContacts(instance.Auth.jwt, instanceId);
      setContacts(contactsData);
      
      console.log(`✅ [CONTACTS] ${contactsData.length} contatos carregados`);
      
    } catch (error: any) {
      console.error('❌ [CONTACTS] Erro ao carregar contatos:', error);
      toast({
        title: "Erro ao carregar contatos",
        description: error.message || "Erro desconhecido",
        variant: "destructive"
      });
    }
  };

  // Carregar mensagens de um chat
  const loadChatMessages = async (businessId: string, instanceId: string, chatId: string) => {
    const business = baseManager.businesses.find(b => b.id === businessId);
    const instance = business?.instances.find(i => i.instanceId === instanceId);
    
    if (!business || !instance) {
      toast({
        title: "Erro",
        description: "Business ou instância não encontrada",
        variant: "destructive"
      });
      return;
    }

    try {
      setIsLoadingMessages(true);
      console.log('💬 [MESSAGES] Carregando mensagens do chat:', chatId);
      
      const messagesData = await codechatV2ApiService.getMessages(instance.Auth.jwt, instanceId, chatId, 50);
      setChatMessages(messagesData);
      
      console.log(`✅ [MESSAGES] ${messagesData.length} mensagens carregadas`);
      
    } catch (error: any) {
      console.error('❌ [MESSAGES] Erro ao carregar mensagens:', error);
      toast({
        title: "Erro ao carregar mensagens",
        description: error.message || "Erro desconhecido",
        variant: "destructive"
      });
    } finally {
      setIsLoadingMessages(false);
    }
  };

  // Enviar mensagem de texto
  const sendTextMessage = async (businessId: string, instanceId: string, chatId: string, text: string) => {
    const business = baseManager.businesses.find(b => b.id === businessId);
    const instance = business?.instances.find(i => i.instanceId === instanceId);
    
    if (!business || !instance) {
      toast({
        title: "Erro",
        description: "Business ou instância não encontrada",
        variant: "destructive"
      });
      return null;
    }

    try {
      console.log('📤 [SEND] Enviando mensagem de texto:', { chatId, text });
      
      const result = await codechatV2ApiService.sendTextMessage(instance.Auth.jwt, instanceId, {
        number: chatId,
        text,
        delay: 1200,
        presence: 'composing'
      });
      
      toast({
        title: "Mensagem enviada",
        description: "Mensagem de texto enviada com sucesso"
      });
      
      // Recarregar mensagens do chat
      if (selectedChat?.id === chatId) {
        await loadChatMessages(businessId, instanceId, chatId);
      }
      
      return result;
      
    } catch (error: any) {
      console.error('❌ [SEND] Erro ao enviar mensagem:', error);
      toast({
        title: "Erro ao enviar mensagem",
        description: error.message || "Erro desconhecido",
        variant: "destructive"
      });
      return null;
    }
  };

  // Configurar webhook
  const configureWebhook = async (businessId: string, instanceId: string, webhookUrl: string) => {
    const business = baseManager.businesses.find(b => b.id === businessId);
    
    if (!business) {
      toast({
        title: "Erro",
        description: "Business não encontrado",
        variant: "destructive"
      });
      return null;
    }

    try {
      console.log('🔗 [WEBHOOK] Configurando webhook:', { instanceId, webhookUrl });
      
      const webhookConfig = {
        enabled: true,
        url: webhookUrl,
        events: [
          'MESSAGE_RECEIVED',
          'MESSAGE_SENT',
          'MESSAGE_UPDATE',
          'CHAT_UPDATE',
          'CONTACT_UPDATE',
          'GROUP_UPDATE',
          'PRESENCE_UPDATE',
          'CONNECTION_UPDATE',
          'QRCODE_UPDATE'
        ]
      };
      
      const result = await codechatV2ApiService.setWebhook(business.businessToken, instanceId, webhookConfig);
      
      toast({
        title: "Webhook configurado",
        description: "Webhook configurado com sucesso"
      });
      
      return result;
      
    } catch (error: any) {
      console.error('❌ [WEBHOOK] Erro ao configurar webhook:', error);
      toast({
        title: "Erro ao configurar webhook",
        description: error.message || "Erro desconhecido",
        variant: "destructive"
      });
      return null;
    }
  };

  // Arquivar/desarquivar chat
  const toggleArchiveChat = async (businessId: string, instanceId: string, chatId: string, archive: boolean) => {
    const business = baseManager.businesses.find(b => b.id === businessId);
    const instance = business?.instances.find(i => i.instanceId === instanceId);
    
    if (!business || !instance) {
      toast({
        title: "Erro",
        description: "Business ou instância não encontrada",
        variant: "destructive"
      });
      return null;
    }

    try {
      console.log('📁 [ARCHIVE] Alterando status do chat:', { chatId, archive });
      
      const result = await codechatV2ApiService.archiveChat(instance.Auth.jwt, instanceId, chatId, archive);
      
      toast({
        title: archive ? "Chat arquivado" : "Chat desarquivado",
        description: `Chat ${archive ? 'arquivado' : 'desarquivado'} com sucesso`
      });
      
      // Recarregar chats
      await loadChats(businessId, instanceId);
      
      return result;
      
    } catch (error: any) {
      console.error('❌ [ARCHIVE] Erro ao alterar status do chat:', error);
      toast({
        title: "Erro ao alterar chat",
        description: error.message || "Erro desconhecido",
        variant: "destructive"
      });
      return null;
    }
  };

  return {
    // Dados do manager base
    ...baseManager,
    
    // Dados específicos
    chats,
    contacts,
    selectedChat,
    chatMessages,
    isLoadingChats,
    isLoadingMessages,
    
    // Ações
    actions: {
      ...baseManager.actions,
      loadChats,
      loadContacts,
      loadChatMessages,
      sendTextMessage,
      configureWebhook,
      toggleArchiveChat,
      setSelectedChat
    }
  };
};
