import { yumerJwtService } from '@/services/yumerJwtService';
import { contactNameService } from '@/services/contactNameService';

export interface CodeChatInstance {
  id: number;
  instance_id: string;
  phone_number: string;
  status: string;
  client_id: string;
  created_at: string;
  updated_at: string;
}

export interface CodeChatMessage {
  id: string;
  keyId: string;
  keyFromMe: boolean;
  keyRemoteJid: string;
  keyParticipant: string;
  pushName: string;
  messageType: string;
  content: string;
  messageTimestamp: number;
  device: string;
  instanceId: number;
}

class BaseApiService {
  protected readonly baseUrl: string;

  constructor() {
    this.baseUrl = process.env.NEXT_PUBLIC_CODECHAT_API_URL || 'http://localhost:3001';
  }
}

class CodeChatApiService extends BaseApiService {
  /**
   * Buscar instâncias do cliente
   */
  async getClientInstances(clientId: string): Promise<CodeChatInstance[]> {
    try {
      const token = yumerJwtService.getClientToken(clientId);
      if (!token) {
        console.error('❌ [CODECHAT] Token não encontrado para cliente:', clientId);
        return [];
      }

      console.log('🔐 [CODECHAT] Usando JWT Token do cliente:', clientId);

      const url = `${this.baseUrl}/instance/list`;
      console.log('📡 [CODECHAT] Request:', 'GET', url);

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json'
        }
      });

      console.log('✅ [CODECHAT] Response:', url, response.status, response.statusText);

      if (!response.ok) {
        console.warn('⚠️ [CODECHAT] Resposta não ok:', response.status, response.statusText);
        return [];
      }

      const data = await response.json();
      console.log('✅ [CODECHAT] Instâncias encontradas:', data.length);
      return data as CodeChatInstance[];

    } catch (error) {
      console.error('❌ [CODECHAT] Erro ao buscar instâncias:', error);
      return [];
    }
  }

  /**
   * Buscar chats da instância
   */
  async findChats(instanceName: string, limit: number = 50): Promise<any[]> {
    try {
      const token = yumerJwtService.getInstanceToken(instanceName);
      if (!token) {
        console.error('❌ [CODECHAT] Token não encontrado para instância:', instanceName);
        return [];
      }

      console.log('🔐 [CODECHAT] Usando JWT Token da instância:', instanceName);

      const url = `${this.baseUrl}/chat/find`;
      console.log('📡 [CODECHAT] Request:', 'POST', url);

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          instanceName: instanceName,
          offset: 0,
          limit: limit
        })
      });

      console.log('✅ [CODECHAT] Response:', url, response.status, response.statusText);

      if (!response.ok) {
        console.warn('⚠️ [CODECHAT] Resposta não ok:', response.status, response.statusText);
        return [];
      }

      const data = await response.json();
      console.log('✅ [CODECHAT] Chats encontrados:', data.chats.length);
      return data.chats;

    } catch (error) {
      console.error('❌ [CODECHAT] Erro ao buscar chats:', error);
      return [];
    }
  }

  /**
   * Buscar mensagens com múltiplos formatos e extração de nomes melhorada
   */
  async findMessages(instanceName: string, chatId: string, limit: number = 50): Promise<CodeChatMessage[]> {
    console.log('🔍 [CODECHAT] Buscando mensagens para chat', chatId, 'na instância:', instanceName);
    
    // Formatos de busca otimizados
    const searchFormats = [
      chatId, // Formato original
      `${chatId}@s.whatsapp.net`, // Formato WhatsApp padrão
      `55${chatId}@s.whatsapp.net`, // Com DDI brasileiro
      `${chatId}@c.us`, // Formato alternativo
      `55${chatId}@c.us` // Com DDI alternativo
    ];

    console.log('🔍 [CODECHAT] Tentando formatos de busca:', searchFormats.length, searchFormats);

    for (const format of searchFormats) {
      try {
        console.log('🔍 [CODECHAT] Testando formato:', format);
        
        const token = yumerJwtService.getInstanceToken(instanceName);
        if (!token) {
          console.error('❌ [CODECHAT] Token não encontrado para instância:', instanceName);
          continue;
        }

        console.log('🔐 [CODECHAT] Usando JWT Token da instância:', instanceName);

        const url = `${this.baseUrl}/chat/findMessages/${instanceName}`;
        console.log('📡 [CODECHAT] Request:', 'POST', url);

        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/json'
          },
          body: JSON.stringify({
            where: {
              keyRemoteJid: format
            },
            offset: 0,
            limit: limit
          })
        });

        console.log('✅ [CODECHAT] Response:', url, response.status, response.statusText);

        if (!response.ok) {
          console.warn('⚠️ [CODECHAT] Resposta não ok:', response.status, response.statusText);
          continue;
        }

        const data = await response.json();
        console.log('📨 [CODECHAT] Data structure:', Object.keys(data));

        if (data.messages && data.messages.records && Array.isArray(data.messages.records)) {
          const messages = data.messages.records;
          console.log('✅ [CODECHAT] Mensagens encontradas com formato:', format, messages.length);
          
          if (messages.length > 0) {
            // Processar mensagens e extrair nomes
            const processedMessages = this.processMessagesWithNames(messages, chatId);
            return processedMessages;
          }
        }

        console.log('📨 [CODECHAT] Nenhuma mensagem encontrada com formato:', format);
        
      } catch (error) {
        console.error('❌ [CODECHAT] Erro ao buscar com formato', format, ':', error);
        continue;
      }
    }

    console.log('❌ [CODECHAT] Nenhuma mensagem encontrada em nenhum formato');
    return [];
  }

  /**
   * Processar mensagens e extrair nomes reais dos contatos
   */
  private processMessagesWithNames(messages: any[], chatId: string): CodeChatMessage[] {
    console.log('🔧 [CODECHAT] Processando mensagens para extração de nomes');

    const processedMessages: CodeChatMessage[] = [];
    let detectedContactName: string | undefined;
    let firstCustomerMessage: string | undefined;

    for (const msg of messages) {
      try {
        // Extrair nome do pushName se disponível
        if (msg.pushName && !msg.keyFromMe && !detectedContactName) {
          const nameData = contactNameService.extractRealContactName(
            msg.pushName,
            chatId
          );
          
          if (nameData.confidence === 'high') {
            detectedContactName = nameData.name;
            console.log('👤 [CODECHAT] Nome detectado via pushName:', detectedContactName);
          }
        }

        // Capturar primeira mensagem do cliente para extração de nome
        if (!msg.keyFromMe && !firstCustomerMessage && msg.content) {
          firstCustomerMessage = msg.content;
        }

        // Processar mensagem
        const processedMessage: CodeChatMessage = {
          id: msg.id || `msg_${Date.now()}_${Math.random()}`,
          keyId: msg.keyId,
          keyFromMe: msg.keyFromMe || false,
          keyRemoteJid: msg.keyRemoteJid,
          keyParticipant: msg.keyParticipant || '',
          pushName: msg.pushName || detectedContactName || '',
          messageType: msg.messageType || 'text',
          content: this.extractMessageContent(msg),
          messageTimestamp: msg.messageTimestamp,
          device: msg.device || 'unknown',
          instanceId: msg.instanceId
        };

        processedMessages.push(processedMessage);

      } catch (error) {
        console.error('❌ [CODECHAT] Erro ao processar mensagem:', error);
      }
    }

    // Tentar extrair nome da primeira mensagem se não encontrou via pushName
    if (!detectedContactName && firstCustomerMessage) {
      const nameData = contactNameService.extractRealContactName(
        undefined,
        chatId,
        firstCustomerMessage
      );
      
      if (nameData.confidence === 'medium' || nameData.confidence === 'high') {
        detectedContactName = nameData.name;
        console.log('👤 [CODECHAT] Nome detectado via primeira mensagem:', detectedContactName);
        
        // Atualizar pushName nas mensagens
        processedMessages.forEach(msg => {
          if (!msg.keyFromMe && !msg.pushName) {
            msg.pushName = detectedContactName;
          }
        });
      }
    }

    console.log(`✅ [CODECHAT] ${processedMessages.length} mensagens processadas${detectedContactName ? ` com nome: ${detectedContactName}` : ''}`);
    return processedMessages;
  }

  /**
   * Extrair conteúdo da mensagem
   */
  private extractMessageContent(msg: any): string {
    if (!msg) return '';

    // Priorizar texto
    if (msg.text) return msg.text;
    if (msg.conversation) return msg.conversation;

    // Outros tipos
    if (msg.image) return '[IMAGEM]';
    if (msg.video) return '[VÍDEO]';
    if (msg.audio) return '[ÁUDIO]';
    if (msg.document) return '[DOCUMENTO]';
    if (msg.location) return '[LOCALIZAÇÃO]';
    if (msg.contact) return '[CONTATO]';

    return '[Mensagem sem conteúdo]';
  }

  /**
   * Extrair número de telefone
   */
  extractPhoneNumber(chatId: string): string {
    if (!chatId) return '';
    
    // Remover sufixos do WhatsApp (@c.us, @s.whatsapp.net, @g.us)
    let phone = chatId.split('@')[0];
    
    // Remover caracteres não numéricos
    phone = phone.replace(/\D/g, '');
    
    return phone;
  }

  /**
   * Formatar telefone para exibição
   */
  formatPhoneForDisplay(phoneNumber: string): string {
    if (!phoneNumber) return 'Telefone inválido';
    
    const cleanedNumber = phoneNumber.replace(/\D/g, '');

    // Formato brasileiro com DDI
    if (cleanedNumber.length === 13 && cleanedNumber.startsWith('55')) {
      const ddd = cleanedNumber.substring(2, 4);
      const number = cleanedNumber.substring(4);
      
      if (number.length === 9) {
        return `(${ddd}) ${number.substring(0, 5)}-${number.substring(5)}`;
      } else if (number.length === 8) {
        return `(${ddd}) ${number.substring(0, 4)}-${number.substring(4)}`;
      }
    }

    // Formato brasileiro sem DDI
    if (cleanedNumber.length === 11) {
      const ddd = cleanedNumber.substring(0, 2);
      const number = cleanedNumber.substring(2);
      return `(${ddd}) ${number.substring(0, 5)}-${number.substring(5)}`;
    } else if (cleanedNumber.length === 10) {
      const ddd = cleanedNumber.substring(0, 2);
      const number = cleanedNumber.substring(2);
      return `(${ddd}) ${number.substring(0, 4)}-${number.substring(4)}`;
    }

    return phoneNumber;
  }
}

export const codechatApiService = new CodeChatApiService();
export default codechatApiService;
