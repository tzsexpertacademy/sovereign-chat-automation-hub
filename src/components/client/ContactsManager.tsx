
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, User, Edit, Trash2, Plus, Phone, Mail, Calendar, Save, X, MessageCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useNavigate, useLocation } from "react-router-dom";
import { customersService, type Customer } from "@/services/customersService";
import { ticketsService } from "@/services/ticketsService";

interface ContactsManagerProps {
  clientId: string;
}

const ContactsManager = ({ clientId }: ContactsManagerProps) => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [filteredCustomers, setFilteredCustomers] = useState<Customer[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editForm, setEditForm] = useState({
    name: "",
    phone: "",
    email: "",
    notes: "",
    birth_date: ""
  });
  const [createAndOpenChat, setCreateAndOpenChat] = useState(false);

  useEffect(() => {
    loadCustomers();
  }, [clientId]);

  useEffect(() => {
    const filtered = customers.filter(customer => 
      customer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      customer.phone.includes(searchTerm) ||
      (customer.email && customer.email.toLowerCase().includes(searchTerm.toLowerCase()))
    );
    setFilteredCustomers(filtered);
  }, [customers, searchTerm]);

  const loadCustomers = async () => {
    try {
      setIsLoading(true);
      const data = await customersService.getClientCustomers(clientId);
      setCustomers(data);
    } catch (error) {
      console.error('Erro ao carregar contatos:', error);
      toast({
        title: "Erro",
        description: "Falha ao carregar contatos",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const openEditDialog = (customer: Customer) => {
    setSelectedCustomer(customer);
    setEditForm({
      name: customer.name,
      phone: customer.phone,
      email: customer.email || "",
      notes: customer.notes || "",
      birth_date: customer.birth_date || ""
    });
    setIsEditDialogOpen(true);
  };

  const openCreateDialog = () => {
    setEditForm({
      name: "",
      phone: "",
      email: "",
      notes: "",
      birth_date: ""
    });
    setCreateAndOpenChat(false);
    setIsCreateDialogOpen(true);
  };

  const handleOpenChat = async (customer: Customer) => {
    try {
      console.log('🚀 Abrindo chat para cliente:', customer.name, customer.id);
      
      // Verificar se já existe ticket para este customer
      const existingTicket = await customersService.findCustomerTicket(clientId, customer.id);
      
      if (existingTicket) {
        console.log('📋 Ticket existente encontrado:', existingTicket.id);
        
        // Navegar para ticket existente com parâmetro para abrir aba de conversas
        navigate(`/client/${clientId}/chat/${existingTicket.id}?openConversation=true`);
      } else {
        console.log('📋 Criando novo ticket manual...');
        // Criar novo ticket manual e navegar
        const ticket = await ticketsService.createManualTicket(clientId, customer.id);
        console.log('✅ Ticket criado:', ticket.id);
        
        // Navegar para o novo ticket com parâmetro para abrir aba de conversas
        navigate(`/client/${clientId}/chat/${ticket.id}?openConversation=true`);
      }
    } catch (error) {
      console.error('❌ Erro ao abrir conversa:', error);
      toast({
        title: "Erro",
        description: "Falha ao abrir conversa: " + (error as Error).message,
        variant: "destructive"
      });
    }
  };

  const handleSave = async () => {
    if (!editForm.name.trim() || !editForm.phone.trim()) {
      toast({
        title: "Erro",
        description: "Nome e telefone são obrigatórios",
        variant: "destructive"
      });
      return;
    }

    try {
      if (selectedCustomer) {
        // Editar contato existente
        await customersService.updateCustomer(selectedCustomer.id, editForm);
        toast({
          title: "Sucesso",
          description: "Contato atualizado com sucesso"
        });
        setIsEditDialogOpen(false);
      } else {
        // Criar novo contato
        const newCustomer = await customersService.createCustomer({
          ...editForm,
          client_id: clientId
        });
        
        toast({
          title: "Sucesso",
          description: "Contato criado com sucesso"
        });
        setIsCreateDialogOpen(false);
        
        // Se marcou para criar conversa, criar ticket e navegar
        if (createAndOpenChat) {
          try {
            const ticket = await ticketsService.createManualTicket(clientId, newCustomer.id);
            
            // Navegar para o novo ticket com parâmetro para abrir aba de conversas
            navigate(`/client/${clientId}/chat/${ticket.id}?openConversation=true`);
            return;
          } catch (error) {
            console.error('Erro ao criar conversa:', error);
            toast({
              title: "Erro",
              description: "Contato criado, mas falha ao criar conversa",
              variant: "destructive"
            });
          }
        }
      }
      
      loadCustomers();
      setSelectedCustomer(null);
      setCreateAndOpenChat(false);
    } catch (error) {
      console.error('Erro ao salvar contato:', error);
      toast({
        title: "Erro",
        description: "Falha ao salvar contato",
        variant: "destructive"
      });
    }
  };

  const handleDelete = async (customerId: string) => {
    if (!confirm('Tem certeza que deseja excluir este contato?')) return;

    try {
      await customersService.deleteCustomer(customerId);
      toast({
        title: "Sucesso",
        description: "Contato excluído com sucesso"
      });
      loadCustomers();
    } catch (error) {
      console.error('Erro ao excluir contato:', error);
      toast({
        title: "Erro",
        description: "Falha ao excluir contato",
        variant: "destructive"
      });
    }
  };

  const formatPhone = (phone: string) => {
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length === 13 && cleaned.startsWith('55')) {
      const number = cleaned.substring(2);
      return number.replace(/(\d{2})(\d{4,5})(\d{4})/, '($1) $2-$3');
    }
    return phone;
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return '';
    return new Date(dateString).toLocaleDateString('pt-BR');
  };

  const EditDialog = ({ isOpen, onClose, title }: { isOpen: boolean; onClose: () => void; title: string }) => (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {selectedCustomer ? 'Edite as informações do contato' : 'Preencha as informações do novo contato'}
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="name">Nome *</Label>
              <Input
                id="name"
                value={editForm.name}
                onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                placeholder="Nome completo"
              />
            </div>
            <div>
              <Label htmlFor="phone">Telefone *</Label>
              <Input
                id="phone"
                value={editForm.phone}
                onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                placeholder="(47) 99999-9999"
              />
            </div>
          </div>
          
          <div>
            <Label htmlFor="email">E-mail</Label>
            <Input
              id="email"
              type="email"
              value={editForm.email}
              onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
              placeholder="contato@email.com"
            />
          </div>
          
          <div>
            <Label htmlFor="birth_date">Data de Nascimento</Label>
            <Input
              id="birth_date"
              type="date"
              value={editForm.birth_date}
              onChange={(e) => setEditForm({ ...editForm, birth_date: e.target.value })}
            />
          </div>
          
          <div>
            <Label htmlFor="notes">Observações</Label>
            <Textarea
              id="notes"
              value={editForm.notes}
              onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
              placeholder="Informações adicionais sobre o contato..."
              rows={3}
            />
          </div>
          
          {!selectedCustomer && (
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="createAndOpenChat"
                checked={createAndOpenChat}
                onChange={(e) => setCreateAndOpenChat(e.target.checked)}
                className="rounded border-gray-300"
              />
              <Label htmlFor="createAndOpenChat" className="text-sm">
                Criar conversa automaticamente
              </Label>
            </div>
          )}
        </div>
        
        <div className="flex justify-end space-x-2 pt-4">
          <Button variant="outline" onClick={onClose}>
            <X className="w-4 h-4 mr-2" />
            Cancelar
          </Button>
          <Button onClick={handleSave}>
            <Save className="w-4 h-4 mr-2" />
            {!selectedCustomer && createAndOpenChat ? 'Salvar e Abrir Chat' : 'Salvar'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );

  return (
    <Card className="h-full">
      <CardHeader>
        <div className="flex justify-between items-center">
          <div>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Contatos ({filteredCustomers.length})
            </CardTitle>
            <CardDescription>
              Gerencie seus contatos salvos
            </CardDescription>
          </div>
          <Button onClick={openCreateDialog}>
            <Plus className="w-4 h-4 mr-2" />
            Novo Contato
          </Button>
        </div>
        
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
          <Input
            placeholder="Buscar contatos..."
            className="pl-10"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </CardHeader>
      
      <CardContent className="p-0">
        <ScrollArea className="h-[calc(100vh-300px)]">
          {isLoading ? (
            <div className="p-4 text-center text-gray-500">
              Carregando contatos...
            </div>
          ) : filteredCustomers.length === 0 ? (
            <div className="p-4 text-center text-gray-500">
              <User className="w-8 h-8 mx-auto mb-2 text-gray-400" />
              <p>Nenhum contato encontrado</p>
              <p className="text-sm">
                {customers.length === 0 
                  ? "Adicione seu primeiro contato"
                  : "Nenhum contato corresponde à busca"
                }
              </p>
            </div>
          ) : (
            <div className="divide-y">
              {filteredCustomers.map((customer) => (
                <div key={customer.id} className="p-4 hover:bg-gray-50 transition-colors">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start space-x-3 flex-1">
                      <Avatar className="w-12 h-12">
                        <AvatarImage src={`https://api.dicebear.com/7.x/initials/svg?seed=${customer.name}`} />
                        <AvatarFallback>
                          {customer.name.substring(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      
                      <div className="flex-1 min-w-0">
                        <h3 className="font-medium text-gray-900 truncate">
                          {customer.name}
                        </h3>
                        
                        <div className="space-y-1 text-sm text-gray-600">
                          <div className="flex items-center gap-1">
                            <Phone className="w-3 h-3" />
                            <span>{formatPhone(customer.phone)}</span>
                          </div>
                          
                          {customer.email && (
                            <div className="flex items-center gap-1">
                              <Mail className="w-3 h-3" />
                              <span className="truncate">{customer.email}</span>
                            </div>
                          )}
                          
                          {customer.birth_date && (
                            <div className="flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              <span>{formatDate(customer.birth_date)}</span>
                            </div>
                          )}
                        </div>
                        
                        {customer.notes && (
                          <p className="text-xs text-gray-500 mt-2 line-clamp-2">
                            {customer.notes}
                          </p>
                        )}
                        
                        <div className="flex items-center gap-2 mt-2 text-xs text-gray-500">
                          <span>Criado em {formatDate(customer.created_at)}</span>
                          {customer.whatsapp_chat_id && (
                            <Badge variant="outline" className="text-xs">
                              WhatsApp
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                     
                     <div className="flex space-x-1 ml-2">
                       <Button
                         size="sm"
                         variant="outline"
                         onClick={() => handleOpenChat(customer)}
                         className="text-green-600 hover:text-green-700"
                       >
                         <MessageCircle className="w-3 h-3" />
                       </Button>
                       <Button
                         size="sm"
                         variant="outline"
                         onClick={() => openEditDialog(customer)}
                       >
                         <Edit className="w-3 h-3" />
                       </Button>
                       <Button
                         size="sm"
                         variant="outline"
                         onClick={() => handleDelete(customer.id)}
                         className="text-red-600 hover:text-red-700"
                       >
                         <Trash2 className="w-3 h-3" />
                       </Button>
                     </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </CardContent>
      
      <EditDialog 
        isOpen={isEditDialogOpen} 
        onClose={() => setIsEditDialogOpen(false)}
        title="Editar Contato"
      />
      
      <EditDialog 
        isOpen={isCreateDialogOpen} 
        onClose={() => setIsCreateDialogOpen(false)}
        title="Novo Contato"
      />
    </Card>
  );
};

export default ContactsManager;
