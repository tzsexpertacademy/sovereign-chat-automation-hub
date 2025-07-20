import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Plus, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { plansService, type SubscriptionPlan, type CreatePlanData } from "@/services/plansService";

interface PlanModalProps {
  isOpen: boolean;
  onClose: (updated: boolean) => void;
  plan?: SubscriptionPlan | null;
}

const PlanModal = ({ isOpen, onClose, plan }: PlanModalProps) => {
  const [formData, setFormData] = useState<CreatePlanData>({
    name: "",
    slug: "",
    description: "",
    max_instances: 1,
    price_monthly: 0,
    price_yearly: 0,
    features: [],
    is_active: true,
    display_order: 0,
    color: "#3B82F6"
  });
  const [newFeature, setNewFeature] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (plan) {
      setFormData({
        name: plan.name,
        slug: plan.slug,
        description: plan.description || "",
        max_instances: plan.max_instances,
        price_monthly: plan.price_monthly,
        price_yearly: plan.price_yearly,
        features: [...plan.features],
        is_active: plan.is_active,
        display_order: plan.display_order,
        color: plan.color
      });
    } else {
      setFormData({
        name: "",
        slug: "",
        description: "",
        max_instances: 1,
        price_monthly: 0,
        price_yearly: 0,
        features: [],
        is_active: true,
        display_order: 0,
        color: "#3B82F6"
      });
    }
  }, [plan, isOpen]);

  const generateSlug = (name: string) => {
    return name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
  };

  const handleNameChange = (name: string) => {
    setFormData(prev => ({
      ...prev,
      name,
      slug: !plan ? generateSlug(name) : prev.slug
    }));
  };

  const addFeature = () => {
    if (newFeature.trim() && !formData.features.includes(newFeature.trim())) {
      setFormData(prev => ({
        ...prev,
        features: [...prev.features, newFeature.trim()]
      }));
      setNewFeature("");
    }
  };

  const removeFeature = (feature: string) => {
    setFormData(prev => ({
      ...prev,
      features: prev.features.filter(f => f !== feature)
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name.trim() || !formData.slug.trim()) {
      toast({
        title: "Erro",
        description: "Nome e slug são obrigatórios",
        variant: "destructive"
      });
      return;
    }

    if (formData.price_monthly < 0 || formData.price_yearly < 0) {
      toast({
        title: "Erro",
        description: "Preços não podem ser negativos",
        variant: "destructive"
      });
      return;
    }

    if (formData.max_instances < 1) {
      toast({
        title: "Erro",
        description: "Número de instâncias deve ser pelo menos 1",
        variant: "destructive"
      });
      return;
    }

    try {
      setIsLoading(true);
      
      if (plan) {
        await plansService.updatePlan(plan.id, formData);
        toast({
          title: "Sucesso",
          description: "Plano atualizado com sucesso"
        });
      } else {
        await plansService.createPlan(formData);
        toast({
          title: "Sucesso",
          description: "Plano criado com sucesso"
        });
      }
      
      onClose(true);
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message || "Falha ao salvar plano",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const predefinedColors = [
    "#10B981", // green
    "#3B82F6", // blue
    "#8B5CF6", // purple
    "#F59E0B", // yellow
    "#EF4444", // red
    "#06B6D4", // cyan
    "#EC4899", // pink
    "#84CC16"  // lime
  ];

  return (
    <Dialog open={isOpen} onOpenChange={() => onClose(false)}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {plan ? "Editar Plano" : "Criar Novo Plano"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Informações Básicas */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nome do Plano *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => handleNameChange(e.target.value)}
                placeholder="Ex: Plano Básico"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="slug">Slug *</Label>
              <Input
                id="slug"
                value={formData.slug}
                onChange={(e) => setFormData(prev => ({ ...prev, slug: e.target.value }))}
                placeholder="Ex: basic"
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Descrição</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Descrição do plano..."
              rows={3}
            />
          </div>

          {/* Configurações */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="max_instances">Máx. Instâncias *</Label>
              <Input
                id="max_instances"
                type="number"
                min="1"
                value={formData.max_instances}
                onChange={(e) => setFormData(prev => ({ ...prev, max_instances: parseInt(e.target.value) || 1 }))}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="price_monthly">Preço Mensal (R$)</Label>
              <Input
                id="price_monthly"
                type="number"
                step="0.01"
                min="0"
                value={formData.price_monthly}
                onChange={(e) => setFormData(prev => ({ ...prev, price_monthly: parseFloat(e.target.value) || 0 }))}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="price_yearly">Preço Anual (R$)</Label>
              <Input
                id="price_yearly"
                type="number"
                step="0.01"
                min="0"
                value={formData.price_yearly}
                onChange={(e) => setFormData(prev => ({ ...prev, price_yearly: parseFloat(e.target.value) || 0 }))}
              />
            </div>
          </div>

          {/* Cor */}
          <div className="space-y-2">
            <Label>Cor do Plano</Label>
            <div className="flex gap-2 flex-wrap">
              {predefinedColors.map((color) => (
                <button
                  key={color}
                  type="button"
                  className={`w-8 h-8 rounded border-2 ${
                    formData.color === color ? 'border-gray-800' : 'border-gray-300'
                  }`}
                  style={{ backgroundColor: color }}
                  onClick={() => setFormData(prev => ({ ...prev, color }))}
                />
              ))}
              <Input
                type="color"
                value={formData.color}
                onChange={(e) => setFormData(prev => ({ ...prev, color: e.target.value }))}
                className="w-16 h-8 rounded border"
              />
            </div>
          </div>

          {/* Features */}
          <div className="space-y-2">
            <Label>Recursos do Plano</Label>
            <div className="flex gap-2">
              <Input
                value={newFeature}
                onChange={(e) => setNewFeature(e.target.value)}
                placeholder="Digite um recurso..."
                onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addFeature())}
              />
              <Button type="button" onClick={addFeature} size="sm">
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex flex-wrap gap-2 mt-2">
              {formData.features.map((feature, index) => (
                <Badge key={index} variant="secondary" className="flex items-center gap-1">
                  {feature}
                  <button
                    type="button"
                    onClick={() => removeFeature(feature)}
                    className="ml-1 hover:text-red-500"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
          </div>

          {/* Configurações Avançadas */}
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex items-center space-x-2">
              <Switch
                id="is_active"
                checked={formData.is_active}
                onCheckedChange={(checked) => setFormData(prev => ({ ...prev, is_active: checked }))}
              />
              <Label htmlFor="is_active">Plano Ativo</Label>
            </div>

            <div className="space-y-2">
              <Label htmlFor="display_order">Ordem de Exibição</Label>
              <Input
                id="display_order"
                type="number"
                min="0"
                value={formData.display_order}
                onChange={(e) => setFormData(prev => ({ ...prev, display_order: parseInt(e.target.value) || 0 }))}
                className="w-24"
              />
            </div>
          </div>

          {/* Botões */}
          <div className="flex justify-end gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onClose(false)}
              disabled={isLoading}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? "Salvando..." : plan ? "Atualizar" : "Criar"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default PlanModal;