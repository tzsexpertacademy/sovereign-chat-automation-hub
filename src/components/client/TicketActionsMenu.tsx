
import { useState } from 'react';
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreVertical, User, ArrowRight, Trash2, Tag, Archive } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { ticketsService, type ConversationTicket } from "@/services/ticketsService";
import TicketDeleteDialog from './TicketDeleteDialog';

interface TicketActionsMenuProps {
  ticket: ConversationTicket;
  onTicketUpdate: () => void;
}

const TicketActionsMenu = ({ ticket, onTicketUpdate }: TicketActionsMenuProps) => {
  const [isLoading, setIsLoading] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const { toast } = useToast();

  const handleAssumeTicket = async () => {
    try {
      setIsLoading(true);
      
      await ticketsService.assumeTicketManually(ticket.id, 'Operador');
      
      toast({
        title: "Ticket assumido",
        description: "Você assumiu este ticket para atendimento manual"
      });
      
      onTicketUpdate();
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message || "Falha ao assumir ticket",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleTransferToAI = async () => {
    try {
      setIsLoading(true);
      
      // Transferir de volta para a primeira fila ativa (simula retorno ao assistente)
      await ticketsService.updateTicketStatus(ticket.id, 'open');
      
      toast({
        title: "Ticket transferido",
        description: "Ticket retornado para atendimento automático"
      });
      
      onTicketUpdate();
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message || "Falha ao transferir ticket",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCloseTicket = async () => {
    try {
      setIsLoading(true);
      
      await ticketsService.updateTicketStatus(ticket.id, 'closed');
      
      toast({
        title: "Ticket fechado",
        description: "O ticket foi marcado como resolvido"
      });
      
      onTicketUpdate();
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message || "Falha ao fechar ticket",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const getDisplayName = () => {
    if (ticket.customer?.name && 
        ticket.customer.name !== `Contato ${ticket.customer.phone}` &&
        !ticket.customer.name.startsWith('Contato ')) {
      return ticket.customer.name;
    }
    
    const phone = ticket.customer?.phone || ticket.chat_id;
    if (phone) {
      const cleanPhone = phone.replace(/\D/g, '');
      if (cleanPhone.length >= 10) {
        return cleanPhone.replace(/(\d{2})(\d{4,5})(\d{4})/, '($1) $2-$3');
      }
    }
    
    return 'Contato sem nome';
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" disabled={isLoading}>
            <MoreVertical className="w-4 h-4" />
          </Button>
        </DropdownMenuTrigger>
        
        <DropdownMenuContent align="end" className="w-56">
          {ticket.status === 'open' && (
            <DropdownMenuItem onClick={handleAssumeTicket}>
              <User className="w-4 h-4 mr-2" />
              Assumir Atendimento
            </DropdownMenuItem>
          )}
          
          {ticket.status === 'pending' && (
            <DropdownMenuItem onClick={handleTransferToAI}>
              <ArrowRight className="w-4 h-4 mr-2" />
              Retornar ao Assistente
            </DropdownMenuItem>
          )}
          
          <DropdownMenuItem onClick={handleCloseTicket}>
            <Archive className="w-4 h-4 mr-2" />
            Fechar Ticket
          </DropdownMenuItem>
          
          <DropdownMenuSeparator />
          
          <DropdownMenuItem 
            onClick={() => setShowDeleteDialog(true)}
            className="text-red-600 focus:text-red-600"
          >
            <Trash2 className="w-4 h-4 mr-2" />
            Excluir Ticket
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <TicketDeleteDialog
        ticketId={ticket.id}
        customerName={getDisplayName()}
        isOpen={showDeleteDialog}
        onClose={() => setShowDeleteDialog(false)}
        onTicketDeleted={onTicketUpdate}
      />
    </>
  );
};

export default TicketActionsMenu;
