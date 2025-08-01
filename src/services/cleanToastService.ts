/**
 * SISTEMA DE TOASTS LIMPO E ESTRATÉGICO
 * 
 * Apenas toasts CRÍTICOS e importantes para o usuário
 * - Errors críticos
 * - Sucessos importantes (envio de mensagem, conexão)
 * - Sem toasts informativos desnecessários
 */

import { toast } from '@/hooks/use-toast';

export type ToastType = 'success' | 'error' | 'warning';

class CleanToastService {
  
  /**
   * TOAST DE SUCESSO - Para ações importantes do usuário
   */
  success(title: string, description?: string) {
    toast({
      title,
      description,
      duration: 3000,
    });
  }

  /**
   * TOAST DE ERRO - Para erros críticos que o usuário precisa saber
   */
  error(title: string, description?: string) {
    toast({
      title,
      description,
      variant: "destructive",
      duration: 5000, // Erro fica mais tempo visível
    });
  }

  /**
   * TOAST DE AVISO - Para situações que o usuário deve estar ciente
   */
  warning(title: string, description?: string) {
    toast({
      title,
      description,
      duration: 4000,
    });
  }

  /**
   * MÉTODOS ESPECÍFICOS PARA O CRM
   */
  
  // Mensagem enviada com sucesso
  messageSent(recipientName?: string) {
    this.success(
      "Mensagem enviada",
      recipientName ? `Enviada para ${recipientName}` : "Mensagem enviada com sucesso"
    );
  }

  // Erro no envio de mensagem
  messageError(error?: string) {
    this.error(
      "Erro ao enviar mensagem",
      error || "Tente novamente em alguns instantes"
    );
  }

  // WhatsApp conectado
  whatsappConnected() {
    this.success(
      "WhatsApp conectado",
      "Pronto para receber e enviar mensagens"
    );
  }

  // WhatsApp desconectado
  whatsappDisconnected() {
    this.error(
      "WhatsApp desconectado",
      "Verifique a conexão e faça login novamente"
    );
  }

  // Áudio enviado
  audioSent() {
    this.success(
      "Áudio enviado",
      "Mensagem de áudio enviada com sucesso"
    );
  }

  // Erro no processamento de áudio
  audioError() {
    this.error(
      "Erro no áudio",
      "Não foi possível processar o áudio"
    );
  }

  // Arquivo enviado
  fileSent(fileName?: string) {
    this.success(
      "Arquivo enviado",
      fileName ? `${fileName} enviado com sucesso` : "Arquivo enviado com sucesso"
    );
  }

  // Erro no envio de arquivo
  fileError() {
    this.error(
      "Erro no arquivo",
      "Não foi possível enviar o arquivo"
    );
  }
}

export const cleanToast = new CleanToastService();