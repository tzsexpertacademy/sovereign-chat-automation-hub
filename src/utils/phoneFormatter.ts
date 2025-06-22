
/**
 * Utilitário para formatação e normalização de números de telefone
 */

// Formatar número para padrão WhatsApp (chat_id)
export const formatToChatId = (phoneNumber: string): string => {
  // Remove todos os caracteres não numéricos
  const cleaned = phoneNumber.replace(/\D/g, '');
  
  // Se não tem código do país, adiciona 55 (Brasil)
  let formatted = cleaned;
  if (!cleaned.startsWith('55') && cleaned.length <= 11) {
    formatted = '55' + cleaned;
  }
  
  // Se tem 13 dígitos e o 9º é 9 (celular), mantém
  // Se tem 12 dígitos e não tem o 9, adiciona
  if (formatted.length === 12 && !formatted.substring(4, 5).includes('9')) {
    // Adiciona o 9 para celulares (55 + DDD + 9 + número)
    const ddd = formatted.substring(2, 4);
    const number = formatted.substring(4);
    formatted = '55' + ddd + '9' + number;
  }
  
  return formatted + '@c.us';
};

// Formatar número para display (+55 47 99999-9999)
export const formatToDisplay = (phoneNumber: string): string => {
  const cleaned = phoneNumber.replace(/\D/g, '');
  
  if (cleaned.length >= 11) {
    const country = cleaned.substring(0, 2);
    const area = cleaned.substring(2, 4);
    const first = cleaned.substring(4, 9);
    const second = cleaned.substring(9);
    
    return `+${country} ${area} ${first}-${second}`;
  }
  
  return phoneNumber;
};

// Extrair número limpo do chat_id
export const extractPhoneFromChatId = (chatId: string): string => {
  return chatId.replace('@c.us', '').replace('@g.us', '');
};

// Normalizar número para comparação
export const normalizePhone = (phoneNumber: string): string => {
  return phoneNumber.replace(/\D/g, '');
};

// Validar se é um número de celular brasileiro válido
export const isValidBrazilianMobile = (phoneNumber: string): boolean => {
  const cleaned = phoneNumber.replace(/\D/g, '');
  
  // Deve ter 13 dígitos (55 + DDD + 9 + 8 dígitos)
  if (cleaned.length !== 13) return false;
  
  // Deve começar com 55 (Brasil)
  if (!cleaned.startsWith('55')) return false;
  
  // DDD deve ser válido (11-99)
  const ddd = parseInt(cleaned.substring(2, 4));
  if (ddd < 11 || ddd > 99) return false;
  
  // Deve ter o 9 na posição correta para celular
  if (cleaned.charAt(4) !== '9') return false;
  
  return true;
};

// Detectar e corrigir formato de número
export const smartFormatPhone = (input: string): {
  chatId: string;
  displayNumber: string;
  cleanNumber: string;
  isValid: boolean;
} => {
  const cleaned = normalizePhone(input);
  const chatId = formatToChatId(input);
  const displayNumber = formatToDisplay(cleaned);
  const isValid = isValidBrazilianMobile(chatId.replace('@c.us', ''));
  
  return {
    chatId,
    displayNumber,
    cleanNumber: cleaned,
    isValid
  };
};
