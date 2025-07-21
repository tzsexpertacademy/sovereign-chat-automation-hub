
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

  // GET /chat/findChats/:instanceName
  async findChats(instanceName: string): Promise<CodeChatChat[]> {
    try {
      console.log(`📊 [CODECHAT] Buscando chats para instância: ${instanceName}`);
      const response = await this.makeRequest(`/chat/findChats/${instanceName}`, {
        method: 'GET',
      }, instanceName);
      
      console.log(`🔍 [CODECHAT] Dados brutos recebidos:`, JSON.stringify(response, null, 2));
      
      // Normalizar dados retornados
      if (Array.isArray(response)) {
        const normalizedChats = response.map((chat, index) => {
          console.log(`🔍 [CODECHAT] Processando chat ${index + 1}:`, chat);
          
          // Extrair chatId com múltiplas tentativas
          const chatId = this.extractChatId(chat);
          
          return {
            id: chatId,
            name: this.safeExtractString(chat.name) || this.safeExtractString(chat.pushName) || 'Contato sem nome',
            isGroup: Boolean(chat.isGroup),
            lastMessage: this.safeExtractString(chat.lastMessage?.body) || this.safeExtractString(chat.lastMessage?.content) || '',
            lastMessageTime: chat.lastMessage?.timestamp || chat.timestamp,
            unreadCount: Number(chat.unreadCount) || 0,
            profilePictureUrl: this.safeExtractString(chat.profilePictureUrl),
            participants: Array.isArray(chat.participants) ? chat.participants : []
          };
        }).filter(chat => chat.id); // Filtrar chats sem ID válido
        
        console.log(`✅ [CODECHAT] ${normalizedChats.length} chats normalizados de ${response.length} originais`);
        return normalizedChats;
      }
      
      console.warn(`⚠️ [CODECHAT] Resposta não é array:`, response);
      return [];
    } catch (error) {
      console.error(`❌ [CODECHAT] Erro ao buscar chats:`, error);
      throw error;
    }
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

  // Extrair chatId com múltiplas tentativas
  private extractChatId(chatData: any): string {
    console.log(`🔍 [CODECHAT] Extraindo chatId de:`, chatData);
    
    // Tentar múltiplos campos possíveis
    const possibleIds = [
      chatData?.id,
      chatData?.chatId,
      chatData?.jid,
      chatData?.remoteJid,
      chatData?.key?.remoteJid,
      chatData?.keyRemoteJid
    ];
    
    for (const id of possibleIds) {
      const safeId = this.safeExtractString(id);
      if (safeId && safeId.length > 0) {
        console.log(`✅ [CODECHAT] ChatId extraído: ${safeId}`);
        return safeId;
      }
    }
    
    console.warn(`⚠️ [CODECHAT] Nenhum chatId válido encontrado em:`, chatData);
    return `unknown_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

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

  // Função para extrair nome do contato de dados complexos (COM VALIDAÇÃO)
  extractContactName(chatData: any, chatId: string): string {
    console.log(`🔍 [CODECHAT] Extraindo nome do contato:`, chatData);
    
    try {
      // Estratégia 1: Nome direto do chat
      const chatName = this.safeExtractString(chatData?.name);
      if (chatName && chatName.length > 1 && !chatName.includes('@') && !chatName.match(/^\d+$/)) {
        const formattedName = this.formatCustomerName(chatName, chatId);
        console.log(`✅ [CODECHAT] Nome extraído (chat.name): ${formattedName}`);
        return formattedName;
      }
      
      // Estratégia 2: pushName
      const pushName = this.safeExtractString(chatData?.pushName);
      if (pushName && pushName.length > 1 && !pushName.includes('@') && !pushName.match(/^\d+$/)) {
        const formattedName = this.formatCustomerName(pushName, chatId);
        console.log(`✅ [CODECHAT] Nome extraído (pushName): ${formattedName}`);
        return formattedName;
      }
      
      // Estratégia 3: dados do contato
      const contactName = this.safeExtractString(chatData?.contact?.name) || this.safeExtractString(chatData?.contact?.pushname);
      if (contactName && contactName.length > 1 && !contactName.includes('@') && !contactName.match(/^\d+$/)) {
        const formattedName = this.formatCustomerName(contactName, chatId);
        console.log(`✅ [CODECHAT] Nome extraído (contact): ${formattedName}`);
        return formattedName;
      }
      
      // Fallback: usar número formatado
      const fallbackName = this.formatPhoneForDisplay(this.normalizePhoneNumber(chatId));
      console.log(`⚠️ [CODECHAT] Usando fallback para nome: ${fallbackName}`);
      return fallbackName;
      
    } catch (error) {
      console.error(`❌ [CODECHAT] Erro ao extrair nome do contato:`, error);
      return this.formatPhoneForDisplay(chatId);
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
