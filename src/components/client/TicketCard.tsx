
import { useState } from "react";
import { Card } from "@/components/ui/card";
import { MessageSquare } from "lucide-react";

interface TicketCardProps {
  ticket: any;
  isSelected: boolean;
  onClick: () => void;
  onAction: (action: string, ticketId: string) => void;
}

const TicketCard = ({
  ticket,
  isSelected,
  onClick,
  onAction
}: TicketCardProps) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const handleAction = (action: string) => {
    onAction(action, ticket.id);
    setIsMenuOpen(false);
  };

  const getDisplayName = (ticket: any) => {
    if (ticket.customer?.name && 
        ticket.customer.name !== `Contato ${ticket.customer.phone}` &&
        !ticket.customer.name.startsWith('Contato ')) {
      return ticket.customer.name;
    }
    
    if (ticket.title && ticket.title.includes('Conversa com ')) {
      const nameFromTitle = ticket.title.replace('Conversa com ', '').trim();
      if (nameFromTitle && 
          !nameFromTitle.startsWith('Contato ') && 
          nameFromTitle !== ticket.customer?.phone) {
        return nameFromTitle;
      }
    }
    
    const phone = ticket.customer?.phone || ticket.chat_id;
    if (phone) {
      const cleanPhone = phone.replace(/\D/g, '');
      if (cleanPhone.length >= 10) {
        const formattedPhone = cleanPhone.replace(/(\d{2})(\d{4,5})(\d{4})/, '($1) $2-$3');
        return formattedPhone;
      }
    }
    
    return 'Contato sem nome';
  };

  return (
    <Card
      className={`p-3 rounded-lg cursor-pointer transition-colors ${
        isSelected ? 'bg-blue-50 text-blue-900' : 'bg-white hover:bg-gray-50'
      }`}
      onClick={onClick}
    >
      <div className="flex items-center space-x-3">
        <div className="relative">
          <div className="h-10 w-10 rounded-full bg-gray-200 flex items-center justify-center overflow-hidden">
            {ticket.customer?.name ? (
              <span className="text-sm font-semibold">{ticket.customer.name.charAt(0).toUpperCase()}</span>
            ) : (
              <MessageSquare className="w-5 h-5 text-gray-400" />
            )}
          </div>
          {ticket.status === 'open' && (
            <span className="absolute top-0 right-0 w-3 h-3 bg-green-500 rounded-full border border-white"></span>
          )}
        </div>
        <div className="flex-1">
          <div className="flex items-center justify-between">
            <div className="text-sm font-medium">{getDisplayName(ticket)}</div>
            <div className="text-xs text-gray-500">
              {new Date(ticket.last_message_at).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit'
              })}
            </div>
          </div>
          <p className="text-xs text-gray-600 truncate">{ticket.last_message_preview}</p>
        </div>
      </div>
    </Card>
  );
};

export default TicketCard;
