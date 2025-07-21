// Tipos do Yumer API
export interface YumerInstance {
  id: number;
  name: string;
  description?: string;
  connectionStatus: string;
  ownerJid?: string;
  profilePicUrl?: string;
  Auth: {
    token: string;
  };
}

export interface YumerMessage {
  id: number;
  keyId: string;
  keyFromMe: boolean;
  keyRemoteJid: string;
  messageType: string;
  content: any;
  messageTimestamp: number;
  device: string;
}

export interface YumerChat {
  id: string;
  name?: string;
  isGroup: boolean;
  lastMessage?: string;
  unreadCount: number;
}

export const yumerWhatsappService = {
  // Configurar webhook
  async configureWebhook(instanceId: string, config: any): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
      console.log(`🔧 [YUMER-WEBHOOK] Configurando webhook para: ${instanceId}`);
      
      const baseUrl = process.env.NEXT_PUBLIC_YUMER_WHATSAPP_API_URL || "";
      const apiKey = process.env.NEXT_PUBLIC_YUMER_WHATSAPP_API_KEY || "";

      const response = await fetch(`${baseUrl}/webhook/set/${instanceId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
          'apikey': apiKey
        },
        body: JSON.stringify(config)
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`❌ [YUMER-WEBHOOK] Erro HTTP ${response.status}:`, errorText);
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const data = await response.json();
      console.log(`✅ [YUMER-WEBHOOK] Webhook configurado:`, data);
      
      return { success: true, data };
    } catch (error) {
      console.error(`❌ [YUMER-WEBHOOK] Erro ao configurar webhook:`, error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Erro desconhecido' 
      };
    }
  },

  // Obter configuração do webhook
  async getWebhookConfig(instanceId: string): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
      console.log(`🔍 [YUMER-WEBHOOK] Obtendo config webhook para: ${instanceId}`);

      const baseUrl = process.env.NEXT_PUBLIC_YUMER_WHATSAPP_API_URL || "";
      const apiKey = process.env.NEXT_PUBLIC_YUMER_WHATSAPP_API_KEY || "";
      
      const response = await fetch(`${baseUrl}/webhook/find/${instanceId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'apikey': apiKey
        }
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`❌ [YUMER-WEBHOOK] Erro HTTP ${response.status}:`, errorText);
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const data = await response.json();
      console.log(`✅ [YUMER-WEBHOOK] Config obtida:`, data);
      
      return { success: true, data };
    } catch (error) {
      console.error(`❌ [YUMER-WEBHOOK] Erro ao obter config:`, error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Erro desconhecido' 
      };
    }
  },

  // Obter chats
  async getChats(instanceId: string): Promise<{ success: boolean; data?: any[]; error?: string }> {
    try {
      console.log(`📱 [YUMER-CHATS] Obtendo chats para: ${instanceId}`);

      const baseUrl = process.env.NEXT_PUBLIC_YUMER_WHATSAPP_API_URL || "";
      const apiKey = process.env.NEXT_PUBLIC_YUMER_WHATSAPP_API_KEY || "";
      
      const response = await fetch(`${baseUrl}/chat/findChats/${instanceId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'apikey': apiKey
        }
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`❌ [YUMER-CHATS] Erro HTTP ${response.status}:`, errorText);
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const data = await response.json();
      console.log(`✅ [YUMER-CHATS] ${data?.length || 0} chats obtidos`);
      
      return { success: true, data: Array.isArray(data) ? data : [] };
    } catch (error) {
      console.error(`❌ [YUMER-CHATS] Erro ao obter chats:`, error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Erro desconhecido' 
      };
    }
  },

  // Obter mensagens do chat
  async getChatMessages(instanceId: string, chatId: string, options?: any): Promise<{ success: boolean; data?: any[]; error?: string }> {
    try {
      console.log(`📨 [YUMER-MESSAGES] Obtendo mensagens do chat: ${chatId}`);

      const baseUrl = process.env.NEXT_PUBLIC_YUMER_WHATSAPP_API_URL || "";
      const apiKey = process.env.NEXT_PUBLIC_YUMER_WHATSAPP_API_KEY || "";
      
      const requestBody = {
        where: {
          keyRemoteJid: chatId
        },
        limit: options?.limit || 50,
        ...(options?.fromDate && {
          where: {
            ...{ keyRemoteJid: chatId },
            messageTimestamp: {
              gte: Math.floor(new Date(options.fromDate).getTime() / 1000)
            }
          }
        })
      };

      const response = await fetch(`${baseUrl}/chat/findMessages/${instanceId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
          'apikey': apiKey
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`❌ [YUMER-MESSAGES] Erro HTTP ${response.status}:`, errorText);
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const data = await response.json();
      const messages = data?.messages?.records || [];
      console.log(`✅ [YUMER-MESSAGES] ${messages.length} mensagens obtidas`);
      
      return { success: true, data: messages };
    } catch (error) {
      console.error(`❌ [YUMER-MESSAGES] Erro ao obter mensagens:`, error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Erro desconhecido' 
      };
    }
  },

  // Enviar mensagem
  async sendMessage(instanceId: string, chatId: string, message: string): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
      console.log(`📤 [YUMER-SEND] Enviando mensagem para: ${chatId}`);

      const baseUrl = process.env.NEXT_PUBLIC_YUMER_WHATSAPP_API_URL || "";
      const apiKey = process.env.NEXT_PUBLIC_YUMER_WHATSAPP_API_KEY || "";
      
      const response = await fetch(`${baseUrl}/message/sendText/${instanceId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
          'apikey': apiKey
        },
        body: JSON.stringify({
          number: chatId,
          options: {
            delay: 1200,
            presence: 'composing'
          },
          textMessage: {
            text: message
          }
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`❌ [YUMER-SEND] Erro HTTP ${response.status}:`, errorText);
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const data = await response.json();
      console.log(`✅ [YUMER-SEND] Mensagem enviada:`, data);
      
      return { success: true, data };
    } catch (error) {
      console.error(`❌ [YUMER-SEND] Erro ao enviar mensagem:`, error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Erro desconhecido' 
      };
    }
  }
};
