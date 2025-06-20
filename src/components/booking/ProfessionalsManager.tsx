
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Plus, Edit, Trash2, User, Mail, Phone } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { professionalsService, type ProfessionalWithServices } from "@/services/professionalsService";

interface ProfessionalsManagerProps {
  clientId: string;
}

const ProfessionalsManager: React.FC<ProfessionalsManagerProps> = ({ clientId }) => {
  const [professionals, setProfessionals] = useState<ProfessionalWithServices[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingProfessional, setEditingProfessional] = useState<ProfessionalWithServices | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    specialty: '',
    description: '',
    timezone: 'America/Sao_Paulo'
  });
  const { toast } = useToast();

  useEffect(() => {
    loadProfessionals();
  }, [clientId]);

  const loadProfessionals = async () => {
    try {
      setLoading(true);
      const data = await professionalsService.getClientProfessionals(clientId);
      setProfessionals(data);
    } catch (error) {
      console.error('Erro ao carregar profissionais:', error);
      toast({
        title: "Erro",
        description: "Erro ao carregar profissionais",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingProfessional) {
        await professionalsService.updateProfessional(editingProfessional.id, {
          ...formData,
          client_id: clientId,
          is_active: true
        });
        toast({
          title: "Sucesso",
          description: "Profissional atualizado com sucesso"
        });
      } else {
        await professionalsService.createProfessional({
          ...formData,
          client_id: clientId,
          is_active: true
        });
        toast({
          title: "Sucesso",
          description: "Profissional criado com sucesso"
        });
      }
      
      resetForm();
      loadProfessionals();
    } catch (error) {
      console.error('Erro ao salvar profissional:', error);
      toast({
        title: "Erro",
        description: "Erro ao salvar profissional",
        variant: "destructive"
      });
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      email: '',
      phone: '',
      specialty: '',
      description: '',
      timezone: 'America/Sao_Paulo'
    });
    setEditingProfessional(null);
    setShowForm(false);
  };

  const handleEdit = (professional: ProfessionalWithServices) => {
    setFormData({
      name: professional.name,
      email: professional.email || '',
      phone: professional.phone || '',
      specialty: professional.specialty || '',
      description: professional.description || '',
      timezone: professional.timezone
    });
    setEditingProfessional(professional);
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este profissional?')) return;
    
    try {
      await professionalsService.deleteProfessional(id);
      toast({
        title: "Sucesso",
        description: "Profissional removido com sucesso"
      });
      loadProfessionals();
    } catch (error) {
      console.error('Erro ao deletar profissional:', error);
      toast({
        title: "Erro",
        description: "Erro ao remover profissional",
        variant: "destructive"
      });
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Profissionais</h2>
          <p className="text-muted-foreground">Gerencie os profissionais que prestam serviços</p>
        </div>
        <Button onClick={() => setShowForm(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Novo Profissional
        </Button>
      </div>

      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle>
              {editingProfessional ? 'Editar Profissional' : 'Novo Profissional'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="name">Nome *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="specialty">Especialidade</Label>
                  <Input
                    id="specialty"
                    value={formData.specialty}
                    onChange={(e) => setFormData({ ...formData, specialty: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="phone">Telefone</Label>
                  <Input
                    id="phone"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="description">Descrição</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={3}
                />
              </div>
              <div className="flex gap-2">
                <Button type="submit">
                  {editingProfessional ? 'Atualizar' : 'Criar'}
                </Button>
                <Button type="button" variant="outline" onClick={resetForm}>
                  Cancelar
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {professionals.map((professional) => (
          <Card key={professional.id}>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <User className="h-5 w-5" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">{professional.name}</CardTitle>
                    {professional.specialty && (
                      <CardDescription>{professional.specialty}</CardDescription>
                    )}
                  </div>
                </div>
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleEdit(professional)}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDelete(professional.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {professional.email && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Mail className="h-4 w-4" />
                    {professional.email}
                  </div>
                )}
                {professional.phone && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Phone className="h-4 w-4" />
                    {professional.phone}
                  </div>
                )}
                {professional.description && (
                  <p className="text-sm text-muted-foreground">
                    {professional.description}
                  </p>
                )}
                {professional.services.length > 0 && (
                  <div className="space-y-1">
                    <p className="text-sm font-medium">Serviços:</p>
                    <div className="flex flex-wrap gap-1">
                      {professional.services.map((service) => (
                        <Badge key={service.id} variant="secondary" className="text-xs">
                          {service.name}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {professionals.length === 0 && (
        <Card>
          <CardContent className="text-center py-8">
            <User className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">
              Nenhum profissional cadastrado ainda.
              <br />
              Clique em "Novo Profissional" para começar.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default ProfessionalsManager;
