
import React from 'react';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MoreVertical, User, ArrowRight, CheckCircle, Clock, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { ticketsService, type ConversationTicket } from "@/services/ticketsService";
import { queuesService } from "@/services/queuesService";

interface TicketActionsMenuProps {
  ticket: ConversationTicket;
  onTicketUpdate: () => void;
}

const TicketActionsMenu = ({ ticket, onTicketUpdate }: TicketActionsMenuProps) => {
  const { toast } = useToast();
  const [queues, setQueues] = React.useState<any[]>([]);
  const [selectedQueue, setSelectedQueue] = React.useState<string>("");
  const [transferReason, setTransferReason] = React.useState("");
  const [isLoading, setIsLoading] = React.useState(false);

  React.useEffect(() => {
    loadQueues();
  }, [ticket.client_id]);

  const loadQueues = async () => {
    try {
      const clientQueues = await queuesService.getClientQueues(ticket.client_id);
      setQueues(clientQueues || []);
    } catch (error) {
      console.error('Erro ao carregar filas:', error);
    }
  };

  const handleAssumeManually = async () => {
    try {
      setIsLoading(true);
      await ticketsService.assumeTicketManually(ticket.id);
      
      toast({
        title: "Ticket assumido",
        description: "Ticket foi assumido manualmente pelo operador"
      });
      
      onTicketUpdate();
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message || "Erro ao assumir ticket",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleTransferQueue = async () => {
    if (!selectedQueue) {
      toast({
        title: "Erro",
        description: "Selecione uma fila para transferir",
        variant: "destructive"
      });
      return;
    }

    try {
      setIsLoading(true);
      await ticketsService.transferTicket(ticket.id, selectedQueue, transferReason);
      
      toast({
        title: "Ticket transferido",
        description: "Ticket foi transferido para outra fila"
      });
      
      setSelectedQueue("");
      setTransferReason("");
      onTicketUpdate();
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message || "Erro ao transferir ticket",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleStatusChange = async (newStatus: string) => {
    try {
      setIsLoading(true);
      await ticketsService.updateTicketStatus(ticket.id, newStatus);
      
      toast({
        title: "Status atualizado",
        description: `Status do ticket alterado para ${getStatusLabel(newStatus)}`
      });
      
      onTicketUpdate();
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message || "Erro ao atualizar status",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open': return 'bg-green-100 text-green-800 border-green-200';
      case 'pending': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'resolved': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'closed': return 'bg-gray-100 text-gray-800 border-gray-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'open': return 'Aberto';
      case 'pending': return 'Pendente';
      case 'resolved': return 'Resolvido';
      case 'closed': return 'Fechado';
      default: return status;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'open': return <AlertCircle className="w-3 h-3" />;
      case 'pending': return <Clock className="w-3 h-3" />;
      case 'resolved': return <CheckCircle className="w-3 h-3" />;
      case 'closed': return <CheckCircle className="w-3 h-3" />;
      default: return <AlertCircle className="w-3 h-3" />;
    }
  };

  const isHumanManaged = ticket.status === 'pending' || 
                        ticket.status === 'resolved' || 
                        ticket.status === 'closed';

  return (
    <div className="flex items-center gap-2">
      {/* Status Badge */}
      <Badge className={`text-xs ${getStatusColor(ticket.status)}`}>
        {getStatusIcon(ticket.status)}
        <span className="ml-1">{getStatusLabel(ticket.status)}</span>
      </Badge>

      {/* Actions Menu */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" disabled={isLoading}>
            <MoreVertical className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel>Ações do Ticket</DropdownMenuLabel>
          <DropdownMenuSeparator />
          
          {/* Assumir manualmente */}
          {!isHumanManaged && (
            <DropdownMenuItem onClick={handleAssumeManually}>
              <User className="mr-2 h-4 w-4" />
              Assumir Manualmente
            </DropdownMenuItem>
          )}

          {/* Transferir Fila */}
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                <ArrowRight className="mr-2 h-4 w-4" />
                Transferir Fila
              </DropdownMenuItem>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Transferir Ticket</AlertDialogTitle>
                <AlertDialogDescription>
                  Selecione a fila de destino para transferir este ticket.
                </AlertDialogDescription>
              </AlertDialogHeader>
              
              <div className="space-y-4">
                <div>
                  <Label htmlFor="queue-select">Fila de Destino</Label>
                  <Select value={selectedQueue} onValueChange={setSelectedQueue}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione uma fila" />
                    </SelectTrigger>
                    <SelectContent>
                      {queues.map((queue) => (
                        <SelectItem key={queue.id} value={queue.id}>
                          {queue.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div>
                  <Label htmlFor="transfer-reason">Motivo (opcional)</Label>
                  <Input
                    id="transfer-reason"
                    placeholder="Motivo da transferência..."
                    value={transferReason}
                    onChange={(e) => setTransferReason(e.target.value)}
                  />
                </div>
              </div>

              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={handleTransferQueue}>
                  Transferir
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          <DropdownMenuSeparator />
          
          {/* Alterar Status */}
          <DropdownMenuLabel>Alterar Status</DropdownMenuLabel>
          
          {ticket.status !== 'open' && (
            <DropdownMenuItem onClick={() => handleStatusChange('open')}>
              <AlertCircle className="mr-2 h-4 w-4 text-green-600" />
              Reabrir
            </DropdownMenuItem>
          )}
          
          {ticket.status !== 'pending' && (
            <DropdownMenuItem onClick={() => handleStatusChange('pending')}>
              <Clock className="mr-2 h-4 w-4 text-yellow-600" />
              Marcar como Pendente
            </DropdownMenuItem>
          )}
          
          {ticket.status !== 'resolved' && (
            <DropdownMenuItem onClick={() => handleStatusChange('resolved')}>
              <CheckCircle className="mr-2 h-4 w-4 text-blue-600" />
              Marcar como Resolvido
            </DropdownMenuItem>
          )}
          
          {ticket.status !== 'closed' && (
            <DropdownMenuItem onClick={() => handleStatusChange('closed')}>
              <CheckCircle className="mr-2 h-4 w-4 text-gray-600" />
              Fechar Ticket
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
};

export default TicketActionsMenu;
