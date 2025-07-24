// Serviço para gerenciar webhooks de QR Code e fallbacks
import { toast } from "@/hooks/use-toast";

interface QRCodeWebhookData {
  event: 'qrcode.updated';
  instance: {
    name: string;
    id: number;
  };
  date: {
    qrcode: {
      code: string;
      base64: string;
    };
  };
}

interface QRCodeStorage {
  instanceId: string;
  qrCode: string;
  timestamp: number;
  source: 'webhook' | 'polling';
}

class WebhookQRService {
  private qrCodeStorage = new Map<string, QRCodeStorage>();
  private listeners = new Map<string, ((qrData: QRCodeStorage) => void)[]>();
  private pollTimeouts = new Map<string, NodeJS.Timeout>();

  // ============ WEBHOOK RECEIVER ============
  async setupWebhookListener() {
    // Event listener para webhooks via MessageChannel/postMessage
    window.addEventListener('qrcode-webhook', (event: any) => {
      const data = event.detail as QRCodeWebhookData;
      this.handleQRCodeWebhook(data);
    });

    console.log('🎯 [WEBHOOK] Listener de webhooks configurado');
  }

  private handleQRCodeWebhook(data: QRCodeWebhookData) {
    try {
      console.log('📨 [WEBHOOK] QR Code recebido via webhook:', data);
      
      const instanceId = data.instance.name;
      const qrCode = data.date.qrcode.base64;
      
      if (!qrCode) {
        console.warn('⚠️ [WEBHOOK] QR Code vazio no webhook');
        return;
      }

      const qrData: QRCodeStorage = {
        instanceId,
        qrCode,
        timestamp: Date.now(),
        source: 'webhook'
      };

      // Armazenar QR Code
      this.qrCodeStorage.set(instanceId, qrData);
      
      // Notificar listeners
      this.notifyListeners(instanceId, qrData);
      
      console.log(`✅ [WEBHOOK] QR Code processado para ${instanceId}`);
      
    } catch (error) {
      console.error('❌ [WEBHOOK] Erro ao processar webhook:', error);
    }
  }

  // ============ FALLBACK POLLING ============
  startFallbackPolling(instanceId: string, codechatService: any, maxAttempts: number = 30) {
    // Limpar polling anterior se existir
    this.stopFallbackPolling(instanceId);
    
    console.log(`🔄 [WEBHOOK-FALLBACK] Iniciando polling para ${instanceId}`);
    
    let attempts = 0;
    
    const pollFunction = async () => {
      try {
        attempts++;
        console.log(`🔍 [WEBHOOK-FALLBACK] Tentativa ${attempts}/${maxAttempts} - ${instanceId}`);
        
        // Verificar se já temos QR Code via webhook
        const existing = this.qrCodeStorage.get(instanceId);
        if (existing && existing.source === 'webhook') {
          console.log(`✅ [WEBHOOK-FALLBACK] QR Code já recebido via webhook`);
          return;
        }
        
        // Tentar buscar via API
        const response = await codechatService.getInstanceDetails(instanceId);
        const qrCode = this.extractQRFromResponse(response);
        
        if (qrCode) {
          console.log(`🎯 [WEBHOOK-FALLBACK] QR Code encontrado via polling`);
          
          const qrData: QRCodeStorage = {
            instanceId,
            qrCode,
            timestamp: Date.now(),
            source: 'polling'
          };
          
          this.qrCodeStorage.set(instanceId, qrData);
          this.notifyListeners(instanceId, qrData);
          return;
        }
        
        // Verificar status da instância para detectar instâncias mortas
        const statusData = await codechatService.getInstanceStatus(instanceId);
        
        // Verificar se instância está "morta" (connecting + OFFLINE por muito tempo)
        const isDeadInstance = (
          statusData.state === 'connecting' && 
          response.connectionStatus === 'OFFLINE' && 
          attempts >= 10 // Após 10 tentativas (30 segundos)
        );
        
        if (isDeadInstance) {
          console.log(`💀 [WEBHOOK-FALLBACK] Instância morta detectada: state=${statusData.state}, status=${response.connectionStatus}`);
          this.tryInstanceRestart(instanceId, codechatService);
          return;
        }
        
        // Verificar se instância foi conectada
        if (statusData.state === 'open') {
          console.log(`🎉 [WEBHOOK-FALLBACK] Instância conectada durante polling`);
          return;
        }
        
        // Continuar polling se não chegou no limite
        if (attempts < maxAttempts) {
          const timeout = setTimeout(pollFunction, 3000);
          this.pollTimeouts.set(instanceId, timeout);
        } else {
          console.warn(`⚠️ [WEBHOOK-FALLBACK] Timeout após ${maxAttempts} tentativas`);
          
          // Se chegou ao limite, tentar restart da instância morta
          const finalStatus = await codechatService.getInstanceStatus(instanceId);
          const finalDetails = await codechatService.getInstanceDetails(instanceId);
          
          if (finalStatus.state === 'connecting' && finalDetails.connectionStatus === 'OFFLINE') {
            console.log(`🔄 [WEBHOOK-FALLBACK] Forçando restart de instância morta após timeout`);
            this.tryInstanceRestart(instanceId, codechatService);
          }
        }
        
      } catch (error) {
        console.warn(`⚠️ [WEBHOOK-FALLBACK] Erro na tentativa ${attempts}:`, error);
        
        if (attempts < maxAttempts) {
          const timeout = setTimeout(pollFunction, 3000);
          this.pollTimeouts.set(instanceId, timeout);
        }
      }
    };
    
    // Iniciar primeiro poll
    pollFunction();
  }

