
// CodeChat API v1.3.0 Service - Integração com a API oficial
import { yumerJwtService } from './yumerJwtService';

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

// Service para integração com CodeChat API v1.3.0
class CodeChatApiService {
  private baseUrl = 'https://yumer.yumerflow.app:8083';
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
    const url = `${this.baseUrl}${endpoint}`;
    
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

  // NOVO: Debugar estrutura completa da API
  async debugApiStructure(instanceName: string): Promise<void> {
    console.log(`🔍 [DEBUG] Iniciando debug completo da API para: ${instanceName}`);
    
    try {
      // 1. Testar findChats com debug completo
      const chatsResponse = await this.makeRequest(`/chat/findChats/${instanceName}`, {
        method: 'GET',
      }, instanceName);
      
      console.log(`🔍 [DEBUG] Estrutura completa de findChats:`, JSON.stringify(chatsResponse, null, 2));
      
      if (Array.isArray(chatsResponse) && chatsResponse.length > 0) {
        console.log(`🔍 [DEBUG] Primeiro chat (exemplo):`, JSON.stringify(chatsResponse[0], null, 2));
        console.log(`🔍 [DEBUG] Campos disponíveis no chat:`, Object.keys(chatsResponse[0]));
      }

      // 2. Testar findContacts como alternativa
      try {
        const contactsResponse = await this.makeRequest(`/chat/findContacts/${instanceName}`, {
          method: 'POST',
          body: JSON.stringify({
            where: {}
          }),
        }, instanceName);
        
        console.log(`🔍 [DEBUG] Estrutura de findContacts:`, JSON.stringify(contactsResponse, null, 2));
      } catch (contactError) {
        console.log(`⚠️ [DEBUG] findContacts não disponível:`, contactError);
      }

      // 3. Testar findMessages para ver estrutura de dados reais
      try {
        const messagesResponse = await this.makeRequest(`/chat/findMessages/${instanceName}`, {
          method: 'POST',
          body: JSON.stringify({
            where: {},
            limit: 5,
            offset: 0
          }),
        }, instanceName);
        
        console.log(`🔍 [DEBUG] Estrutura de findMessages:`, JSON.stringify(messagesResponse, null, 2));
        
        if (messagesResponse?.messages?.records && messagesResponse.messages.records.length > 0) {
          const firstMessage = messagesResponse.messages.records[0];
          console.log(`🔍 [DEBUG] Primeira mensagem (exemplo):`, JSON.stringify(firstMessage, null, 2));
          console.log(`🔍 [DEBUG] keyRemoteJid da mensagem:`, firstMessage.keyRemoteJid);
        }
      } catch (messageError) {
        console.log(`⚠️ [DEBUG] Erro ao testar findMessages:`, messageError);
      }

    } catch (error) {
      console.error(`❌ [DEBUG] Erro no debug da API:`, error);
    }
  }

  // CORRIGIDO: findChats com validação correta dos tipos
  async findChats(instanceName: string, options: {
    limit?: number;
    useMessages?: boolean;
    onProgress?: (current: number, total: number) => void;
  } = {}): Promise<CodeChatChat[]> {
    const { limit = 50, useMessages = true, onProgress } = options;
    
    try {
      console.log(`📊 [CODECHAT] Buscando chats para instância: ${instanceName} (limit: ${limit})`);
      
      // FASE 1: Debugar API primeiro
      await this.debugApiStructure(instanceName);
      
      // FASE 2: Estratégia principal - usar findChats
      let chats: any[] = [];
      
      try {
        const response = await this.makeRequest(`/chat/findChats/${instanceName}`, {
          method: 'GET',
        }, instanceName);
        
        console.log(`🔍 [CODECHAT] Resposta findChats:`, {
          type: typeof response,
          isArray: Array.isArray(response),
          length: Array.isArray(response) ? response.length : 'N/A'
        });
        
        if (Array.isArray(response)) {
          chats = response.slice(0, limit); // Limitar processamento
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
              limit: limit * 2, // Mais mensagens para extrair chats únicos
              offset: 0
            }),
          }, instanceName);
          
