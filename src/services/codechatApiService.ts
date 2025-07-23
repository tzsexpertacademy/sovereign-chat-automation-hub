
// CodeChat API - ATUALIZADO PARA v2.1.3 
import { yumerJwtService } from './yumerJwtService';
import { serverConfigService } from './serverConfigService';

export interface CodeChatChat {
  id: string;
  name?: string;
  isGroup: boolean;
  lastMessage?: string;
  lastMessageTime?: string;
  unreadCount: number;
  profilePictureUrl?: string;
  participants?: string[];
}

export interface CodeChatMessage {
  id: number;
  keyId: string;
  keyFromMe: boolean;
  keyRemoteJid: string;
  keyParticipant?: string;
  pushName?: string;
  messageType: string;
  content: any;
  messageTimestamp: number;
  instanceId: number;
  device: string;
  isGroup?: boolean;
}

export interface CodeChatContact {
  jid: string;
  exists: boolean;
  name?: string;
  profilePictureUrl?: string;
}

// Service para integração com CodeChat API v2.1.3
class CodeChatApiService {
  private config = serverConfigService.getConfig();
  private instanceTokens: Map<string, string> = new Map();

  setInstanceToken(instanceName: string, token: string): void {
    this.instanceTokens.set(instanceName, token);
    console.log(`🔐 [CODECHAT] JWT Token configurado para instância: ${instanceName}`);
  }

  private async getAuthHeaders(instanceName: string): Promise<HeadersInit> {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };

    // Tentar usar token específico da instância
    const instanceToken = this.instanceTokens.get(instanceName);
    if (instanceToken) {
      headers['Authorization'] = `Bearer ${instanceToken}`;
      console.log(`🔐 [CODECHAT] Usando JWT Token da instância: ${instanceName}`);
      return headers;
    }

