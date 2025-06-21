
import { useState } from 'react';
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AlertTriangle, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { ticketsService } from "@/services/ticketsService";

interface TicketDeleteDialogProps {
  ticketId: string;
  customerName: string;
  isOpen: boolean;
  onClose: () => void;
  onTicketDeleted: () => void;
}

const TicketDeleteDialog = ({ 
  ticketId, 
  customerName, 
  isOpen, 
  onClose, 
  onTicketDeleted 
}: TicketDeleteDialogProps) => {
  const [isDeleting, setIsDeleting] = useState(false);
  const { toast } = useToast();

  const handleDelete = async () => {
    try {
      setIsDeleting(true);
      
      await ticketsService.deleteTicket(ticketId);
      
      toast({
        title: "Ticket excluído",
        description: "O ticket e todas as suas mensagens foram excluídos com sucesso",
      });
      
      onTicketDeleted();
      onClose();
      
    } catch (error: any) {
      console.error('Erro ao excluir ticket:', error);
      toast({
        title: "Erro ao excluir",
        description: error.message || "Falha ao excluir o ticket",
        variant: "destructive"
      });
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2 text-red-600">
            <AlertTriangle className="w-5 h-5" />
            <span>Excluir Ticket</span>
          </DialogTitle>
          <DialogDescription className="pt-2">
            Tem certeza que deseja excluir este ticket de <strong>{customerName}</strong>?
            <br />
            <br />
            <span className="text-red-600 font-medium">
              ⚠️ Esta ação é irreversível e excluirá:
            </span>
            <ul className="mt-2 text-sm text-gray-600 list-disc list-inside">
              <li>O ticket completo</li>
              <li>Todas as mensagens da conversa</li>
              <li>Todo o histórico de interações</li>
            </ul>
          </DialogDescription>
        </DialogHeader>
        
        <DialogFooter className="gap-2">
          <Button 
            variant="outline" 
            onClick={onClose}
            disabled={isDeleting}
          >
            Cancelar
          </Button>
          <Button 
            variant="destructive" 
            onClick={handleDelete}
            disabled={isDeleting}
            className="flex items-center space-x-2"
          >
            {isDeleting ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Excluindo...</span>
              </>
            ) : (
              <>
                <Trash2 className="w-4 h-4" />
                <span>Excluir Ticket</span>
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default TicketDeleteDialog;
