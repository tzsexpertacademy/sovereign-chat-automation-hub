
import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { MoreVertical, Tag, User, ArrowRight, X } from 'lucide-react';
import { ticketsService, type ConversationTicket } from '@/services/ticketsService';
import { queuesService } from '@/services/queuesService';
import { useToast } from '@/hooks/use-toast';

interface TicketActionsMenuProps {
  ticket: ConversationTicket;
  onTicketUpdate: () => void;
}

const TicketActionsMenu = ({ ticket, onTicketUpdate }: TicketActionsMenuProps) => {
  const { toast } = useToast();
  const [queues, setQueues] = React.useState<any[]>([]);

  React.useEffect(() => {
    loadQueues();
  }, [ticket.client_id]);

  const loadQueues = async () => {
    try {
      const clientQueues = await queuesService.getClientQueues(ticket.client_id);
      setQueues(clientQueues);
    } catch (error) {
      console.error('Erro ao carregar filas:', error);
    }
  };

  const handleAssumeManually = async () => {
    try {
      await ticketsService.assumeTicketManually(ticket.id);
      toast({
        title: "Sucesso",
        description: "Ticket assumido manualmente"
      });
      onTicketUpdate();
    } catch (error) {
      toast({
        title: "Erro",
        description: "Erro ao assumir ticket",
        variant: "destructive"
      });
    }
  };

  const handleRemoveFromQueue = async () => {
    try {
      await ticketsService.removeTicketFromQueue(ticket.id);
      toast({
        title: "Sucesso", 
        description: "Ticket removido da fila"
      });
      onTicketUpdate();
    } catch (error) {
      toast({
        title: "Erro",
        description: "Erro ao remover da fila",
        variant: "destructive"
      });
    }
  };

  const handleTransferToQueue = async (queueId: string) => {
    try {
      await ticketsService.transferTicket(ticket.id, queueId);
      toast({
        title: "Sucesso",
        description: "Ticket transferido para fila"
      });
      onTicketUpdate();
    } catch (error) {
      toast({
        title: "Erro", 
        description: "Erro ao transferir ticket",
        variant: "destructive"
      });
    }
  };

  const handleAddTag = async () => {
    const tag = prompt('Digite a tag:');
    if (tag) {
      try {
        // Safe handling of tags JSON field
        const currentTags = Array.isArray(ticket.tags) ? ticket.tags : [];
        const newTags = [...currentTags, tag];
        await ticketsService.updateTicketTags(ticket.id, newTags);
        toast({
          title: "Sucesso",
          description: "Tag adicionada"
        });
        onTicketUpdate();
      } catch (error) {
        toast({
          title: "Erro",
          description: "Erro ao adicionar tag", 
          variant: "destructive"
        });
      }
    }
  };

  const handleRemoveTag = async (tagToRemove: string) => {
    try {
      // Safe handling of tags JSON field
      const currentTags = Array.isArray(ticket.tags) ? ticket.tags : [];
      const newTags = currentTags.filter(tag => tag !== tagToRemove);
      await ticketsService.updateTicketTags(ticket.id, newTags);
      toast({
        title: "Sucesso",
        description: "Tag removida"
      });
      onTicketUpdate();
    } catch (error) {
      toast({
        title: "Erro",
        description: "Erro ao remover tag",
        variant: "destructive"
      });
    }
  };

  // Safe handling of tags for rendering
  const ticketTags = Array.isArray(ticket.tags) ? ticket.tags : [];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm">
          <MoreVertical className="w-4 h-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>Ações do Ticket</DropdownMenuLabel>
        <DropdownMenuSeparator />
        
        <DropdownMenuItem onClick={handleAssumeManually}>
          <User className="w-4 h-4 mr-2" />
          Assumir Manualmente
        </DropdownMenuItem>

        {ticket.assigned_queue_id && (
          <DropdownMenuItem onClick={handleRemoveFromQueue}>
            <X className="w-4 h-4 mr-2" />
            Remover da Fila
          </DropdownMenuItem>
        )}

        <DropdownMenuSeparator />
        <DropdownMenuLabel>Transferir para Fila</DropdownMenuLabel>
        {queues.filter(q => q.is_active && q.id !== ticket.assigned_queue_id).map((queue) => (
          <DropdownMenuItem 
            key={queue.id} 
            onClick={() => handleTransferToQueue(queue.id)}
          >
            <ArrowRight className="w-4 h-4 mr-2" />
            {queue.name}
          </DropdownMenuItem>
        ))}

        <DropdownMenuSeparator />
        <DropdownMenuLabel>Tags</DropdownMenuLabel>
        
        <DropdownMenuItem onClick={handleAddTag}>
          <Tag className="w-4 h-4 mr-2" />
          Adicionar Tag
        </DropdownMenuItem>

        {ticketTags.length > 0 && (
          <>
            <DropdownMenuSeparator />
            <div className="px-2 py-1">
              <div className="flex flex-wrap gap-1">
                {ticketTags.map((tag, index) => (
                  <Badge 
                    key={index} 
                    variant="secondary" 
                    className="text-xs cursor-pointer hover:bg-red-100"
                    onClick={() => handleRemoveTag(tag)}
                  >
                    {tag} <X className="w-3 h-3 ml-1" />
                  </Badge>
                ))}
              </div>
            </div>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default TicketActionsMenu;
