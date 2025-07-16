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
        
        // Verificar se instância foi conectada
        const status = await codechatService.getInstanceStatus(instanceId);
        if (status.state === 'open') {
          console.log(`🎉 [WEBHOOK-FALLBACK] Instância conectada durante polling`);
          return;
        }
        
        // Continuar polling se não chegou no limite
        if (attempts < maxAttempts) {
          const timeout = setTimeout(pollFunction, 3000);
          this.pollTimeouts.set(instanceId, timeout);
        } else {
          console.warn(`⚠️ [WEBHOOK-FALLBACK] Timeout após ${maxAttempts} tentativas`);
          
          // Verificar se instância está "morta" e precisa ser reiniciada
          if (status.state === 'connecting' && response.connectionStatus === 'OFFLINE') {
            console.log(`🔄 [WEBHOOK-FALLBACK] Instância pode estar morta, tentando restart`);
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
      
      // Tentar deletar instância existente
      try {
        await codechatService.deleteInstance(instanceId);
        console.log(`🗑️ [RESTART] Instância deletada`);
        
        // Aguardar um pouco antes de recriar
        await new Promise(resolve => setTimeout(resolve, 2000));
        
      } catch (deleteError) {
        console.warn(`⚠️ [RESTART] Erro ao deletar (pode não existir):`, deleteError);
      }
      
      // Recriar instância
      const createResult = await codechatService.createInstance(instanceId);
      if (createResult.success || createResult.status === 'already_exists') {
        console.log(`✅ [RESTART] Instância recriada`);
        
        // Reconectar
        const connectResult = await codechatService.connectInstance(instanceId);
        if (connectResult.success) {
          console.log(`🔌 [RESTART] Instância reconectada`);
          
          // Reiniciar polling
          this.startFallbackPolling(instanceId, codechatService, 20);
          
          toast({
            title: "🔄 Instância Reiniciada",
            description: "Tentando gerar novo QR Code...",
          });
        }
      }
      
    } catch (error) {
      console.error(`❌ [RESTART] Erro ao reiniciar instância:`, error);
      
      toast({
        title: "Erro no Restart",
        description: "Não foi possível reiniciar a instância",
        variant: "destructive",
      });
    }
  }

  // ============ EXTRAÇÃO DE QR CODE ============
  private extractQRFromResponse(response: any): string | null {
    // Verificar múltiplos campos onde QR Code pode estar
    const possiblePaths = [
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
    ];

    for (const path of possiblePaths) {
      if (typeof path === 'string' && path.length > 50) {
        // Verificar se é base64 válido
        if (path.startsWith('data:image/') || path.includes('base64')) {
          return path;
        }
        // Se for string longa mas não base64, pode ser código QR texto
        if (path.length > 100 && !path.includes(' ')) {
          return `data:image/png;base64,${path}`;
        }
      }
    }

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