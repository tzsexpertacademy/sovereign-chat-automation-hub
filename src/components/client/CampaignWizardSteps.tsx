import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import { 
  Upload, 
  FileText, 
  Users, 
  Target, 
  Filter,
  Calendar,
  Send,
  Eye,
  AlertCircle,
  CheckCircle,
  Clock,
  Settings,
  Bot
} from 'lucide-react';
import type { CampaignTemplate, CampaignSegment } from "@/services/campaignService";
import type { QueueWithAssistant } from "@/services/queuesService";
import type { FunnelStage, FunnelTag } from "@/services/funnelService";

interface CampaignWizardStepsProps {
  currentStep: number;
  campaignData: any;
  templates: CampaignTemplate[];
  segments: CampaignSegment[];
  queues: QueueWithAssistant[];
  stages: FunnelStage[];
  tags: FunnelTag[];
  estimatedContacts: number;
  updateCampaignData: (field: string, value: any) => void;
  handleTemplateSelect: (templateId: string) => void;
  previewMessage: () => string;
  onContactUpload: (contacts: any[]) => void;
}

export const CampaignWizardSteps: React.FC<CampaignWizardStepsProps> = ({
  currentStep,
  campaignData,
  templates,
  segments,
  queues,
  stages,
  tags,
  estimatedContacts,
  updateCampaignData,
  handleTemplateSelect,
  previewMessage,
  onContactUpload
}) => {

  const handleFilterChange = (filterType: string, value: string, checked: boolean) => {
    const currentFilters = campaignData.target_filters[filterType] || [];
    const newFilters = checked
      ? [...currentFilters, value]
      : currentFilters.filter((f: string) => f !== value);
    
    updateCampaignData('target_filters', {
      ...campaignData.target_filters,
      [filterType]: newFilters
    });
  };

  const getTotalSelectedFilters = () => {
    const filters = campaignData.target_filters;
    return (filters.stages?.length || 0) + 
           (filters.tags?.length || 0) + 
           (filters.queues?.length || 0) + 
           (filters.lead_sources?.length || 0);
  };

  switch (currentStep) {
    case 1:
      return (
        <div className="space-y-6">
          {/* Informações Básicas */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="w-5 h-5" />
                Informações da Campanha
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="name">Nome da Campanha *</Label>
                <Input
                  id="name"
                  value={campaignData.name}
                  onChange={(e) => updateCampaignData('name', e.target.value)}
                  placeholder="Ex: Campanha de Follow-up - Janeiro 2024"
                />
              </div>
              <div>
                <Label htmlFor="description">Descrição *</Label>
                <Textarea
                  id="description"
                  value={campaignData.description}
                  onChange={(e) => updateCampaignData('description', e.target.value)}
                  placeholder="Descreva o objetivo e estratégia desta campanha..."
                  rows={3}
                />
              </div>
            </CardContent>
          </Card>

          {/* Tipo de Segmentação */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="w-5 h-5" />
                Fonte dos Contatos
              </CardTitle>
            </CardHeader>
            <CardContent>
              <RadioGroup
                value={campaignData.segment_type}
                onValueChange={(value) => updateCampaignData('segment_type', value)}
                className="space-y-4"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="existing" id="existing" />
                  <Label htmlFor="existing" className="flex-1">
                    <div className="flex items-center gap-3">
                      <Target className="w-5 h-5 text-primary" />
                      <div>
                        <p className="font-medium">Usar Segmentação Inteligente</p>
                        <p className="text-sm text-muted-foreground">
                          Selecionar contatos por tags, estágios, filas e outros filtros
                        </p>
                      </div>
                    </div>
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="upload" id="upload" />
                  <Label htmlFor="upload" className="flex-1">
                    <div className="flex items-center gap-3">
                      <Upload className="w-5 h-5 text-secondary" />
                      <div>
                        <p className="font-medium">Importar Lista de Contatos</p>
                        <p className="text-sm text-muted-foreground">
                          Fazer upload de arquivo CSV/Excel com contatos específicos
                        </p>
                      </div>
                    </div>
                  </Label>
                </div>
              </RadioGroup>

              {campaignData.segment_type === 'upload' && (
                <div className="mt-4 p-4 border border-dashed rounded-lg">
                  <div className="text-center">
                    <Upload className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">
                      Funcionalidade de upload será implementada aqui
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      );

    case 2:
      return (
        <div className="space-y-6">
          <Alert>
            <Filter className="h-4 w-4" />
            <AlertDescription>
              Selecione os filtros para segmentar seu público. Quanto mais específico, melhor a personalização.
            </AlertDescription>
          </Alert>

          {/* Filtros por Estágios */}
          {stages.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="w-5 h-5" />
                  Estágios do Funil
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {stages.map(stage => (
                    <div key={stage.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={`stage-${stage.id}`}
                        checked={campaignData.target_filters.stages?.includes(stage.id)}
                        onCheckedChange={(checked) => 
                          handleFilterChange('stages', stage.id, !!checked)
                        }
                      />
                      <Label htmlFor={`stage-${stage.id}`} className="flex items-center gap-2">
                        <div 
                          className="w-3 h-3 rounded-full" 
                          style={{ backgroundColor: stage.color }}
                        />
                        {stage.name}
                      </Label>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Filtros por Tags */}
          {tags.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Badge className="w-5 h-5" />
                  Tags
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {tags.map(tag => (
                    <div key={tag.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={`tag-${tag.id}`}
                        checked={campaignData.target_filters.tags?.includes(tag.id)}
                        onCheckedChange={(checked) => 
                          handleFilterChange('tags', tag.id, !!checked)
                        }
                      />
                      <Label htmlFor={`tag-${tag.id}`} className="flex items-center gap-2">
                        <div 
                          className="w-3 h-3 rounded-full" 
                          style={{ backgroundColor: tag.color }}
                        />
                        {tag.name}
                      </Label>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Filtros por Filas */}
          {queues.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="w-5 h-5" />
                  Filas
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {queues.map(queue => (
                    <div key={queue.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={`queue-${queue.id}`}
                        checked={campaignData.target_filters.queues?.includes(queue.id)}
                        onCheckedChange={(checked) => 
                          handleFilterChange('queues', queue.id, !!checked)
                        }
                      />
                      <Label htmlFor={`queue-${queue.id}`} className="flex items-center gap-2">
                        <div className={`w-3 h-3 rounded-full ${queue.is_active ? 'bg-green-500' : 'bg-gray-500'}`} />
                        {queue.name}
                      </Label>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Segmentos Predefinidos */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Filter className="w-5 h-5" />
                Segmentos Predefinidos
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {segments.map(segment => (
                  <Card 
                    key={segment.id}
                    className={`cursor-pointer border-2 transition-all ${
                      campaignData.segment_id === segment.id 
                        ? 'border-primary bg-primary/5' 
                        : 'border-border hover:border-primary/50'
                    }`}
                    onClick={() => updateCampaignData('segment_id', segment.id)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-medium">{segment.name}</h4>
                        <Badge variant="secondary">{segment.contact_count}</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {segment.contact_count} contatos
                      </p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Resumo de Filtros */}
          {getTotalSelectedFilters() > 0 && (
            <Card className="bg-primary/5 border-primary/20">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle className="w-5 h-5 text-primary" />
                  <span className="font-medium">Filtros Aplicados</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  {getTotalSelectedFilters()} filtros selecionados • 
                  Estimativa: {estimatedContacts} contatos
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      );

    case 3:
      return (
        <div className="space-y-6">
          <Tabs defaultValue="templates">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="templates">Templates</TabsTrigger>
              <TabsTrigger value="custom">Personalizada</TabsTrigger>
            </TabsList>
            
            <TabsContent value="templates" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {templates.map(template => (
                  <Card 
                    key={template.id}
                    className={`cursor-pointer border-2 transition-all ${
                      campaignData.template_id === template.id 
                        ? 'border-primary bg-primary/5' 
                        : 'border-border hover:border-primary/50'
                    }`}
                    onClick={() => handleTemplateSelect(template.id)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <FileText className="h-4 w-4" />
                        <h4 className="font-medium">{template.name}</h4>
                      </div>
                      <p className="text-sm text-muted-foreground line-clamp-3 mb-3">
                        {template.content}
                      </p>
                      {template.variables.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {template.variables.map(variable => (
                            <Badge key={variable} variant="outline" className="text-xs">
                              {`{{${variable}}}`}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>
            
            <TabsContent value="custom" className="space-y-4">
              <div>
                <Label htmlFor="custom_message">Mensagem Personalizada</Label>
                <Textarea
                  id="custom_message"
                  value={campaignData.custom_message}
                  onChange={(e) => updateCampaignData('custom_message', e.target.value)}
                  placeholder="Digite sua mensagem aqui..."
                  rows={6}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Use {`{{variavel}}`} para personalização automática
                </p>
              </div>
            </TabsContent>
          </Tabs>

          {/* Preview */}
          {campaignData.custom_message && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-sm">
                  <Eye className="h-4 w-4" />
                  Pré-visualização
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="bg-muted p-3 rounded-md whitespace-pre-wrap text-sm">
                  {previewMessage()}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      );

    case 4:
      return (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="w-5 h-5" />
                Agendamento de Envio
              </CardTitle>
            </CardHeader>
            <CardContent>
              <RadioGroup
                value={campaignData.schedule_type}
                onValueChange={(value) => updateCampaignData('schedule_type', value)}
                className="space-y-4"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="immediate" id="immediate" />
                  <Label htmlFor="immediate" className="flex items-center gap-2">
                    <Send className="h-4 w-4" />
                    Enviar Imediatamente
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="scheduled" id="scheduled" />
                  <Label htmlFor="scheduled" className="flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    Agendar Envio
                  </Label>
                </div>
              </RadioGroup>

              {campaignData.schedule_type === 'scheduled' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                  <div>
                    <Label htmlFor="send_date">Data de Envio</Label>
                    <Input
                      id="send_date"
                      type="date"
                      value={campaignData.send_date}
                      onChange={(e) => updateCampaignData('send_date', e.target.value)}
                      min={new Date().toISOString().split('T')[0]}
                    />
                  </div>
                  <div>
                    <Label htmlFor="send_time">Horário</Label>
                    <Input
                      id="send_time"
                      type="time"
                      value={campaignData.send_time}
                      onChange={(e) => updateCampaignData('send_time', e.target.value)}
                    />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Alert>
            <Clock className="h-4 w-4" />
            <AlertDescription>
              <strong>Dicas de Agendamento:</strong> Envie em horário comercial (9h às 18h), 
              evite finais de semana e considere o fuso horário dos destinatários.
            </AlertDescription>
          </Alert>
        </div>
      );

    case 5:
      return (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bot className="w-5 h-5" />
                Fila de Destino para Respostas
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                Quando alguém responder à campanha, para qual fila o ticket será direcionado?
              </p>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {queues.map(queue => (
                  <Card 
                    key={queue.id}
                    className={`cursor-pointer border-2 transition-all ${
                      campaignData.queue_id === queue.id 
                        ? 'border-primary bg-primary/5' 
                        : 'border-border hover:border-primary/50'
                    }`}
                    onClick={() => updateCampaignData('queue_id', queue.id)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <div className={`w-3 h-3 rounded-full ${queue.is_active ? 'bg-green-500' : 'bg-gray-500'}`} />
                        <h4 className="font-medium">{queue.name}</h4>
                      </div>
                      <p className="text-sm text-muted-foreground mb-2">
                        {queue.description || 'Sem descrição'}
                      </p>
                      {queue.assistants && (
                        <Badge variant="outline" className="text-xs">
                          Assistente: {queue.assistants.name}
                        </Badge>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      );

    case 6:
      return (
        <div className="space-y-6">
          <Alert>
            <CheckCircle className="h-4 w-4" />
            <AlertDescription>
              Revise todas as configurações antes de executar a campanha.
            </AlertDescription>
          </Alert>

          {/* Resumo da Campanha */}
          <Card>
            <CardHeader>
              <CardTitle>Resumo da Campanha</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label className="text-sm font-medium">Nome</Label>
                <p className="text-sm text-muted-foreground">{campaignData.name}</p>
              </div>
              <div>
                <Label className="text-sm font-medium">Descrição</Label>
                <p className="text-sm text-muted-foreground">{campaignData.description}</p>
              </div>
              <div>
                <Label className="text-sm font-medium">Filtros Aplicados</Label>
                <p className="text-sm text-muted-foreground">
                  {getTotalSelectedFilters()} filtros • Estimativa: {estimatedContacts} contatos
                </p>
              </div>
              <div>
                <Label className="text-sm font-medium">Agendamento</Label>
                <p className="text-sm text-muted-foreground">
                  {campaignData.schedule_type === 'immediate' ? 'Envio imediato' : 
                   `Agendado para ${campaignData.send_date} às ${campaignData.send_time}`}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Preview Final */}
          {campaignData.custom_message && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Eye className="h-4 w-4" />
                  Preview da Mensagem
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="bg-muted p-4 rounded-md whitespace-pre-wrap text-sm">
                  {previewMessage()}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      );

    default:
      return null;
  }
};

export default CampaignWizardSteps;