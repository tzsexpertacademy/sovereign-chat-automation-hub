
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Plus, Send, MessageSquare, Phone } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { ticketsService } from "@/services/ticketsService";
import { whatsappService } from "@/services/whatsappMultiClient";
import { supabase } from "@/integrations/supabase/client";
import { smartFormatPhone, formatToDisplay } from "@/utils/phoneFormatter";

interface ManualTicketCreatorProps {
  clientId: string;
  onTicketCreated?: () => void;
}

const ManualTicketCreator = ({ clientId, onTicketCreated }: ManualTicketCreatorProps) => {
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [isSending, setIsSending] = useState(false);
  
  const [formData, setFormData] = useState({
    customerName: "",
    customerPhone: "",
    initialMessage: ""
  });

  // Estado para preview do número formatado
  const [phonePreview, setPhonePreview] = useState<{
    formatted: string;
    isValid: boolean;
  }>({ formatted: "", isValid: false });

  // Buscar instanceId do cliente
  const getClientInstanceId = async (): Promise<string> => {
    const { data: client, error } = await supabase
      .from('clients')
      .select('instance_id')
      .eq('id', clientId)
      .single();

    if (error || !client?.instance_id) {
      throw new Error('Cliente não tem instância ativa');
    }

    return client.instance_id;
  };

  // Atualizar preview do telefone quando mudar
  const handlePhoneChange = (phone: string) => {
    setFormData(prev => ({ ...prev, customerPhone: phone }));
    
    if (phone.trim()) {
      const phoneData = smartFormatPhone(phone);
      setPhonePreview({
        formatted: phoneData.displayNumber,
        isValid: phoneData.isValid
      });
    } else {
      setPhonePreview({ formatted: "", isValid: false });
    }
  };

  const handleCreateTicket = async () => {
    if (!formData.customerName.trim() || !formData.customerPhone.trim()) {
      toast({
        title: "Erro",
        description: "Nome e telefone são obrigatórios",
        variant: "destructive"
      });
      return;
    }

    try {
      setIsCreating(true);
      console.log('🎫 [MANUAL] Criando ticket manual...');

      // Buscar instanceId real
      const instanceId = await getClientInstanceId();
      console.log('🔍 [MANUAL] InstanceId encontrado:', instanceId);

      // Formatar telefone corretamente
      const phoneData = smartFormatPhone(formData.customerPhone);
      
      if (!phoneData.isValid) {
        toast({
          title: "Número inválido",
          description: "Por favor, insira um número de celular brasileiro válido",
          variant: "destructive"
        });
        return;
      }

      console.log('📞 [MANUAL] Dados do telefone:', phoneData);

      // Criar ticket
      const ticketId = await ticketsService.ensureTicketExists(
        clientId,
        phoneData.chatId,
        instanceId,
        formData.customerName,
        phoneData.cleanNumber,
        formData.initialMessage || 'Ticket criado manualmente',
        new Date().toISOString()
      );

      console.log('✅ [MANUAL] Ticket criado:', ticketId);

      toast({
        title: "Ticket criado",
        description: `Ticket criado para ${formData.customerName} (${phoneData.displayNumber})`
      });

      // Se tem mensagem inicial, vamos tentar enviar
      if (formData.initialMessage.trim()) {
        await handleSendMessage(phoneData.chatId, formData.initialMessage);
      }

      // Resetar form e fechar
      setFormData({ customerName: "", customerPhone: "", initialMessage: "" });
      setPhonePreview({ formatted: "", isValid: false });
      setIsOpen(false);
      
      // Notificar para recarregar tickets
      if (onTicketCreated) {
        onTicketCreated();
      }

    } catch (error: any) {
      console.error('❌ [MANUAL] Erro ao criar ticket:', error);
      toast({
        title: "Erro ao criar ticket",
        description: error.message || "Falha ao criar ticket",
        variant: "destructive"
      });
    } finally {
      setIsCreating(false);
    }
  };

  const handleSendMessage = async (chatId: string, message: string) => {
    try {
      setIsSending(true);
      console.log('📤 [MANUAL] Enviando mensagem para:', chatId);

      await whatsappService.sendMessage(clientId, chatId, message);
      
      toast({
        title: "Mensagem enviada",
        description: "Mensagem enviada com sucesso"
      });

    } catch (error: any) {
      console.error('❌ [MANUAL] Erro ao enviar mensagem:', error);
      toast({
        title: "Erro ao enviar",
        description: error.message || "Falha ao enviar mensagem",
        variant: "destructive"
      });
    } finally {
      setIsSending(false);
    }
  };

  const handleQuickSend = async () => {
    if (!formData.customerPhone.trim() || !formData.initialMessage.trim()) {
      toast({
        title: "Erro",
        description: "Telefone e mensagem são obrigatórios para envio",
        variant: "destructive"
      });
      return;
    }

    const phoneData = smartFormatPhone(formData.customerPhone);
    
    if (!phoneData.isValid) {
      toast({
        title: "Número inválido",
        description: "Por favor, insira um número de celular brasileiro válido",
        variant: "destructive"
      });
      return;
    }
    
    await handleSendMessage(phoneData.chatId, formData.initialMessage);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Plus className="w-4 h-4" />
          Criar Ticket Manual
        </Button>
      </DialogTrigger>
      
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Criar Ticket Manual</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <div>
            <Label htmlFor="customerName">Nome do Cliente</Label>
            <Input
              id="customerName"
              placeholder="Digite o nome..."
              value={formData.customerName}
              onChange={(e) => setFormData(prev => ({ 
                ...prev, 
                customerName: e.target.value 
              }))}
            />
          </div>
          
          <div>
            <Label htmlFor="customerPhone">Telefone/WhatsApp</Label>
            <div className="space-y-2">
              <Input
                id="customerPhone"
                placeholder="47999999999 ou +55 47 99999-9999"
                value={formData.customerPhone}
                onChange={(e) => handlePhoneChange(e.target.value)}
              />
              {phonePreview.formatted && (
                <div className={`text-xs flex items-center gap-1 ${
                  phonePreview.isValid ? 'text-green-600' : 'text-orange-600'
                }`}>
                  <Phone className="w-3 h-3" />
                  {phonePreview.formatted}
                  {phonePreview.isValid ? ' ✓' : ' (verificar formato)'}
                </div>
              )}
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Aceita: 47999999999, +55 47 99999-9999, etc.
            </p>
          </div>
          
          <div>
            <Label htmlFor="initialMessage">Mensagem Inicial (Opcional)</Label>
            <Textarea
              id="initialMessage"
              placeholder="Digite uma mensagem para enviar..."
              value={formData.initialMessage}
              onChange={(e) => setFormData(prev => ({ 
                ...prev, 
                initialMessage: e.target.value 
              }))}
              rows={3}
            />
          </div>
          
          <div className="flex gap-2">
            <Button
              onClick={handleCreateTicket}
              disabled={isCreating || isSending || !phonePreview.isValid}
              className="flex-1"
            >
              {isCreating ? "Criando..." : "Criar Ticket"}
            </Button>
            
            {formData.initialMessage.trim() && (
              <Button
                onClick={handleQuickSend}
                disabled={isCreating || isSending || !phonePreview.isValid}
                variant="outline"
                size="sm"
                className="gap-1"
              >
                <Send className="w-4 h-4" />
                {isSending ? "Enviando..." : "Só Enviar"}
              </Button>
            )}
          </div>
          
          <div className="bg-blue-50 p-3 rounded-lg">
            <p className="text-sm text-blue-800 font-medium mb-1">
              📞 Formatação de Número:
            </p>
            <ul className="text-xs text-blue-700 space-y-1">
              <li>• <strong>Aceita:</strong> 47999999999 ou +55 47 99999-9999</li>
              <li>• <strong>Resultado:</strong> +55 47 99999-9999@c.us</li>
              <li>• <strong>Válido:</strong> Celulares brasileiros com DDD</li>
            </ul>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ManualTicketCreator;
