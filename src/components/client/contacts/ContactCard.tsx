
/**
 * Cartão de contato integrado com tickets e conversas
 */

import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { 
  MessageSquare, 
  Phone, 
  Calendar, 
  User, 
  Clock,
  ArrowRight,
  Dot
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface ContactCardProps {
  contact: {
    id: string;
    name: string;
    phone: string;
    avatar_url?: string;
    last_seen?: string;
    created_at: string;
    updated_at: string;
  };
  ticketInfo?: {
    id: string;
    messagesCount: number;
    lastMessage?: string;
    lastMessageAt?: string;
    status: string;
  };
  onOpenChat?: (contactId: string) => void;
  onViewProfile?: (contactId: string) => void;
}

const ContactCard = ({ contact, ticketInfo, onOpenChat, onViewProfile }: ContactCardProps) => {
  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .substring(0, 2);
  };

  const formatLastSeen = (lastSeen?: string) => {
    if (!lastSeen) return null;
    
    try {
      return formatDistanceToNow(new Date(lastSeen), {
        addSuffix: true,
        locale: ptBR
      });
    } catch {
      return null;
    }
  };

  const getStatusColor = (status?: string) => {
    switch (status) {
      case 'open': return 'bg-green-500';
      case 'closed': return 'bg-gray-500';
      case 'pending': return 'bg-yellow-500';
      default: return 'bg-blue-500';
    }
  };

  const getStatusText = (status?: string) => {
    switch (status) {
      case 'open': return 'Ativa';
      case 'closed': return 'Fechada';
      case 'pending': return 'Pendente';
      default: return 'Nova';
    }
  };

  const hasConversation = ticketInfo && ticketInfo.messagesCount > 0;

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center space-x-3">
            <Avatar className="w-12 h-12">
              {contact.avatar_url && (
                <AvatarImage src={contact.avatar_url} alt={contact.name} />
              )}
              <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                {getInitials(contact.name)}
              </AvatarFallback>
            </Avatar>
            
            <div className="flex-1">
              <h3 className="font-semibold text-gray-900 text-sm leading-tight">
                {contact.name}
              </h3>
              <div className="flex items-center text-xs text-gray-500 mt-1">
                <Phone className="w-3 h-3 mr-1" />
                {contact.phone}
              </div>
            </div>
          </div>

          {hasConversation && (
            <div className="flex items-center space-x-1">
              <Dot className={`w-3 h-3 ${getStatusColor(ticketInfo?.status)}`} />
              <Badge variant="outline" className="text-xs px-2 py-0">
                {getStatusText(ticketInfo?.status)}
              </Badge>
            </div>
          )}
        </div>

        {/* Informações da conversa */}
        {hasConversation && ticketInfo && (
          <div className="bg-gray-50 rounded-lg p-3 mb-3">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center text-xs text-gray-600">
                <MessageSquare className="w-3 h-3 mr-1" />
                {ticketInfo.messagesCount} mensagem{ticketInfo.messagesCount !== 1 ? 's' : ''}
              </div>
              {ticketInfo.lastMessageAt && (
                <div className="flex items-center text-xs text-gray-500">
                  <Clock className="w-3 h-3 mr-1" />
                  {formatLastSeen(ticketInfo.lastMessageAt)}
                </div>
              )}
            </div>
            
            {ticketInfo.lastMessage && (
              <p className="text-xs text-gray-700 line-clamp-2 leading-relaxed">
                {ticketInfo.lastMessage}
              </p>
            )}
          </div>
        )}

        {/* Informações do contato */}
        <div className="space-y-2 mb-3">
          {contact.last_seen && (
            <div className="flex items-center text-xs text-gray-500">
              <User className="w-3 h-3 mr-1" />
              Visto {formatLastSeen(contact.last_seen)}
            </div>
          )}
          
          <div className="flex items-center text-xs text-gray-500">
            <Calendar className="w-3 h-3 mr-1" />
            Contato desde {formatLastSeen(contact.created_at)}
          </div>
        </div>

        {/* Ações */}
        <div className="flex space-x-2">
          {hasConversation ? (
            <Button
              size="sm"
              onClick={() => onOpenChat?.(contact.id)}
              className="flex-1 text-xs"
            >
              <MessageSquare className="w-3 h-3 mr-1" />
              Abrir Chat
              <ArrowRight className="w-3 h-3 ml-1" />
            </Button>
          ) : (
            <Button
              size="sm"
              variant="outline"
              onClick={() => onOpenChat?.(contact.id)}
              className="flex-1 text-xs"
            >
              <MessageSquare className="w-3 h-3 mr-1" />
              Iniciar Conversa
            </Button>
          )}
          
          <Button
            size="sm"
            variant="outline"
            onClick={() => onViewProfile?.(contact.id)}
            className="px-3"
          >
            <User className="w-3 h-3" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default ContactCard;
