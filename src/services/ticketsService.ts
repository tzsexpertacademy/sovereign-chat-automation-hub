// Stub para compatibilidade - agora use yumerApiService
import { yumerApiService } from './yumerApiService';

console.warn('⚠️ ticketsService foi removido. Use yumerApiService em vez disso.');

export interface Ticket {
  id: string;
  contact: string;
  status: string;
  lastMessage: string;
  unreadCount: number;
  updatedAt: Date;
  messages: Message[];
}

export interface Message {
  id: string;
  content: string;
  timestamp: Date;
  isFromUser: boolean;
  type: 'text' | 'image' | 'audio' | 'video' | 'document';
  mediaUrl?: string;
}

export interface ConversationTicket extends Ticket {}
export interface TicketMessage extends Message {}

export const ticketsService = {
  getTickets: () => Promise.resolve([]),
  getTicketById: (id: string) => Promise.resolve(null),
  createTicket: () => Promise.resolve({ id: 'new-ticket' }),
  updateTicket: () => Promise.resolve({ success: true }),
  sendMessage: (instanceName: string, remoteJid: string, message: string) => 
    Promise.resolve({ success: true, messageId: 'msg-123' }),
  getMessages: () => Promise.resolve([]),
  markAsRead: () => Promise.resolve({ success: true }),
  // Additional functions needed by components
  assumeTicketManually: () => Promise.resolve({ success: true }),
  removeTicketFromQueue: () => Promise.resolve({ success: true }),
  transferTicket: () => Promise.resolve({ success: true }),
  updateTicketTags: () => Promise.resolve({ success: true }),
  addTicketMessage: () => Promise.resolve({ success: true }),
  getTicketMessages: () => Promise.resolve([]),
  validateAndFixTimestamp: () => Promise.resolve({ success: true }),
  getClientTickets: () => Promise.resolve([]),
  createOrUpdateTicket: () => Promise.resolve({ success: true }),
};

export default ticketsService;