          if (messagesResponse?.messages?.records) {
            const uniqueChats = new Map();
            
            messagesResponse.messages.records.forEach((message: any) => {
              if (message.keyRemoteJid && !uniqueChats.has(message.keyRemoteJid)) {
                uniqueChats.set(message.keyRemoteJid, {
                  id: message.keyRemoteJid,
                  remoteJid: message.keyRemoteJid,
                  name: message.pushName || 'Contato',
                  isGroup: message.keyRemoteJid.includes('@g.us'),
                  lastMessage: this.extractMessageContent(message.content),
                  lastMessageTime: message.messageTimestamp,
                  unreadCount: 0
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

      // FASE 4: Buscar dados de contatos para complementar informações
      let contactsData: any[] = [];
      try {
        const contactsResponse = await this.makeRequest(`/chat/findContacts/${instanceName}`, {
          method: 'POST',
          body: JSON.stringify({
            where: {}
          }),
        }, instanceName);
        
        if (Array.isArray(contactsResponse)) {
          contactsData = contactsResponse;
          console.log(`✅ [CODECHAT] ${contactsData.length} contatos encontrados`);
        }
      } catch (contactError) {
        console.warn(`⚠️ [CODECHAT] Erro ao buscar contatos:`, contactError);
      }

      // FASE 5: Processar e validar chats
      if (chats.length === 0) {
        console.warn(`⚠️ [CODECHAT] Nenhum chat encontrado`);
        return [];
      }

      console.log(`🔄 [CODECHAT] Processando ${chats.length} chats...`);
      
      const validChats: CodeChatChat[] = [];
      
      for (let i = 0; i < chats.length; i++) {
        const chat = chats[i];
        onProgress?.(i + 1, chats.length);
        
        console.log(`📝 [${i + 1}/${chats.length}] Processando chat:`, chat);
        
        // Extrair número real do WhatsApp
        const phoneNumber = this.extractWhatsAppPhone(chat);
        
        if (phoneNumber) {
          // Buscar dados do contato correspondente
          const contactData = contactsData.find(contact => 
            contact.remoteJid === chat.remoteJid || 
            contact.remoteJid?.includes(phoneNumber)
          );
          
          const normalizedChat = {
            id: phoneNumber, // Usar número como ID real
            name: this.extractContactName(chat, phoneNumber, contactData),
            isGroup: this.isGroupChat(chat),
            lastMessage: this.extractMessageContent(chat.lastMessage) || 'Conversa importada',
            lastMessageTime: this.normalizeTimestamp(chat.lastMessageTime),
            unreadCount: Number(chat.unreadCount) || 0,
            profilePictureUrl: contactData?.profilePicUrl || null,
            participants: Array.isArray(chat.participants) ? chat.participants : []
          };
          
          validChats.push(normalizedChat);
          console.log(`✅ [CODECHAT] Chat válido: ${normalizedChat.name} (${phoneNumber})`);
        } else {
          console.log(`⏭️ [CODECHAT] Chat ${chat.id} pulado - sem número válido`);
        }
      }
      
      console.log(`✅ [CODECHAT] ${validChats.length} chats válidos de ${chats.length} processados`);
      return validChats;
      
    } catch (error) {
      console.error(`❌ [CODECHAT] Erro ao buscar chats:`, error);
      throw error;
    }
  }

  // CORRIGIDO: Extrair número real do WhatsApp com validação correta
  extractWhatsAppPhone(chat: any): string | null {
    console.log(`🔍 [CODECHAT] Extraindo telefone de:`, { 
      id: chat.id, 
      remoteJid: chat.remoteJid, 
      jid: chat.jid,
      keyRemoteJid: chat.keyRemoteJid 
    });
    
    // 1. Verificar se é chat de grupo (ignorar)
    if (this.isGroupChat(chat)) {
      console.log(`⏭️ [CODECHAT] Chat de grupo ignorado: ${chat.id}`);
      return null;
    }
    
    // 2. Tentar extrair número dos campos WhatsApp
    const possibleFields = [
      chat.remoteJid,
      chat.jid, 
      chat.keyRemoteJid,
      String(chat.id) // Converter ID para string se necessário
    ];
    
    for (const field of possibleFields) {
      if (field && typeof field === 'string') {
        // Formato padrão WhatsApp: 5511999999999@s.whatsapp.net
        if (field.includes('@s.whatsapp.net')) {
          const phoneNumber = field.split('@')[0];
          if (this.isValidPhoneNumber(phoneNumber)) {
            console.log(`📱 [CODECHAT] Número extraído de ${field}: ${phoneNumber}`);
            return this.normalizePhoneNumber(phoneNumber);
          }
        }
        
        // Formato com @c.us (mensagens enviadas)
        if (field.includes('@c.us')) {
          const phoneNumber = field.split('@')[0];
          if (this.isValidPhoneNumber(phoneNumber)) {
            console.log(`📱 [CODECHAT] Número extraído de ${field}: ${phoneNumber}`);
            return this.normalizePhoneNumber(phoneNumber);
          }
        }
        
        // Número direto (validar se é telefone real)
        if (this.isValidPhoneNumber(field)) {
          console.log(`📱 [CODECHAT] Número direto encontrado: ${field}`);
          return this.normalizePhoneNumber(field);
        }
      }
    }
    
    console.warn(`⚠️ [CODECHAT] Nenhum telefone válido encontrado para:`, chat);
    return null;
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

  // CORRIGIDO: Detectar chat de grupo usando apenas remoteJid
  private isGroupChat(chat: any): boolean {
    const remoteJid = chat.remoteJid || chat.jid || chat.keyRemoteJid;
    
    if (remoteJid && typeof remoteJid === 'string') {
      return remoteJid.includes('@g.us');
    }
    
    // Fallback: verificar propriedade isGroup se existir
    return chat.isGroup === true;
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

  // POST /chat/findMessages/:instanceName
  async findMessages(instanceName: string, chatId: string, limit: number = 50, offset: number = 0): Promise<CodeChatMessage[]> {
    try {
      console.log(`📨 [CODECHAT] Buscando mensagens para chat ${chatId} na instância: ${instanceName}`);
      
      const payload = {
        where: {
          keyRemoteJid: chatId
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
        return response.messages.records;
      }
      
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

    if (cleanedNumber.startsWith('55')) {
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

  // ATUALIZADO: Função para extrair nome do contato com dados de contacto integrados
  extractContactName(chatData: any, phoneNumber: string, contactData?: any): string {
    console.log(`🔍 [CODECHAT] Extraindo nome do contato:`, { chatData, contactData });
    
    try {
      // Estratégia 1: pushName do chat
      const chatPushName = this.safeExtractString(chatData?.pushName);
      if (chatPushName && chatPushName.length > 1 && !chatPushName.includes('@') && !chatPushName.match(/^\d+$/)) {
        const formattedName = this.formatCustomerName(chatPushName, phoneNumber);
        console.log(`✅ [CODECHAT] Nome extraído (chat.pushName): ${formattedName}`);
        return formattedName;
      }
      
      // Estratégia 2: pushName dos dados de contato
      const contactPushName = this.safeExtractString(contactData?.pushName);
      if (contactPushName && contactPushName.length > 1 && !contactPushName.includes('@') && !contactPushName.match(/^\d+$/)) {
        const formattedName = this.formatCustomerName(contactPushName, phoneNumber);
        console.log(`✅ [CODECHAT] Nome extraído (contact.pushName): ${formattedName}`);
        return formattedName;
      }
      
      // Estratégia 3: Nome direto do chat
      const chatName = this.safeExtractString(chatData?.name);
      if (chatName && chatName.length > 1 && !chatName.includes('@') && !chatName.match(/^\d+$/)) {
        const formattedName = this.formatCustomerName(chatName, phoneNumber);
        console.log(`✅ [CODECHAT] Nome extraído (chat.name): ${formattedName}`);
        return formattedName;
      }
      
      // Fallback: usar número formatado
      const fallbackName = this.formatPhoneForDisplay(this.normalizePhoneNumber(phoneNumber));
      console.log(`⚠️ [CODECHAT] Usando fallback para nome: ${fallbackName}`);
      return fallbackName;
      
    } catch (error) {
      console.error(`❌ [CODECHAT] Erro ao extrair nome do contato:`, error);
      return this.formatPhoneForDisplay(phoneNumber);
    }
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
