
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { MoreVertical, Tag, User, ArrowRight, X, Trash2 } from 'lucide-react';
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
  const [showDeleteDialog, setShowDeleteDialog] = React.useState(false);

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
        // TODO: Implementar tags quando campo estiver na tabela
        const currentTags: string[] = [];
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
      // TODO: Implementar tags quando campo estiver na tabela  
      const currentTags: string[] = [];
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

  const handleDeleteTicket = async () => {
    try {
      await ticketsService.deleteTicketCompletely(ticket.id);
      toast({
        title: "Sucesso",
        description: "Ticket excluído completamente"
      });
      setShowDeleteDialog(false);
      onTicketUpdate();
    } catch (error) {
      toast({
        title: "Erro",
        description: "Erro ao excluir ticket",
        variant: "destructive"
      });
    }
  };

  return (
    <>
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

          {/* TODO: Mostrar tags quando campo estiver na tabela */}
          {false && (
            <>
              <DropdownMenuSeparator />
              <div className="px-2 py-1">
                <div className="flex flex-wrap gap-1">
                  {[].map((tag, index) => (
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

          <DropdownMenuSeparator />
          <DropdownMenuItem 
            onClick={() => setShowDeleteDialog(true)}
            className="text-destructive focus:text-destructive"
          >
            <Trash2 className="w-4 h-4 mr-2" />
            Excluir Ticket
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Ticket</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir este ticket permanentemente? 
              <br />
              <strong>"{ticket.title}"</strong>
              <br />
              Esta ação não pode ser desfeita e irá remover todas as mensagens e dados relacionados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDeleteTicket}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir Permanentemente
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default TicketActionsMenu;
