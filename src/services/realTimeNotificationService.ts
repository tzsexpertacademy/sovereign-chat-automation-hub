import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

interface NotificationConfig {
  sound: boolean;
  vibration: boolean;
  desktop: boolean;
  duration: number;
  priority: 'high' | 'medium' | 'low';
  autoClose: boolean;
}

interface NotificationData {
  type: 'new_ticket' | 'new_message' | 'queue_transfer' | 'connection_error' | 'message_delivered';
  title: string;
  description: string;
  data?: any;
  config?: Partial<NotificationConfig>;
}

const defaultConfig: NotificationConfig = {
  sound: true,
  vibration: true,
  desktop: true,
  duration: 5000,
  priority: 'medium',
  autoClose: true
};

class RealTimeNotificationService {
  private config: NotificationConfig = defaultConfig;
  private channels: Map<string, any> = new Map();
  private clientId: string | null = null;
  private isInitialized = false;
  private notificationQueue: NotificationData[] = [];
  private isProcessingQueue = false;

  constructor() {
    console.log('🔔 RealTimeNotificationService inicializado');
    this.requestNotificationPermission();
  }

  /**
   * Inicializa o serviço para um cliente específico
   */
  async initialize(clientId: string): Promise<void> {
    if (this.isInitialized && this.clientId === clientId) {
      console.log('🔔 Serviço já inicializado para o cliente:', clientId);
      return;
    }

    console.log('🔔 Inicializando notificações para cliente:', clientId);
    
    // Limpar canais anteriores
    this.cleanup();
    
    this.clientId = clientId;
    
    // Configurar listeners para diferentes tipos de eventos
    await this.setupTicketNotifications(clientId);
    await this.setupMessageNotifications(clientId);
    await this.setupConnectionNotifications(clientId);
    
    this.isInitialized = true;
    console.log('✅ Notificações configuradas para cliente:', clientId);
  }

  /**
   * Solicita permissão para notificações do navegador
   */
  private async requestNotificationPermission(): Promise<void> {
    if ('Notification' in window && Notification.permission === 'default') {
      try {
        const permission = await Notification.requestPermission();
        console.log('🔔 Permissão de notificação:', permission);
      } catch (error) {
        console.warn('⚠️ Erro ao solicitar permissão de notificação:', error);
      }
    }
  }

  /**
   * Configura notificações para novos tickets
   */
  private async setupTicketNotifications(clientId: string): Promise<void> {
    const ticketChannel = supabase
      .channel(`tickets-${clientId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'conversation_tickets',
        filter: `client_id=eq.${clientId}`
      }, (payload) => {
        console.log('🎯 Novo ticket recebido:', payload.new);
        
        const ticket = payload.new as any;
        this.showNotification({
          type: 'new_ticket',
          title: '🎯 Novo Ticket',
          description: `Conversa com ${ticket.customer?.name || 'Cliente'} iniciada`,
          data: ticket,
          config: { priority: 'high', sound: true }
        });
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public', 
        table: 'conversation_tickets',
        filter: `client_id=eq.${clientId}`
      }, (payload) => {
        const oldTicket = payload.old as any;
        const newTicket = payload.new as any;
        
        // Detectar transferência de fila
        if (oldTicket.assigned_queue_id !== newTicket.assigned_queue_id) {
          console.log('🔄 Ticket transferido entre filas:', {
            from: oldTicket.assigned_queue_id,
            to: newTicket.assigned_queue_id
          });
          
          this.showNotification({
            type: 'queue_transfer',
            title: '🔄 Ticket Transferido',
            description: `Ticket movido para outra fila`,
            data: { oldTicket, newTicket },
            config: { priority: 'medium' }
          });
        }
      })
      .subscribe((status) => {
        console.log('📡 Status do canal de tickets:', status);
      });

    this.channels.set('tickets', ticketChannel);
  }

  /**
   * Configura notificações para novas mensagens
   */
  private async setupMessageNotifications(clientId: string): Promise<void> {
    const messageChannel = supabase
      .channel(`messages-${clientId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'ticket_messages'
      }, (payload) => {
        const message = payload.new as any;
        
        // Só notificar mensagens de clientes (não nossas)
        if (!message.from_me && !message.is_internal_note) {
          console.log('📨 Nova mensagem recebida:', message);
          
          this.showNotification({
            type: 'new_message',
            title: '📨 Nova Mensagem',
            description: message.content?.substring(0, 50) + '...' || 'Mídia recebida',
            data: message,
            config: { priority: 'high', sound: true }
          });
        }
      })
      .subscribe((status) => {
        console.log('📡 Status do canal de mensagens:', status);
      });

    this.channels.set('messages', messageChannel);
  }