  stopFallbackPolling(instanceId: string) {
    const timeout = this.pollTimeouts.get(instanceId);
    if (timeout) {
      clearTimeout(timeout);
      this.pollTimeouts.delete(instanceId);
      console.log(`🛑 [WEBHOOK-FALLBACK] Polling parado para ${instanceId}`);
    }
  }

  // ============ RESTART DE INSTÂNCIA "MORTA" ============
  private async tryInstanceRestart(instanceId: string, codechatService: any) {
    try {
      console.log(`🔄 [RESTART] Tentando reiniciar instância morta: ${instanceId}`);
      
      // Parar polling atual
      this.stopFallbackPolling(instanceId);
      
      toast({
        title: "🔄 Reiniciando Instância",
        description: "Detectada instância morta, reiniciando...",
      });
      
      // Etapa 1: Tentar deletar instância existente
      try {
        console.log(`🗑️ [RESTART] Deletando instância morta...`);
        await codechatService.deleteInstance(instanceId);
        console.log(`✅ [RESTART] Instância deletada`);
        
        // Aguardar um pouco antes de recriar
        await new Promise(resolve => setTimeout(resolve, 3000));
        
      } catch (deleteError) {
        console.warn(`⚠️ [RESTART] Erro ao deletar (pode não existir):`, deleteError);
      }
      
      // Etapa 2: Recriar instância
      console.log(`📝 [RESTART] Recriando instância...`);
      const createResult = await codechatService.createInstance(instanceId);
      
      if (!createResult.success && createResult.status !== 'already_exists') {
        throw new Error(`Falha ao recriar: ${createResult.error}`);
      }
      
      console.log(`✅ [RESTART] Instância recriada`);
      
      // Aguardar mais um pouco antes de conectar
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Etapa 3: Reconectar
      console.log(`🔌 [RESTART] Reconectando instância...`);
      const connectResult = await codechatService.connectInstance(instanceId);
      
      if (!connectResult.success) {
        throw new Error(`Falha na reconexão: ${connectResult.error}`);
      }
      
      console.log(`🎉 [RESTART] Instância reconectada com sucesso`);
      
      // Etapa 4: Reiniciar polling com timeout menor
      console.log(`🔍 [RESTART] Reiniciando polling otimizado...`);
      this.startFallbackPolling(instanceId, codechatService, 20); // Menos tentativas
      
      toast({
        title: "✅ Instância Reiniciada",
        description: "Tentando gerar novo QR Code...",
      });
      
    } catch (error) {
      console.error(`❌ [RESTART] Erro ao reiniciar instância:`, error);
      
      toast({
        title: "❌ Erro no Restart",
        description: `Falha ao reiniciar: ${error.message}`,
        variant: "destructive",
      });
      
      // Se o restart falhou, limpar tudo
      this.clearQRCode(instanceId);
    }
  }