    // Tentar gerar JWT automaticamente
    try {
      console.log(`🔄 [CODECHAT] Gerando JWT automaticamente para: ${instanceName}`);
      const newToken = await yumerJwtService.generateLocalJWT(instanceName);
      this.setInstanceToken(instanceName, newToken);
      headers['Authorization'] = `Bearer ${newToken}`;
      console.log(`✅ [CODECHAT] JWT gerado automaticamente para: ${instanceName}`);
      return headers;
    } catch (error) {
      console.warn(`⚠️ [CODECHAT] Falha ao gerar JWT automaticamente: ${error}`);
      throw new Error('Não foi possível autenticar com CodeChat API');
    }
  }

  private async makeRequest(endpoint: string, options: RequestInit = {}, instanceName?: string): Promise<any> {
    const url = `${this.config.serverUrl}${endpoint}`;
    
    const requestOptions: RequestInit = {
      headers: instanceName ? await this.getAuthHeaders(instanceName) : {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      ...options,
    };

    console.log(`📡 [CODECHAT] Request: ${options.method || 'GET'} ${url}`);
    
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);
      
      const response = await fetch(url, {
        ...requestOptions,
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`❌ [CODECHAT] API Error ${response.status}:`, errorText);
        throw new Error(`CodeChat API Error ${response.status}: ${errorText}`);
      }
      
      const data = await response.json();
      console.log(`✅ [CODECHAT] Response: ${endpoint}`, data);
      return data;
    } catch (error: any) {
      console.error(`❌ [CODECHAT] Request failed: ${endpoint}`, error);
      if (error.name === 'AbortError') {
        throw new Error('Request timeout - servidor não responde');
      }
      throw error;
    }
  }

  // CORRIGIDO: findChats com validação correta dos tipos e melhor integração de contatos
  async findChats(instanceName: string, options: {
    limit?: number;
    useMessages?: boolean;
    onProgress?: (current: number, total: number) => void;
  } = {}): Promise<CodeChatChat[]> {
    const { limit = 50, useMessages = true, onProgress } = options;
    
    try {
      console.log(`📊 [CODECHAT] Buscando chats para instância: ${instanceName} (limit: ${limit})`);
      
      // FASE 1: Buscar dados de contatos primeiro para ter nomes reais
      let contactsData: any[] = [];
      let contactsMap = new Map<string, any>();
      
      try {
        const contactsResponse = await this.makeRequest(`/chat/findContacts/${instanceName}`, {
          method: 'POST',
          body: JSON.stringify({ where: {} }),
        }, instanceName);
        
        if (Array.isArray(contactsResponse)) {
          contactsData = contactsResponse;
          
          // Criar mapa otimizado para busca de contatos
          contactsData.forEach(contact => {
            if (contact.remoteJid) {
              // Mapear por diferentes formatos possíveis
              const phoneNumber = this.extractPhoneFromRemoteJid(contact.remoteJid);
              if (phoneNumber) {
                contactsMap.set(contact.remoteJid, contact);
                contactsMap.set(`${phoneNumber}@s.whatsapp.net`, contact);
                contactsMap.set(`${phoneNumber}@c.us`, contact);
                contactsMap.set(`55${phoneNumber}@s.whatsapp.net`, contact);
                contactsMap.set(`55${phoneNumber}@c.us`, contact);
                contactsMap.set(phoneNumber, contact);
              }
            }
          });
          
          console.log(`✅ [CODECHAT] ${contactsData.length} contatos mapeados para busca rápida`);
        }
      } catch (contactError) {
        console.warn(`⚠️ [CODECHAT] Erro ao buscar contatos:`, contactError);
      }

      // FASE 2: Buscar chats principais
      let chats: any[] = [];
      
      try {
        const response = await this.makeRequest(`/chat/findChats/${instanceName}`, {
          method: 'GET',
        }, instanceName);
        
        if (Array.isArray(response)) {
          chats = response.slice(0, limit);
          console.log(`✅ [CODECHAT] ${chats.length} chats encontrados`);
        }
      } catch (chatsError) {
        console.error(`❌ [CODECHAT] Erro em findChats:`, chatsError);
      }

      // FASE 3: Estratégia alternativa - usar mensagens recentes se findChats falhar
      if (chats.length === 0 && useMessages) {
        console.log(`🔄 [CODECHAT] Tentando estratégia alternativa via mensagens...`);
        
        try {
          const messagesResponse = await this.makeRequest(`/chat/findMessages/${instanceName}`, {
            method: 'POST',
            body: JSON.stringify({
              where: {},
              limit: limit * 2,
              offset: 0
            }),
          }, instanceName);
          
          if (messagesResponse?.messages?.records) {
            const uniqueChats = new Map();
            
            messagesResponse.messages.records.forEach((message: any) => {
              if (message.keyRemoteJid && !uniqueChats.has(message.keyRemoteJid)) {
                uniqueChats.set(message.keyRemoteJid, {
                  id: Date.now() + Math.random(), // ID temporário
                  remoteJid: message.keyRemoteJid,
                  pushName: message.pushName || null,
                  lastMessage: this.extractMessageContent(message.content),
                  lastMessageTime: message.messageTimestamp,
                  instanceId: message.instanceId
                });
              }
            });
            
            chats = Array.from(uniqueChats.values()).slice(0, limit);
            console.log(`✅ [CODECHAT] ${chats.length} chats extraídos de mensagens`);
          }
        } catch (messageError) {
          console.error(`❌ [CODECHAT] Erro na estratégia alternativa:`, messageError);
        }
      }

      if (chats.length === 0) {
        console.warn(`⚠️ [CODECHAT] Nenhum chat encontrado`);
        return [];
      }

      console.log(`🔄 [CODECHAT] Processando ${chats.length} chats com dados de contatos...`);
      
      const validChats: CodeChatChat[] = [];
      
      for (let i = 0; i < chats.length; i++) {
        const chat = chats[i];
        onProgress?.(i + 1, chats.length);
        
        // Extrair número real do WhatsApp
        const phoneNumber = this.extractWhatsAppPhone(chat);
        
        if (phoneNumber) {
          // BUSCA MELHORADA: Tentar encontrar contato usando múltiplos formatos
          let contactData = null;
          
          const searchKeys = [
            chat.remoteJid,
            `${phoneNumber}@s.whatsapp.net`,
            `55${phoneNumber}@s.whatsapp.net`,
            `${phoneNumber}@c.us`,
            `55${phoneNumber}@c.us`,
            phoneNumber
          ];
          
          for (const key of searchKeys) {
            if (contactsMap.has(key)) {
              contactData = contactsMap.get(key);
              console.log(`🎯 [CODECHAT] Contato encontrado via chave: ${key} -> ${contactData.pushName}`);
              break;
            }
          }
          
          // Extrair nome real do contato com prioridades corretas
          const realContactName = this.extractRealContactName(chat, contactData, phoneNumber);
          
          const normalizedChat = {
            id: phoneNumber,
            name: realContactName,
            isGroup: this.isGroupChat(chat),
            lastMessage: this.extractMessageContent(chat.lastMessage) || 'Conversa importada',
            lastMessageTime: this.normalizeTimestamp(chat.lastMessageTime),
            unreadCount: Number(chat.unreadCount) || 0,
            profilePictureUrl: contactData?.profilePicUrl || null,
            participants: Array.isArray(chat.participants) ? chat.participants : []
          };
          
          validChats.push(normalizedChat);
          console.log(`✅ [CODECHAT] Chat válido: ${realContactName} (${phoneNumber})`);
        } else {
          console.log(`⏭️ [CODECHAT] Chat pulado - sem número válido`);
        }
      }
      
      console.log(`✅ [CODECHAT] ${validChats.length} chats válidos processados com nomes reais`);
      return validChats;
      
    } catch (error) {
      console.error(`❌ [CODECHAT] Erro ao buscar chats:`, error);
      throw error;
    }
  }

  // NOVO: Extrair telefone do remoteJid de forma robusta
  private extractPhoneFromRemoteJid(remoteJid: string): string | null {
    if (!remoteJid || typeof remoteJid !== 'string') return null;
    
    // Remover sufixos do WhatsApp
    let phone = remoteJid.replace('@s.whatsapp.net', '').replace('@c.us', '');
    
    // Limpar caracteres não numéricos
    phone = phone.replace(/\D/g, '');
    
    // Validar se é um número válido
    if (phone.length >= 10 && phone.length <= 15) {
      // Remover DDI 55 se presente para normalização
      if (phone.startsWith('55') && phone.length >= 12) {
        return phone.substring(2);
      }
      return phone;
    }
    
    return null;
  }

  // NOVO: Extrair nome real do contato priorizando dados verdadeiros
  private extractRealContactName(chatData: any, contactData: any, phoneNumber: string): string {
    console.log(`🔍 [CODECHAT] Extraindo nome real:`, { 
      chatPushName: chatData?.pushName, 
      contactPushName: contactData?.pushName,
      phoneNumber 
    });
    
    try {
      // PRIORIDADE 1: pushName do contato real (dados do findContacts)
      if (contactData?.pushName && this.isValidContactName(contactData.pushName)) {
        const contactName = this.safeExtractString(contactData.pushName);
        console.log(`✅ [CODECHAT] Nome real do contato encontrado: ${contactName}`);
        return this.formatCustomerName(contactName, phoneNumber);
      }
      
      // PRIORIDADE 2: pushName do chat
      if (chatData?.pushName && this.isValidContactName(chatData.pushName)) {
        const chatName = this.safeExtractString(chatData.pushName);
        console.log(`✅ [CODECHAT] Nome do chat válido: ${chatName}`);
        return this.formatCustomerName(chatName, phoneNumber);
      }
      
      // PRIORIDADE 3: Nome direto do chat
      if (chatData?.name && this.isValidContactName(chatData.name)) {
        const directName = this.safeExtractString(chatData.name);
        console.log(`✅ [CODECHAT] Nome direto válido: ${directName}`);
        return this.formatCustomerName(directName, phoneNumber);
      }
      
      // Fallback: usar número formatado
      const fallbackName = this.formatPhoneForDisplay(phoneNumber);
      console.log(`⚠️ [CODECHAT] Usando fallback para nome: ${fallbackName}`);
      return fallbackName;
      
    } catch (error) {
      console.error(`❌ [CODECHAT] Erro ao extrair nome real:`, error);
      return this.formatPhoneForDisplay(phoneNumber);
    }
  }

  // NOVO: Validar se é um nome de contato válido
  private isValidContactName(name: string): boolean {
    if (!name || typeof name !== 'string' || name.trim() === '') return false;
    
    const cleanName = name.trim();
    
    // Rejeitar se é apenas um número
    if (/^\d+$/.test(cleanName)) return false;
    
    // Rejeitar se contém apenas o número de telefone
    if (cleanName.includes('@') && cleanName.includes('.')) return false;
    
    // Rejeitar se é muito curto (menos de 2 caracteres)
    if (cleanName.length < 2) return false;
    
    // Rejeitar se parece com um ID técnico
    if (cleanName.startsWith('user_') || cleanName.startsWith('contact_')) return false;
    
    // Rejeitar se é exatamente igual ao número (formatado)
    if (/^\(\d{2}\)\s\d{4,5}-\d{4}$/.test(cleanName)) return false;
    
    // Rejeitar se parece com um número com DDI
    if (/^55\d{10,11}$/.test(cleanName)) return false;
    
    return true;
  }

  // CORRIGIDO: Extrair número real do WhatsApp com melhor validação
  extractWhatsAppPhone(chat: any): string | null {
    console.log(`🔍 [CODECHAT] Extraindo telefone de:`, { 
      id: chat.id, 
      remoteJid: chat.remoteJid, 
      jid: chat.jid,
      keyRemoteJid: chat.keyRemoteJid 
    });
    
    // 1. Verificar se é chat de grupo (ignorar)
    if (this.isGroupChat(chat)) {
      console.log(`⏭️ [CODECHAT] Chat de grupo ignorado`);
      return null;
    }
    
    // 2. Tentar extrair número dos campos WhatsApp
    const possibleFields = [
      chat.remoteJid,
      chat.jid, 
      chat.keyRemoteJid,
      String(chat.id) // Converter ID para string de forma segura
    ];
    
    for (const field of possibleFields) {
      if (field && typeof field === 'string') {
        // Formato @s.whatsapp.net
        if (field.includes('@s.whatsapp.net')) {
          const phoneNumber = field.split('@')[0];
          if (this.isValidPhoneNumber(phoneNumber)) {
            console.log(`📱 [CODECHAT] Número extraído de @s.whatsapp.net: ${phoneNumber}`);
            return this.normalizePhoneNumber(phoneNumber);
          }
        }
        
        // Formato @c.us (mensagens enviadas)
        if (field.includes('@c.us')) {
          const phoneNumber = field.split('@')[0];
          if (this.isValidPhoneNumber(phoneNumber)) {
            console.log(`📱 [CODECHAT] Número extraído de @c.us: ${phoneNumber}`);
            return this.normalizePhoneNumber(phoneNumber);
          }
        }
        
        // Número direto (validar se é telefone real)
        if (this.isValidPhoneNumber(field)) {
          console.log(`📱 [CODECHAT] Número direto: ${field}`);
          return this.normalizePhoneNumber(field);
        }
      }
    }
    
    console.warn(`⚠️ [CODECHAT] Nenhum telefone válido encontrado`);
    return null;
  }

  // CORRIGIDO: Detectar chat de grupo usando apenas remoteJid
  private isGroupChat(chat: any): boolean {
    const remoteJid = chat.remoteJid || chat.jid || chat.keyRemoteJid;
    
    if (remoteJid && typeof remoteJid === 'string') {
      return remoteJid.includes('@g.us');
    }
    
    // Converter ID para string se for número
    const chatId = typeof chat.id === 'number' ? String(chat.id) : chat.id;
    if (chatId && typeof chatId === 'string') {
      return chatId.includes('@g.us');
    }
    
    // Fallback: verificar propriedade isGroup se existir
    return chat.isGroup === true;
  }

  // NOVO: Validar se é número de telefone real
  private isValidPhoneNumber(value: string): boolean {
    if (!value || typeof value !== 'string') return false;
    
    const cleanNumber = value.replace(/\D/g, '');
    
    // Deve ter entre 10 e 15 dígitos (padrão internacional)
    if (cleanNumber.length < 10 || cleanNumber.length > 15) return false;
    
    // Não deve ser apenas sequencial (123, 4567, etc.)
    if (/^(\d)\1+$/.test(cleanNumber)) return false;
    
    // Não deve ser ID interno simples (1, 2, 3, etc.)
    if (cleanNumber.length < 8) return false;
    
    return true;
  }

  // NOVO: Extrair conteúdo de mensagem
  private extractMessageContent(content: any): string {
    if (!content) return '';
    
    if (typeof content === 'string') return content;
    
    if (typeof content === 'object') {
      return content.text || content.body || content.caption || '[Mídia]';
    }
    
    return String(content);
  }

  // NOVO: Normalizar timestamp
  private normalizeTimestamp(timestamp: any): string {
    if (!timestamp) return new Date().toISOString();
    
    if (typeof timestamp === 'number') {
      // Se parece com timestamp em segundos
      if (timestamp.toString().length === 10) {
        return new Date(timestamp * 1000).toISOString();
      }
      // Se parece com timestamp em milissegundos
      return new Date(timestamp).toISOString();
    }
    
    if (typeof timestamp === 'string') {
      return new Date(timestamp).toISOString();
    }
    
    return new Date().toISOString();
  }

  // CORRIGIDO: Busca de mensagens com formato de DDI correto
  async findMessages(instanceName: string, chatId: string, limit: number = 50, offset: number = 0): Promise<CodeChatMessage[]> {
    try {
      console.log(`📨 [CODECHAT] Buscando mensagens para chat ${chatId} na instância: ${instanceName}`);
      
      // Gerar diferentes formatos possíveis para keyRemoteJid
      const phoneNumber = chatId.replace(/[@\s\.]/g, '').replace(/\D/g, '');
      
      const searchFormats = [
        chatId, // Formato original
        `${phoneNumber}@s.whatsapp.net`, // Sem DDI
        `55${phoneNumber}@s.whatsapp.net`, // Com DDI 55
        `${phoneNumber}@c.us`, // Formato alternativo
        `55${phoneNumber}@c.us` // Formato alternativo com DDI
      ];
      
      console.log(`🔍 [CODECHAT] Tentando formatos de busca:`, searchFormats);
      
      for (const remoteJid of searchFormats) {
        console.log(`🔍 [CODECHAT] Testando formato: ${remoteJid}`);
        
        const payload = {
          where: {
            keyRemoteJid: remoteJid
          },
          offset: offset,
          limit: limit
        };

        const response = await this.makeRequest(`/chat/findMessages/${instanceName}`, {
          method: 'POST',
          body: JSON.stringify(payload),
        }, instanceName);
        
        // Extrair mensagens da resposta
        if (response?.messages?.records && Array.isArray(response.messages.records)) {
          const messages = response.messages.records;
          if (messages.length > 0) {
            console.log(`✅ [CODECHAT] ${messages.length} mensagens encontradas com formato: ${remoteJid}`);
            return messages;
          }
        }
        
        console.log(`📨 [CODECHAT] Nenhuma mensagem encontrada com formato: ${remoteJid}`);
      }
      
      console.log(`📨 [CODECHAT] Nenhuma mensagem encontrada para ${chatId} em nenhum formato`);
      return [];
    } catch (error) {
      console.error(`❌ [CODECHAT] Erro ao buscar mensagens:`, error);
      throw error;
    }
  }

  // POST /chat/fetchProfilePictureUrl/:instanceName
  async fetchProfilePictureUrl(instanceName: string, contactId: string): Promise<string | null> {
    try {
      const response = await this.makeRequest(`/chat/fetchProfilePictureUrl/${instanceName}`, {
        method: 'POST',
        body: JSON.stringify({ number: contactId }),
      }, instanceName);
      
      return response?.profilePictureUrl || null;
    } catch (error) {
      console.warn(`⚠️ [CODECHAT] Erro ao buscar foto do perfil para ${contactId}:`, error);
      return null;
    }
  }

  // POST /chat/findContacts/:instanceName
  async findContacts(instanceName: string, contactId: string): Promise<CodeChatContact | null> {
    try {
      const response = await this.makeRequest(`/chat/findContacts/${instanceName}`, {
        method: 'POST',
        body: JSON.stringify({
          where: {
            remoteJid: contactId
          }
        }),
      }, instanceName);
      
      if (Array.isArray(response) && response.length > 0) {
        const contact = response[0];
        return {
          jid: contact.remoteJid,
          exists: true,
          name: contact.pushName || contact.name,
          profilePictureUrl: contact.profilePicUrl
        };
      }
      
      return null;
    } catch (error) {
      console.warn(`⚠️ [CODECHAT] Erro ao buscar contato ${contactId}:`, error);
      return null;
    }
  }

  // Método para mapear instanceId numérico para instanceName
  async getInstanceNameFromId(instanceId: number): Promise<string | null> {
    try {
      // Buscar todas as instâncias
      const response = await this.makeRequest('/instance/fetchInstances', {
        method: 'GET',
      });
      
      if (Array.isArray(response)) {
        const instance = response.find(inst => inst.id === instanceId);
        return instance?.name || null;
      }
      
      return null;
    } catch (error) {
      console.error(`❌ [CODECHAT] Erro ao mapear instanceId ${instanceId}:`, error);
      return null;
    }
  }

  // === MÉTODOS AUXILIARES SEGUROS ===

  // Extrair string segura de qualquer valor
  private safeExtractString(value: any): string {
    if (value === null || value === undefined) {
      return '';
    }
    
    if (typeof value === 'string') {
      return value.trim();
    }
    
    if (typeof value === 'number') {
      return value.toString();
    }
    
    if (typeof value === 'object' && value.toString) {
      return value.toString();
    }
    
    return '';
  }

  // Função auxiliar para normalizar número de telefone (COM VALIDAÇÃO)
  normalizePhoneNumber(phoneInput: any): string {
    console.log(`🔍 [CODECHAT] Normalizando telefone:`, phoneInput, `(tipo: ${typeof phoneInput})`);
    
    // Validação robusta de entrada
    let phoneNumber: string;
    
    if (phoneInput === null || phoneInput === undefined) {
      console.log(`⚠️ [CODECHAT] Telefone é null/undefined, usando fallback`);
      return 'unknown';
    }
    
    if (typeof phoneInput === 'string') {
      phoneNumber = phoneInput;
    } else if (typeof phoneInput === 'number') {
      phoneNumber = phoneInput.toString();
    } else if (typeof phoneInput === 'object' && phoneInput.toString) {
      phoneNumber = phoneInput.toString();
    } else {
      console.log(`⚠️ [CODECHAT] Tipo de telefone inválido: ${typeof phoneInput}, usando fallback`);
      return 'unknown';
    }
    
    // Remover caracteres não numéricos
    let cleanedNumber = phoneNumber.replace(/\D/g, '');

    if (cleanedNumber.length < 10) {
      console.log(`⚠️ [CODECHAT] Número muito curto: ${cleanedNumber}`);
      return cleanedNumber || 'unknown';
    }

    // Remover DDI 55 se presente para normalização
    if (cleanedNumber.startsWith('55') && cleanedNumber.length >= 12) {
      cleanedNumber = cleanedNumber.slice(2);
    }

    console.log(`✅ [CODECHAT] Telefone normalizado: ${cleanedNumber}`);
    return cleanedNumber;
  }

  // Função auxiliar para formatar número para exibição
  formatPhoneForDisplay(phoneInput: any): string {
    const cleanedNumber = this.normalizePhoneNumber(phoneInput);
    
    if (cleanedNumber === 'unknown') {
      return 'Número inválido';
    }

    if (cleanedNumber.length === 10) {
      return cleanedNumber.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3');
    } else if (cleanedNumber.length === 11) {
      return cleanedNumber.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
    }

    return cleanedNumber;
  }

  // Função para formatar nome do cliente (COM VALIDAÇÃO)
  private formatCustomerName(rawName: string, phoneNumber: string): string {
    try {
      if (!rawName || rawName.trim() === '') {
        return this.formatPhoneForDisplay(phoneNumber);
      }

      const cleanName = rawName.trim();
      
      // Se é apenas um número, usar formato de telefone
      if (/^\d+$/.test(cleanName)) {
        return this.formatPhoneForDisplay(phoneNumber);
      }
      
      // Se contém @ (email), usar telefone
      if (cleanName.includes('@')) {
        return this.formatPhoneForDisplay(phoneNumber);
      }
      
      // Se é muito curto (menos de 2 caracteres), usar telefone
      if (cleanName.length < 2) {
        return this.formatPhoneForDisplay(phoneNumber);
      }
      
      // Se parece com um ID de usuário, usar telefone
      if (cleanName.startsWith('user_') || cleanName.startsWith('contact_')) {
        return this.formatPhoneForDisplay(phoneNumber);
      }
      
      // Nome válido - capitalizar primeira letra de cada palavra
      return cleanName
        .split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(' ');
        
    } catch (error) {
      console.error(`❌ [CODECHAT] Erro ao formatar nome:`, error);
      return this.formatPhoneForDisplay(phoneNumber);
    }
  }
}

export const codeChatApiService = new CodeChatApiService();
export default codeChatApiService;