  /**
   * Configura notificações para status de conexão
   */
  private async setupConnectionNotifications(clientId: string): Promise<void> {
    const connectionChannel = supabase
      .channel(`connections-${clientId}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'whatsapp_instances',
        filter: `client_id=eq.${clientId}`
      }, (payload) => {
        const oldInstance = payload.old as any;
        const newInstance = payload.new as any;
        
        // Detectar mudanças de status importantes
        if (oldInstance.status !== newInstance.status) {
          console.log('📶 Status de conexão alterado:', {
            instance: newInstance.instance_id,
            from: oldInstance.status,
            to: newInstance.status
          });
          
          if (newInstance.status === 'disconnected' || newInstance.status === 'error') {
            this.showNotification({
              type: 'connection_error',
              title: '⚠️ Conexão Perdida',
              description: `WhatsApp ${newInstance.instance_id} desconectado`,
              data: newInstance,
              config: { priority: 'high', sound: true }
            });
          } else if (newInstance.status === 'connected') {
            this.showNotification({
              type: 'message_delivered',
              title: '✅ Conectado',
              description: `WhatsApp ${newInstance.instance_id} reconectado`,
              data: newInstance,
              config: { priority: 'medium' }
            });
          }
        }
      })
      .subscribe((status) => {
        console.log('📡 Status do canal de conexões:', status);
      });

    this.channels.set('connections', connectionChannel);
  }

  /**
   * Exibe notificação com configurações personalizadas
   */
  private showNotification(notification: NotificationData): void {
    const config = { ...this.config, ...notification.config };
    
    console.log('🔔 Exibindo notificação:', notification);
    
    // Adicionar à fila para processamento
    this.notificationQueue.push(notification);
    
    if (!this.isProcessingQueue) {
      this.processNotificationQueue();
    }
    
    // Som se habilitado
    if (config.sound) {
      this.playNotificationSound(notification.type);
    }
    
    // Vibração se habilitado
    if (config.vibration && 'vibrate' in navigator) {
      const pattern = this.getVibrationPattern(config.priority);
      navigator.vibrate(pattern);
    }
    
    // Notificação desktop se habilitada
    if (config.desktop && 'Notification' in window && Notification.permission === 'granted') {
      this.showDesktopNotification(notification, config);
    }
    
    // Toast no app
    this.showToastNotification(notification, config);
  }

  /**
   * Processa fila de notificações
   */
  private async processNotificationQueue(): Promise<void> {
    if (this.isProcessingQueue || this.notificationQueue.length === 0) {
      return;
    }
    
    this.isProcessingQueue = true;
    
    while (this.notificationQueue.length > 0) {
      const notification = this.notificationQueue.shift();
      if (notification) {
        // Pequeno delay entre notificações para evitar spam
        await new Promise(resolve => setTimeout(resolve, 300));
      }
    }
    
    this.isProcessingQueue = false;
  }

  /**
   * Reproduz som de notificação
   */
  private playNotificationSound(type: NotificationData['type']): void {
    try {
      // Sons diferentes para tipos diferentes
      const soundMap = {
        new_ticket: 'data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LGdCUELIHO8tiJOQgZaLvt559NEAxQp+PwtmMcBjiR1/LGdCUELIHO8tiJOQgZaLvt559NEAxQp+PwtmMcBjiR1/LGdCUELIHO8tiJOQgZaLvt559NEAxQp+PwtmMcBjiR1/LGdCUELIHO8tiJOQgZaLvt559NEAxQp+PwtmMcBjiR1/LGdCUELIHO8tiJOQgZaLvt559NEAxQp+PwtmMcBjiR1/LGdCUELIHO8tiJOQgZaLvt559NEAxQp+PwtmMcBjiR1/LGdCUELIHO8tiJOQgZaLvt559NEAxQp+PwtmMcBjiR1/LGdCUELIHO8tiJOQgZaLvt559NEAxQp+PwtmMcBjiR1/LGdCUELIHO8tiJOQgZaLvt559NEAxQp+PwtmMcBjiR1/LGdCUELIHO8tiJOQgZaLvt559NEAxQp+PwtmMcBjiR1/LGdCUELIHO8tiJOQgZaLvt559NEAxQp+PwtmMcBjiR1/LGdCUELIHO8tiJOQgZaLvt559NEAxQp+PwtmMcBjiR1/LGdCUELIHO8tiJOQgZaLvt559NEAxQp+PwtmMcBjiR1/LGdCUELIHO8tiJOQgZaLvt559NEAxQp+PwtmMcBjiR1/LGdCUELIHO8tiJOQgZaLvt559NEAxQp+PwtmMcBjiR1/LGdCUELIHO8tiJOQgZaLvt559NEAxQp+PwtmMcBjiR1/LGdCUELIHO8tiJOQgZaLvt559NEAxQp+PwtmMcBjiR1/LGdCUELIHO8tiJOQgZaLvt559NEAxQp+PwtmMcBjiR1/LGdCUELIHO8tiJOQgZaLvt559NEAxQp+PwtmMcBjiR1/LGdCUELIHO8tiJOQgZaLvt559NEAxQp+PwtmMcBjiR1/LGdCUELIHO8tiJOQgZaLvt559NEAxQp+PwtmMcBjiR1/LGdCUELIHO8tiJOQgZaLvt559NEAxQp+PwtmMcBjiR1/LGdCUELIHO8tiJOQgZaLvt559NEAxQp+PwtmMcBjiR1/LGdCUELIHO8tiJOQgZaLvt559NEAxQp+PwtmMcBjiR1/LGdCUELIHO8tiJOQgZaLvt559NEAxQp+PwtmMcBjiR1/LGdCUELIHO8tiJOQgZaLvt559NEAxQp+PwtmMcBjiR1/LGdCUELIHO8tiJOQgZaLvt559NEAxQp+PwtmMcBjiR1/LGdCUELIHO8tiJOQgZaLvt559NEAxQp+PwtmMcBjiR1/LGdCUELIHO8tiJOQgZaLvt559NEAxQp+PwtmMcBjiR1/LGdCUELIHO8tiJOQgZaLvt559NEAxQp+PwtmMcBjiR1/LGdCUELIHO8tiJOQgZaLvt559NEAxQp+PwtmMcBjiR1/LGdCUELIHO8tiJOQgZaLvt559NEAxQp+PwtmMcBjiR1/LGdCUELIHO8tiJOQgZaLvt559NEAxQp+PwtmMcBjiR1/LGdCUE=',
        new_message: 'data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LGdCUELIHO8tiJOQgZaLvt559NEAxQp+PwtmMcBjiR1/LGdCUELIHO8tiJOQgZaLvt559NEAxQp+PwtmMcBjiR1/LGdCUELIHO8tiJOQgZaLvt559NEAxQp+PwtmMcBjiR1/LGdCUELIHO8tiJOQgZaLvt559NEAxQp+PwtmMcBjiR1/LGdCUELIHO8tiJOQgZaLvt559NEAxQp+PwtmMcBjiR1/LGdCUELIHO8tiJOQgZaLvt559NEAxQp+PwtmMcBjiR1/LGdCUELIHO8tiJOQgZaLvt559NEAxQp+PwtmMcBjiR1/LGdCUELIHO8tiJOQgZaLvt559NEAxQp+PwtmMcBjiR1/LGdCUELIHO8tiJOQgZaLvt559NEAxQp+PwtmMcBjiR1/LGdCUELIHO8tiJOQgZaLvt559NEAxQp+PwtmMcBjiR1/LGdCUELIHO8tiJOQgZaLvt559NEAxQp+PwtmMcBjiR1/LGdCUELIHO8tiJOQgZaLvt559NEAxQp+PwtmMcBjiR1/LGdCUELIHO8tiJOQgZaLvt559NEAxQp+PwtmMcBjiR1/LGdCUELIHO8tiJOQgZaLvt559NEAxQp+PwtmMcBjiR1/LGdCUELIHO8tiJOQgZaLvt559NEAxQp+PwtmMcBjiR1/LGdCUELIHO8tiJOQgZaLvt559NEAxQp+PwtmMcBjiR1/LGdCUELIHO8tiJOQgZaLvt559NEAxQp+PwtmMcBjiR1/LGdCUELIHO8tiJOQgZaLvt559NEAxQp+PwtmMcBjiR1/LGdCUELIHO8tiJOQgZaLvt559NEAxQp+PwtmMcBjiR1/LGdCUELIHO8tiJOQgZaLvt559NEAxQp+PwtmMcBjiR1/LGdCUELIHO8tiJOQgZaLvt559NEAxQp+PwtmMcBjiR1/LGdCUELIHO8tiJOQgZaLvt559NEAxQp+PwtmMcBjiR1/LGdCUELIHO8tiJOQgZaLvt559NEAxQp+PwtmMcBjiR1/LGdCUELIHO8tiJOQgZaLvt559NEAxQp+PwtmMcBjiR1/LGdCUELIHO8tiJOQgZaLvt559NEAxQp+PwtmMcBjiR1/LGdCUELIHO8tiJOQgZaLvt559NEAxQp+PwtmMcBjiR1/LGdCUELIHO8tiJOQgZaLvt559NEAxQp+PwtmMcBjiR1/LGdCUE=',
        queue_transfer: 'data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LGdCUELIHO8tiJOQgZaLvt559NEAxQp+PwtmMcBjiR1/LGdCUELIHO8tiJOQgZaLvt559NEAxQp+PwtmMcBjiR1/LGdCUELIHO8tiJOQgZaLvt559NEAxQp+PwtmMcBjiR1/LGdCUELIHO8tiJOQgZaLvt559NEAxQp+PwtmMcBjiR1/LGdCUELIHO8tiJOQgZaLvt559NEAxQp+PwtmMcBjiR1/LGdCUELIHO8tiJOQgZaLvt559NEAxQp+PwtmMcBjiR1/LGdCUELIHO8tiJOQgZaLvt559NEAxQp+PwtmMcBjiR1/LGdCUELIHO8tiJOQgZaLvt559NEAxQp+PwtmMcBjiR1/LGdCUELIHO8tiJOQgZaLvt559NEAxQp+PwtmMcBjiR1/LGdCUELIHO8tiJOQgZaLvt559NEAxQp+PwtmMcBjiR1/LGdCUELIHO8tiJOQgZaLvt559NEAxQp+PwtmMcBjiR1/LGdCUELIHO8tiJOQgZaLvt559NEAxQp+PwtmMcBjiR1/LGdCUELIHO8tiJOQgZaLvt559NEAxQp+PwtmMcBjiR1/LGdCUELIHO8tiJOQgZaLvt559NEAxQp+PwtmMcBjiR1/LGdCUELIHO8tiJOQgZaLvt559NEAxQp+PwtmMcBjiR1/LGdCUELIHO8tiJOQgZaLvt559NEAxQp+PwtmMcBjiR1/LGdCUELIHO8tiJOQgZaLvt559NEAxQp+PwtmMcBjiR1/LGdCUELIHO8tiJOQgZaLvt559NEAxQp+PwtmMcBjiR1/LGdCUELIHO8tiJOQgZaLvt559NEAxQp+PwtmMcBjiR1/LGdCUELIHO8tiJOQgZaLvt559NEAxQp+PwtmMcBjiR1/LGdCUELIHO8tiJOQgZaLvt559NEAxQp+PwtmMcBjiR1/LGdCUELIHO8tiJOQgZaLvt559NEAxQp+PwtmMcBjiR1/LGdCUELIHO8tiJOQgZaLvt559NEAxQp+PwtmMcBjiR1/LGdCUELIHO8tiJOQgZaLvt559NEAxQp+PwtmMcBjiR1/LGdCUELIHO8tiJOQgZaLvt559NEAxQp+PwtmMcBjiR1/LGdCUE='
      };
      
      const audio = new Audio(soundMap.new_message); // Usar som padrão por enquanto
      audio.volume = 0.3;
      audio.play().catch(e => console.warn('⚠️ Não foi possível reproduzir som:', e));
    } catch (error) {
      console.warn('⚠️ Erro ao reproduzir som:', error);
    }
  }

  /**
   * Obtém padrão de vibração baseado na prioridade
   */
  private getVibrationPattern(priority: NotificationConfig['priority']): number[] {
    switch (priority) {
      case 'high': return [200, 100, 200, 100, 200];
      case 'medium': return [200, 100, 200];
      case 'low': return [100];
      default: return [200];
    }
  }

  /**
   * Exibe notificação desktop
   */
  private showDesktopNotification(notification: NotificationData, config: NotificationConfig): void {
    if ('Notification' in window && Notification.permission === 'granted') {
      const desktopNotification = new Notification(notification.title, {
        body: notification.description,
        icon: '/favicon.ico',
        tag: notification.type,
        requireInteraction: !config.autoClose
      });

      if (config.autoClose) {
        setTimeout(() => {
          desktopNotification.close();
        }, config.duration);
      }

      desktopNotification.onclick = () => {
        window.focus();
        desktopNotification.close();
      };
    }
  }

  /**
   * Exibe toast no app
   */
  private showToastNotification(notification: NotificationData, config: NotificationConfig): void {
    const variant = notification.type === 'connection_error' ? 'destructive' : 'default';
    
    toast({
      title: notification.title,
      description: notification.description,
      variant,
      duration: config.autoClose ? config.duration : undefined
    });
  }

  /**
   * Atualiza configurações
   */
  updateConfig(newConfig: Partial<NotificationConfig>): void {
    this.config = { ...this.config, ...newConfig };
    console.log('⚙️ Configuração de notificações atualizada:', this.config);
  }

  /**
   * Obtém configurações atuais
   */
  getConfig(): NotificationConfig {
    return { ...this.config };
  }

  /**
   * Testa notificação
   */
  testNotification(): void {
    this.showNotification({
      type: 'message_delivered',
      title: '🧪 Teste de Notificação',
      description: 'Este é um teste do sistema de notificações',
      config: { priority: 'medium' }
    });
  }

  /**
   * Limpa todos os canais e recursos
   */
  cleanup(): void {
    console.log('🧹 Limpando RealTimeNotificationService');
    
    this.channels.forEach((channel, name) => {
      console.log(`🗑️ Removendo canal: ${name}`);
      supabase.removeChannel(channel);
    });
    
    this.channels.clear();
    this.isInitialized = false;
    this.clientId = null;
    this.notificationQueue = [];
    this.isProcessingQueue = false;
  }
}

export const realTimeNotificationService = new RealTimeNotificationService();
export type { NotificationConfig, NotificationData };