  // ============ EXTRAÇÃO DE QR CODE MELHORADA ============
  private extractQRFromResponse(response: any): string | null {
    console.log(`🔍 [QR-EXTRACT] Analisando resposta:`, {
      hasWhatsapp: !!response?.Whatsapp,
      hasQrcode: !!response?.qrcode,
      hasData: !!response?.data,
      connectionStatus: response?.connectionStatus,
      state: response?.Whatsapp?.connection?.state
    });
    
    // Verificar múltiplos campos onde QR Code pode estar
    const possiblePaths = [
      // Campos principais do CodeChat
      response?.Whatsapp?.qrcode?.base64,
      response?.Whatsapp?.qrcode?.code,
      response?.Whatsapp?.qr?.base64,
      response?.Whatsapp?.qr,
      response?.qrcode?.base64,
      response?.qrcode?.code,
      response?.qr?.base64,
      response?.qr,
      response?.data?.qrcode?.base64,
      response?.data?.qr,
      response?.instance?.qrcode?.base64,
      response?.instance?.qr,
      response?.qrCode,
      response?.base64,
      // Campos adicionais que podem existir
      response?.Auth?.qrcode,
      response?.Auth?.qr,
    ];

    for (const path of possiblePaths) {
      if (typeof path === 'string' && path.length > 50) {
        console.log(`🎯 [QR-EXTRACT] QR Code encontrado, tamanho: ${path.length}`);
        
        // Verificar se é base64 válido
        if (path.startsWith('data:image/') || path.includes('base64')) {
          return path;
        }
        // Se for string longa mas não base64, pode ser código QR texto
        if (path.length > 100 && !path.includes(' ')) {
          // Se já não contém prefixo, adicionar
          if (!path.startsWith('data:image/')) {
            return `data:image/png;base64,${path}`;
          }
          return path;
        }
      }
    }

    console.log(`❌ [QR-EXTRACT] QR Code não encontrado na resposta`);
    return null;
  }

  // ============ LISTENERS ============
  addQRCodeListener(instanceId: string, callback: (qrData: QRCodeStorage) => void) {
    if (!this.listeners.has(instanceId)) {
      this.listeners.set(instanceId, []);
    }
    this.listeners.get(instanceId)!.push(callback);
    
    // Se já temos QR Code, notificar imediatamente
    const existing = this.qrCodeStorage.get(instanceId);
    if (existing) {
      callback(existing);
    }
  }

  removeQRCodeListener(instanceId: string, callback: (qrData: QRCodeStorage) => void) {
    const listeners = this.listeners.get(instanceId);
    if (listeners) {
      const index = listeners.indexOf(callback);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    }
  }

  private notifyListeners(instanceId: string, qrData: QRCodeStorage) {
    const listeners = this.listeners.get(instanceId);
    if (listeners) {
      listeners.forEach(callback => {
        try {
          callback(qrData);
        } catch (error) {
          console.error('❌ [WEBHOOK] Erro em listener:', error);
        }
      });
    }
  }

  // ============ PÚBLICO ============
  getQRCode(instanceId: string): QRCodeStorage | null {
    return this.qrCodeStorage.get(instanceId) || null;
  }

  hasQRCode(instanceId: string): boolean {
    return this.qrCodeStorage.has(instanceId);
  }

  clearQRCode(instanceId: string) {
    this.qrCodeStorage.delete(instanceId);
    this.stopFallbackPolling(instanceId);
    this.listeners.delete(instanceId);
  }

  cleanup() {
    // Limpar todos os timeouts
    this.pollTimeouts.forEach((timeout) => clearTimeout(timeout));
    this.pollTimeouts.clear();
    
    // Limpar storages
    this.qrCodeStorage.clear();
    this.listeners.clear();
    
    console.log('🧹 [WEBHOOK] Cleanup completo');
  }
}

// Instância singleton
export const webhookQRService = new WebhookQRService();

// Inicializar automaticamente
webhookQRService.setupWebhookListener();