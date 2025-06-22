
import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Users, UserPlus, Upload, Search, Edit, Trash2, Phone, Mail, Calendar } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { customersService, type Customer } from "@/services/customersService";

interface ContactsManagerProps {
  clientId: string;
}

const ContactsManager = ({ clientId }: ContactsManagerProps) => {
  const [contacts, setContacts] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingContact, setEditingContact] = useState<Customer | null>(null);
  const [uploadDialog, setUploadDialog] = useState(false);
  const { toast } = useToast();

  const [newContact, setNewContact] = useState({
    name: "",
    phone: "",
    email: "",
    notes: "",
    birth_date: ""
  });

  useEffect(() => {
    loadContacts();
  }, [clientId]);

  const loadContacts = async () => {
    try {
      setLoading(true);
      const data = await customersService.getClientCustomers(clientId);
      setContacts(data);
    } catch (error) {
      console.error('Erro ao carregar contatos:', error);
      toast({
        title: "Erro",
        description: "Erro ao carregar contatos",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSaveContact = async () => {
    try {
      if (!newContact.name || !newContact.phone) {
        toast({
          title: "Erro",
          description: "Nome e telefone são obrigatórios",
          variant: "destructive"
        });
        return;
      }

      if (editingContact) {
        await customersService.updateCustomer(editingContact.id, {
          ...newContact,
          client_id: clientId
        });
        toast({
          title: "Sucesso",
          description: "Contato atualizado com sucesso"
        });
      } else {
        await customersService.createCustomer({
          ...newContact,
          client_id: clientId
        });
        toast({
          title: "Sucesso",
          description: "Contato criado com sucesso"
        });
      }

      setShowAddDialog(false);
      setEditingContact(null);
      setNewContact({ name: "", phone: "", email: "", notes: "", birth_date: "" });
      loadContacts();
    } catch (error) {
      console.error('Erro ao salvar contato:', error);
      toast({
        title: "Erro",
        description: "Erro ao salvar contato",
        variant: "destructive"
      });
    }
  };

  const handleDeleteContact = async (contactId: string) => {
    try {
      await customersService.deleteCustomer(contactId);
      toast({
        title: "Sucesso",
        description: "Contato excluído com sucesso"
      });
      loadContacts();
    } catch (error) {
      console.error('Erro ao excluir contato:', error);
      toast({
        title: "Erro",
        description: "Erro ao excluir contato",
        variant: "destructive"
      });
    }
  };

  const handleEditContact = (contact: Customer) => {
    setEditingContact(contact);
    setNewContact({
      name: contact.name,
      phone: contact.phone,
      email: contact.email || "",
      notes: contact.notes || "",
      birth_date: contact.birth_date || ""
    });
    setShowAddDialog(true);
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const lines = text.split('\n');
      const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
      
      let successCount = 0;
      let errorCount = 0;

      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',').map(v => v.trim());
        if (values.length < 2) continue;

        try {
          const nameIndex = headers.findIndex(h => h.includes('nome') || h.includes('name'));
          const phoneIndex = headers.findIndex(h => h.includes('telefone') || h.includes('phone'));
          const emailIndex = headers.findIndex(h => h.includes('email'));

          if (nameIndex === -1 || phoneIndex === -1) continue;

          const contactData = {
            client_id: clientId,
            name: values[nameIndex] || `Contato ${i}`,
            phone: values[phoneIndex].replace(/\D/g, ''),
            email: emailIndex !== -1 ? values[emailIndex] : undefined
          };

          await customersService.createCustomer(contactData);
          successCount++;
        } catch (error) {
          console.error(`Erro na linha ${i}:`, error);
          errorCount++;
        }
      }

      toast({
        title: "Upload Concluído",
        description: `${successCount} contatos importados, ${errorCount} erros`
      });

      setUploadDialog(false);
      loadContacts();
    } catch (error) {
      console.error('Erro no upload:', error);
      toast({
        title: "Erro",
        description: "Erro ao processar arquivo",
        variant: "destructive"
      });
    }
  };

  const filteredContacts = contacts.filter(contact =>
    contact.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    contact.phone.includes(searchTerm) ||
    contact.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const formatPhone = (phone: string) => {
    const cleanPhone = phone.replace(/\D/g, '');
    return cleanPhone.replace(/(\d{2})(\d{4,5})(\d{4})/, '($1) $2-$3');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
          <p className="text-muted-foreground">Carregando contatos...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Gerenciar Contatos</h2>
          <p className="text-muted-foreground">
            Gerencie sua lista de contatos e importe novos contatos
          </p>
        </div>
        <div className="flex gap-2">
          <Dialog open={uploadDialog} onOpenChange={setUploadDialog}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <Upload className="h-4 w-4 mr-2" />
                Importar Lista
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Importar Lista de Contatos</DialogTitle>
                <DialogDescription>
                  Faça upload de um arquivo CSV com as colunas: nome, telefone, email
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="file">Arquivo CSV</Label>
                  <Input
                    id="file"
                    type="file"
                    accept=".csv"
                    onChange={handleFileUpload}
                  />
                </div>
                <div className="text-sm text-muted-foreground">
                  <p><strong>Formato esperado:</strong></p>
                  <p>nome,telefone,email</p>
                  <p>João Silva,11999999999,joao@email.com</p>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
            <DialogTrigger asChild>
              <Button>
                <UserPlus className="h-4 w-4 mr-2" />
                Novo Contato
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>
                  {editingContact ? 'Editar Contato' : 'Novo Contato'}
                </DialogTitle>
                <DialogDescription>
                  {editingContact ? 'Edite as informações do contato' : 'Adicione um novo contato à sua lista'}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="name">Nome *</Label>
                  <Input
                    id="name"
                    value={newContact.name}
                    onChange={(e) => setNewContact({...newContact, name: e.target.value})}
                    placeholder="Nome completo"
                  />
                </div>
                <div>
                  <Label htmlFor="phone">Telefone *</Label>
                  <Input
                    id="phone"
                    value={newContact.phone}
                    onChange={(e) => setNewContact({...newContact, phone: e.target.value})}
                    placeholder="(11) 99999-9999"
                  />
                </div>
                <div>
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={newContact.email}
                    onChange={(e) => setNewContact({...newContact, email: e.target.value})}
                    placeholder="email@exemplo.com"
                  />
                </div>
                <div>
                  <Label htmlFor="birth_date">Data de Nascimento</Label>
                  <Input
                    id="birth_date"
                    type="date"
                    value={newContact.birth_date}
                    onChange={(e) => setNewContact({...newContact, birth_date: e.target.value})}
                  />
                </div>
                <div>
                  <Label htmlFor="notes">Observações</Label>
                  <Input
                    id="notes"
                    value={newContact.notes}
                    onChange={(e) => setNewContact({...newContact, notes: e.target.value})}
                    placeholder="Observações sobre o contato"
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => {
                    setShowAddDialog(false);
                    setEditingContact(null);
                    setNewContact({ name: "", phone: "", email: "", notes: "", birth_date: "" });
                  }}>
                    Cancelar
                  </Button>
                  <Button onClick={handleSaveContact}>
                    {editingContact ? 'Atualizar' : 'Criar'}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Estatísticas */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Contatos</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{contacts.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Com WhatsApp</CardTitle>
            <Phone className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {contacts.filter(c => c.whatsapp_chat_id).length}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Com Email</CardTitle>
            <Mail className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {contacts.filter(c => c.email).length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Busca */}
      <div className="flex items-center space-x-2">
        <Search className="h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar contatos por nome, telefone ou email..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="max-w-sm"
        />
      </div>

      {/* Lista de Contatos */}
      <Card>
        <CardHeader>
          <CardTitle>Lista de Contatos ({filteredContacts.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[500px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Contato</TableHead>
                  <TableHead>Telefone</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>WhatsApp</TableHead>
                  <TableHead>Criado em</TableHead>
                  <TableHead>Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredContacts.map((contact) => (
                  <TableRow key={contact.id}>
                    <TableCell>
                      <div className="flex items-center space-x-3">
                        <Avatar className="w-8 h-8">
                          <AvatarFallback>
                            {contact.name.substring(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium">{contact.name}</p>
                          {contact.notes && (
                            <p className="text-sm text-muted-foreground truncate max-w-[200px]">
                              {contact.notes}
                            </p>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>{formatPhone(contact.phone)}</TableCell>
                    <TableCell>{contact.email || '-'}</TableCell>
                    <TableCell>
                      {contact.whatsapp_chat_id ? (
                        <Badge variant="secondary">Conectado</Badge>
                      ) : (
                        <Badge variant="outline">Não conectado</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {new Date(contact.created_at).toLocaleDateString('pt-BR')}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center space-x-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEditContact(contact)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteContact(contact.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
};

export default ContactsManager;
