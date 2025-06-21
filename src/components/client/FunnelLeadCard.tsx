
import React, { useState } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { funnelService, type FunnelLead, type FunnelTag } from "@/services/funnelService";
import { 
  Phone, 
  Mail, 
  Calendar, 
  DollarSign, 
  MoreVertical,
  Edit,
  Tag,
  Clock,
  TrendingUp,
  AlertCircle
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface FunnelLeadCardProps {
  lead: FunnelLead;
  tags: FunnelTag[];
  onUpdate: () => void;
  clientId: string;
}

const FunnelLeadCard: React.FC<FunnelLeadCardProps> = ({ 
  lead, 
  tags, 
  onUpdate, 
  clientId 
}) => {
  const [showDetails, setShowDetails] = useState(false);
  const [editing, setEditing] = useState(false);
  const [formData, setFormData] = useState({
    customer_name: lead.customer_name || '',
    customer_phone: lead.customer_phone || '',
    customer_email: lead.customer_email || '',
    lead_value: lead.lead_value || 0,
    priority: lead.priority || 1,
    conversion_probability: lead.conversion_probability || 0,
    notes: Array.isArray(lead.notes) ? lead.notes.join('\n') : ''
  });
  const { toast } = useToast();

  const getPriorityColor = (priority: number) => {
    switch (priority) {
      case 4: return 'bg-red-500';
      case 3: return 'bg-orange-500';
      case 2: return 'bg-yellow-500';
      case 1: return 'bg-green-500';
      default: return 'bg-gray-500';
    }
  };

  const getPriorityLabel = (priority: number) => {
    switch (priority) {
      case 4: return 'Urgente';
      case 3: return 'Alta';
      case 2: return 'Média';
      case 1: return 'Baixa';
      default: return 'Normal';
    }
  };

  const handleSave = async () => {
    try {
      await funnelService.updateLead(lead.id, {
        customer_name: formData.customer_name,
        customer_phone: formData.customer_phone,
        customer_email: formData.customer_email,
        lead_value: formData.lead_value,
        priority: formData.priority,
        conversion_probability: formData.conversion_probability,
        notes: formData.notes ? formData.notes.split('\n').filter(note => note.trim()) : []
      });

      toast({
        title: "Sucesso",
        description: "Lead atualizado com sucesso!",
      });

      setEditing(false);
      onUpdate();
    } catch (error) {
      console.error('Error updating lead:', error);
      toast({
        title: "Erro",
        description: "Erro ao atualizar lead",
        variant: "destructive"
      });
    }
  };

  const handleTagToggle = async (tagId: string) => {
    try {
      const hasTag = lead.tags?.some(tag => tag.id === tagId);
      
      if (hasTag) {
        await funnelService.removeTagFromLead(lead.id, tagId);
      } else {
        await funnelService.assignTagToLead(lead.id, tagId);
      }

      onUpdate();
    } catch (error) {
      console.error('Error toggling tag:', error);
      toast({
        title: "Erro",
        description: "Erro ao atualizar tags",
        variant: "destructive"
      });
    }
  };

  const getInitials = (name?: string) => {
    if (!name) return 'L';
    return name.split(' ').map(part => part[0]).join('').slice(0, 2).toUpperCase();
  };

  return (
    <>
      <Card 
        className="cursor-pointer hover:shadow-md transition-shadow border-l-4"
        style={{ borderLeftColor: lead.current_stage?.color || '#3B82F6' }}
        onClick={() => setShowDetails(true)}
      >
        <CardContent className="p-4">
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-2">
              <Avatar className="h-8 w-8">
                <AvatarFallback className="text-xs">
                  {getInitials(lead.customer_name)}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="font-medium text-sm">
                  {lead.customer_name || 'Lead sem nome'}
                </p>
                <p className="text-xs text-muted-foreground">
                  {lead.customer_phone}
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-1">
              <div 
                className={`w-2 h-2 rounded-full ${getPriorityColor(lead.priority)}`}
                title={getPriorityLabel(lead.priority)}
              />
              <Button 
                variant="ghost" 
                size="sm" 
                className="h-6 w-6 p-0"
                onClick={(e) => {
                  e.stopPropagation();
                  setEditing(true);
                  setShowDetails(true);
                }}
              >
                <MoreVertical className="h-3 w-3" />
              </Button>
            </div>
          </div>

          {lead.lead_value > 0 && (
            <div className="flex items-center gap-1 mb-2">
              <DollarSign className="h-3 w-3 text-green-600" />
              <span className="text-sm font-medium text-green-600">
                R$ {lead.lead_value.toLocaleString('pt-BR')}
              </span>
            </div>
          )}

          {lead.conversion_probability > 0 && (
            <div className="flex items-center gap-1 mb-2">
              <TrendingUp className="h-3 w-3 text-blue-600" />
              <span className="text-xs text-blue-600">
                {lead.conversion_probability}% chance
              </span>
            </div>
          )}

          <div className="flex flex-wrap gap-1 mb-3">
            {lead.tags?.slice(0, 2).map(tag => (
              <Badge 
                key={tag.id} 
                variant="secondary" 
                className="text-xs px-2 py-0"
                style={{ backgroundColor: tag.color + '20', color: tag.color }}
              >
                {tag.name}
              </Badge>
            ))}
            {(lead.tags?.length || 0) > 2 && (
              <Badge variant="outline" className="text-xs px-2 py-0">
                +{(lead.tags?.length || 0) - 2}
              </Badge>
            )}
          </div>

          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" />
            {format(new Date(lead.last_interaction), 'dd/MM HH:mm', { locale: ptBR })}
          </div>
        </CardContent>
      </Card>

      {/* Modal de detalhes */}
      <Dialog open={showDetails} onOpenChange={setShowDetails}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Avatar>
                <AvatarFallback>
                  {getInitials(lead.customer_name)}
                </AvatarFallback>
              </Avatar>
              {editing ? 'Editar Lead' : (lead.customer_name || 'Detalhes do Lead')}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-6">
            {editing ? (
              // Formulário de edição
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="customer_name">Nome</Label>
                    <Input
                      id="customer_name"
                      value={formData.customer_name}
                      onChange={(e) => setFormData(prev => ({ 
                        ...prev, 
                        customer_name: e.target.value 
                      }))}
                    />
                  </div>
                  <div>
                    <Label htmlFor="customer_phone">Telefone</Label>
                    <Input
                      id="customer_phone"
                      value={formData.customer_phone}
                      onChange={(e) => setFormData(prev => ({ 
                        ...prev, 
                        customer_phone: e.target.value 
                      }))}
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="customer_email">Email</Label>
                  <Input
                    id="customer_email"
                    type="email"
                    value={formData.customer_email}
                    onChange={(e) => setFormData(prev => ({ 
                      ...prev, 
                      customer_email: e.target.value 
                    }))}
                  />
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <Label htmlFor="lead_value">Valor (R$)</Label>
                    <Input
                      id="lead_value"
                      type="number"
                      value={formData.lead_value}
                      onChange={(e) => setFormData(prev => ({ 
                        ...prev, 
                        lead_value: parseFloat(e.target.value) || 0 
                      }))}
                    />
                  </div>
                  <div>
                    <Label htmlFor="priority">Prioridade</Label>
                    <Select
                      value={formData.priority.toString()}
                      onValueChange={(value) => setFormData(prev => ({ 
                        ...prev, 
                        priority: parseInt(value) 
                      }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1">Baixa</SelectItem>
                        <SelectItem value="2">Média</SelectItem>
                        <SelectItem value="3">Alta</SelectItem>
                        <SelectItem value="4">Urgente</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="conversion_probability">Conversão (%)</Label>
                    <Input
                      id="conversion_probability"
                      type="number"
                      min="0"
                      max="100"
                      value={formData.conversion_probability}
                      onChange={(e) => setFormData(prev => ({ 
                        ...prev, 
                        conversion_probability: parseInt(e.target.value) || 0 
                      }))}
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="notes">Notas</Label>
                  <Textarea
                    id="notes"
                    value={formData.notes}
                    onChange={(e) => setFormData(prev => ({ 
                      ...prev, 
                      notes: e.target.value 
                    }))}
                    placeholder="Uma nota por linha..."
                    rows={3}
                  />
                </div>

                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setEditing(false)}>
                    Cancelar
                  </Button>
                  <Button onClick={handleSave}>
                    Salvar
                  </Button>
                </div>
              </div>
            ) : (
              // Visualização
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Contato</Label>
                    <div className="space-y-1">
                      {lead.customer_phone && (
                        <div className="flex items-center gap-2">
                          <Phone className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm">{lead.customer_phone}</span>
                        </div>
                      )}
                      {lead.customer_email && (
                        <div className="flex items-center gap-2">
                          <Mail className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm">{lead.customer_email}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Informações</Label>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <DollarSign className="h-4 w-4 text-green-600" />
                        <span className="text-sm">R$ {lead.lead_value.toLocaleString('pt-BR')}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <TrendingUp className="h-4 w-4 text-blue-600" />
                        <span className="text-sm">{lead.conversion_probability}% chance</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <AlertCircle className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">{getPriorityLabel(lead.priority)}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Tags */}
                <div>
                  <Label className="text-sm font-medium mb-2 block">Tags</Label>
                  <div className="flex flex-wrap gap-2">
                    {tags.map(tag => {
                      const isAssigned = lead.tags?.some(leadTag => leadTag.id === tag.id);
                      return (
                        <Badge
                          key={tag.id}
                          variant={isAssigned ? "default" : "outline"}
                          className="cursor-pointer"
                          style={{ 
                            backgroundColor: isAssigned ? tag.color : undefined,
                            borderColor: tag.color 
                          }}
                          onClick={() => handleTagToggle(tag.id)}
                        >
                          {tag.name}
                        </Badge>
                      );
                    })}
                  </div>
                </div>

                {/* Notas */}
                {lead.notes && Array.isArray(lead.notes) && lead.notes.length > 0 && (
                  <div>
                    <Label className="text-sm font-medium mb-2 block">Notas</Label>
                    <div className="bg-muted p-3 rounded-md">
                      {lead.notes.map((note, index) => (
                        <p key={index} className="text-sm mb-1 last:mb-0">
                          • {note}
                        </p>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex justify-end">
                  <Button onClick={() => setEditing(true)}>
                    <Edit className="h-4 w-4 mr-2" />
                    Editar
                  </Button>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default FunnelLeadCard;
