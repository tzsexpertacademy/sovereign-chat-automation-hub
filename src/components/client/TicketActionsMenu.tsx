
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
import { MoreVertical, Tag, User, ArrowRight, X, Trash2, XCircle, RotateCcw, Filter } from 'lucide-react';
import { ticketsService, type ConversationTicket } from '@/services/ticketsService';
import { queuesService } from '@/services/queuesService';
import { funnelService } from '@/services/funnelService';
import { useToast } from '@/hooks/use-toast';

interface TicketActionsMenuProps {
  ticket: ConversationTicket;
  onTicketUpdate: () => void;
}

const TicketActionsMenu = ({ ticket, onTicketUpdate }: TicketActionsMenuProps) => {
  const { toast } = useToast();
  const [queues, setQueues] = React.useState<any[]>([]);
  const [funnelStages, setFunnelStages] = React.useState<any[]>([]);
  const [showDeleteDialog, setShowDeleteDialog] = React.useState(false);
  const [showCloseDialog, setShowCloseDialog] = React.useState(false);
  const [showReopenDialog, setShowReopenDialog] = React.useState(false);

  React.useEffect(() => {
    loadQueues();
    loadFunnelStages();
  }, [ticket.client_id]);

  const loadQueues = async () => {
    try {
      const clientQueues = await queuesService.getClientQueues(ticket.client_id);
      setQueues(clientQueues);
    } catch (error) {
      console.error('Erro ao carregar filas:', error);
    }
  };

  const loadFunnelStages = async () => {
    try {
      const stages = await funnelService.getStages(ticket.client_id);
      setFunnelStages(stages);
    } catch (error) {
      console.error('Erro ao carregar estágios do funil:', error);
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
    if (tag && tag.trim()) {
      try {
        const currentTags = Array.isArray(ticket.tags) ? ticket.tags : [];
        const newTags = [...currentTags, tag.trim()];
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

  const handleUpdateFunnelStage = async (stageId: string) => {
    try {
      await ticketsService.updateTicketFunnelStage(ticket.id, stageId);
      toast({
        title: "Sucesso",
        description: "Estágio do funil atualizado"
      });
      onTicketUpdate();
    } catch (error) {
      toast({
        title: "Erro",
        description: "Erro ao atualizar estágio do funil",
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

  const handleCloseTicket = async () => {
    try {
      await ticketsService.closeTicket(ticket.id, "Fechado manualmente pelo operador");
      toast({
        title: "Sucesso",
        description: "Ticket fechado com sucesso"
      });
      setShowCloseDialog(false);
      onTicketUpdate();
    } catch (error) {
      toast({
        title: "Erro",
        description: "Erro ao fechar ticket",
        variant: "destructive"
      });
    }
  };

  const handleReopenTicket = async () => {
    try {
      await ticketsService.reopenTicket(ticket.id);
      toast({
        title: "Sucesso",
        description: "Ticket reaberto com sucesso"
      });
      setShowReopenDialog(false);
      onTicketUpdate();
    } catch (error) {
      toast({
        title: "Erro",
        description: "Erro ao reabrir ticket",
        variant: "destructive"
      });
    }
  };

  const isTicketOpen = ['open', 'pending'].includes(ticket.status);
  const isTicketClosed = ['closed', 'resolved'].includes(ticket.status);

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
          
          {isTicketOpen && (
            <DropdownMenuItem onClick={handleAssumeManually}>
              <User className="w-4 h-4 mr-2" />
              Assumir Manualmente
            </DropdownMenuItem>
          )}

          {isTicketOpen && (
            <DropdownMenuItem onClick={() => setShowCloseDialog(true)}>
              <XCircle className="w-4 h-4 mr-2" />
              Fechar Ticket
            </DropdownMenuItem>
          )}

          {isTicketClosed && (
            <DropdownMenuItem onClick={() => setShowReopenDialog(true)}>
              <RotateCcw className="w-4 h-4 mr-2" />
              Reabrir Ticket
            </DropdownMenuItem>
          )}

          {isTicketOpen && ticket.assigned_queue_id && (
            <DropdownMenuItem onClick={handleRemoveFromQueue}>
              <X className="w-4 h-4 mr-2" />
              Remover da Fila
            </DropdownMenuItem>
          )}

          {isTicketOpen && (
            <>
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
            </>
          )}

          <DropdownMenuSeparator />
          <DropdownMenuLabel>Estágio do Funil</DropdownMenuLabel>
          
          {funnelStages.map((stage) => (
            <DropdownMenuItem 
              key={stage.id} 
              onClick={() => handleUpdateFunnelStage(stage.id)}
            >
              <Filter className="w-4 h-4 mr-2" />
              <div className="flex items-center gap-2">
                <div 
                  className="w-3 h-3 rounded-full" 
                  style={{ backgroundColor: stage.color }}
                />
                {stage.name}
              </div>
            </DropdownMenuItem>
          ))}

          <DropdownMenuSeparator />
          <DropdownMenuLabel>Tags</DropdownMenuLabel>
          
          <DropdownMenuItem onClick={handleAddTag}>
            <Tag className="w-4 h-4 mr-2" />
            Adicionar Tag
          </DropdownMenuItem>

          {/* Mostrar tags existentes do ticket */}
          {Array.isArray(ticket.tags) && ticket.tags.length > 0 && (
            <>
              <DropdownMenuSeparator />
              <div className="px-2 py-1">
                <div className="flex flex-wrap gap-1">
                  {ticket.tags.map((tag, index) => (
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

      <AlertDialog open={showCloseDialog} onOpenChange={setShowCloseDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Fechar Ticket</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja fechar este ticket? 
              <br />
              <strong>"{ticket.title}"</strong>
              <br />
              O ticket será marcado como fechado e movido para a aba de tickets fechados.
              Se uma nova mensagem for recebida, o ticket será reaberto automaticamente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleCloseTicket}
              className="bg-orange-600 text-white hover:bg-orange-700"
            >
              Fechar Ticket
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showReopenDialog} onOpenChange={setShowReopenDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reabrir Ticket</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja reabrir este ticket? 
              <br />
              <strong>"{ticket.title}"</strong>
              <br />
              O ticket será marcado como aberto e movido para a aba de tickets abertos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleReopenTicket}
              className="bg-green-600 text-white hover:bg-green-700"
            >
              Reabrir Ticket
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default TicketActionsMenu;
