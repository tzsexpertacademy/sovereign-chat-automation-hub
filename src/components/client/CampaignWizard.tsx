import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { 
  ChevronLeft, 
  ChevronRight, 
  Check, 
  Users, 
  MessageSquare, 
  Calendar,
  Target,
  Eye,
  Send,
  Wand2,
  Clock,
  Settings,
  FileText,
  Bot
} from 'lucide-react';
import { campaignService, type CampaignTemplate, type CampaignSegment, type CampaignStep } from "@/services/campaignService";
import { queuesService, type QueueWithAssistant } from "@/services/queuesService";

interface CampaignWizardProps {
  clientId: string;
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const CampaignWizard: React.FC<CampaignWizardProps> = ({ clientId, open, onClose, onSuccess }) => {
  const [currentStep, setCurrentStep] = useState(1);
  const [templates, setTemplates] = useState<CampaignTemplate[]>([]);
  const [segments, setSegments] = useState<CampaignSegment[]>([]);
  const [queues, setQueues] = useState<QueueWithAssistant[]>([]);
  const [campaignData, setCampaignData] = useState({
    name: '',
    description: '',
    segment_id: '',
    template_id: '',
    custom_message: '',
    personalized_variables: {} as Record<string, string>,
    schedule_type: 'immediate',
    send_date: '',
    send_time: '',
    queue_id: '',
    target_filters: {},
    trigger_conditions: []
  });
  const [loading, setLoading] = useState(false);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const { toast } = useToast();

  const steps: CampaignStep[] = [
    {
      step: 1,
      title: "Informações Básicas",
      description: "Nome e descrição da campanha",
      completed: false
    },
    {
      step: 2,
      title: "Segmentação",
      description: "Selecione o público-alvo",
      completed: false
    },
    {
      step: 3,
      title: "Mensagem",
      description: "Defina o conteúdo da mensagem",
      completed: false
    },
    {
      step: 4,
      title: "Agendamento",
      description: "Configure quando enviar",
      completed: false
    },
    {
      step: 5,
      title: "Fila de Respostas",
      description: "Para onde vão as respostas",
      completed: false
    },
    {
      step: 6,
      title: "Revisão",
      description: "Confirme e envie",
      completed: false
    }
  ];

  useEffect(() => {
    if (open) {
      loadWizardData();
    }
  }, [open, clientId]);

  const loadWizardData = async () => {
    try {
      setLoading(true);
      const [templatesData, segmentsData, queuesData] = await Promise.all([
        campaignService.getTemplates(clientId),
        campaignService.getSegments(clientId),
        queuesService.getClientQueues(clientId)
      ]);

      setTemplates(templatesData);
      setSegments(segmentsData);
      setQueues(queuesData);
    } catch (error) {
      console.error('Erro ao carregar dados do wizard:', error);
      toast({
        title: "Erro",
        description: "Erro ao carregar dados do wizard",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const validateStep = async (step: number) => {
    const validation = await campaignService.validateCampaignStep(step, campaignData);
    setValidationErrors(validation.errors);
    return validation.valid;
  };

  const nextStep = async () => {
    const isValid = await validateStep(currentStep);
    if (isValid && currentStep < steps.length) {
      setCurrentStep(currentStep + 1);
      setValidationErrors([]);
    }
  };

  const prevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
      setValidationErrors([]);
    }
  };

  const updateCampaignData = (field: string, value: any) => {
    setCampaignData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleTemplateSelect = (templateId: string) => {
    const template = templates.find(t => t.id === templateId);
    if (template) {
      updateCampaignData('template_id', templateId);
      updateCampaignData('custom_message', template.content);
    }
  };

  const getSelectedSegment = () => {
    return segments.find(s => s.id === campaignData.segment_id);
  };

  const getSelectedTemplate = () => {
    return templates.find(t => t.id === campaignData.template_id);
  };

  const previewMessage = () => {
    let message = campaignData.custom_message;
    const template = getSelectedTemplate();
    
    if (template) {
      template.variables.forEach(variable => {
        const value = campaignData.personalized_variables[variable] || `[${variable}]`;
        message = message.replace(new RegExp(`\\{\\{${variable}\\}\\}`, 'g'), value);
      });
    }
    
    return message;
  };

  const createCampaign = async () => {
    try {
      setLoading(true);
      
      const campaign = await campaignService.createCampaign({
        client_id: clientId,
        name: campaignData.name,
        description: campaignData.description,
        message_template: campaignData.custom_message,
        queue_id: campaignData.queue_id,
        target_filters: campaignData.target_filters,
        trigger_conditions: campaignData.trigger_conditions,
        schedule_config: {
          type: campaignData.schedule_type,
          send_date: campaignData.send_date,
          send_time: campaignData.send_time
        },
        is_active: true
      });

      toast({
        title: "Sucesso!",
        description: "Campanha criada com sucesso",
      });

      onSuccess();
      onClose();
    } catch (error) {
      console.error('Erro ao criar campanha:', error);
      toast({
        title: "Erro",
        description: "Erro ao criar campanha",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="space-y-4">
            <div>
              <Label htmlFor="name">Nome da Campanha *</Label>
              <Input
                id="name"
                value={campaignData.name}
                onChange={(e) => updateCampaignData('name', e.target.value)}
                placeholder="Ex: Campanha de Boas-vindas"
              />
            </div>
            <div>
              <Label htmlFor="description">Descrição *</Label>
              <Textarea
                id="description"
                value={campaignData.description}
                onChange={(e) => updateCampaignData('description', e.target.value)}
                placeholder="Descreva o objetivo desta campanha..."
                rows={3}
              />
            </div>
          </div>
        );

      case 2:
        return (
          <div className="space-y-4">
            <div>
              <Label>Selecione o Segmento de Público</Label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                {segments.map(segment => (
                  <Card 
                    key={segment.id}
                    className={`cursor-pointer border-2 ${
                      campaignData.segment_id === segment.id 
                        ? 'border-primary bg-primary/5' 
                        : 'border-muted hover:border-primary/50'
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
                      {segment.filters.tags && segment.filters.tags.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {segment.filters.tags.slice(0, 3).map(tag => (
                            <Badge key={tag} variant="outline" className="text-xs">
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          </div>
        );

      case 3:
        return (
          <div className="space-y-4">
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
                      className={`cursor-pointer border-2 ${
                        campaignData.template_id === template.id 
                          ? 'border-primary bg-primary/5' 
                          : 'border-muted hover:border-primary/50'
                      }`}
                      onClick={() => handleTemplateSelect(template.id)}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <FileText className="h-4 w-4" />
                          <h4 className="font-medium">{template.name}</h4>
                        </div>
                        <p className="text-sm text-muted-foreground line-clamp-3">
                          {template.content}
                        </p>
                        {template.variables.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1">
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

                {getSelectedTemplate() && (
                  <div className="space-y-3">
                    <Label>Personalizar Variáveis</Label>
                    {getSelectedTemplate()?.variables.map(variable => (
                      <div key={variable}>
                        <Label htmlFor={variable} className="text-sm">
                          {`{{${variable}}}`}
                        </Label>
                        <Input
                          id={variable}
                          value={campaignData.personalized_variables[variable] || ''}
                          onChange={(e) => updateCampaignData('personalized_variables', {
                            ...campaignData.personalized_variables,
                            [variable]: e.target.value
                          })}
                          placeholder={`Valor para ${variable}`}
                        />
                      </div>
                    ))}
                  </div>
                )}
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
          <div className="space-y-4">
            <div>
              <Label>Quando enviar?</Label>
              <RadioGroup
                value={campaignData.schedule_type}
                onValueChange={(value) => updateCampaignData('schedule_type', value)}
                className="mt-2"
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
                    <Calendar className="h-4 w-4" />
                    Agendar Envio
                  </Label>
                </div>
              </RadioGroup>
            </div>

            {campaignData.schedule_type === 'scheduled' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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

            <Card className="bg-blue-50 border-blue-200">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Clock className="h-4 w-4 text-blue-600" />
                  <h4 className="font-medium text-blue-900">Dicas de Agendamento</h4>
                </div>
                <ul className="text-sm text-blue-800 space-y-1">
                  <li>• Envie em horário comercial (9h às 18h)</li>
                  <li>• Evite finais de semana e feriados</li>
                  <li>• Considere o fuso horário dos destinatários</li>
                  <li>• Teste em pequenos grupos primeiro</li>
                </ul>
              </CardContent>
            </Card>
          </div>
        );

      case 5:
        return (
          <div className="space-y-4">
            <div>
              <Label>Fila de Destino para Respostas</Label>
              <p className="text-sm text-muted-foreground mb-3">
                Quando alguém responder à campanha, para qual fila o ticket será direcionado?
              </p>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {queues.map(queue => (
                  <Card 
                    key={queue.id}
                    className={`cursor-pointer border-2 ${
                      campaignData.queue_id === queue.id 
                        ? 'border-primary bg-primary/5' 
                        : 'border-muted hover:border-primary/50'
                    }`}
                    onClick={() => updateCampaignData('queue_id', queue.id)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <div className={`w-3 h-3 rounded-full ${queue.is_active ? 'bg-green-500' : 'bg-gray-500'}`} />
                        <h4 className="font-medium">{queue.name}</h4>
                      </div>
                      
                      {queue.assistants && (
                        <div className="flex items-center gap-1 text-sm text-muted-foreground">
                          <Bot className="h-3 w-3" />
                          {queue.assistants.name}
                        </div>
                      )}
                      
                      <p className="text-sm text-muted-foreground mt-1">
                        {queue.description || "Sem descrição"}
                      </p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          </div>
        );

      case 6:
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold mb-4">Revisão da Campanha</h3>
              
              <div className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Informações Básicas</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2 text-sm">
                      <div><span className="font-medium">Nome:</span> {campaignData.name}</div>
                      <div><span className="font-medium">Descrição:</span> {campaignData.description}</div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Público-Alvo</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-sm">
                      <span className="font-medium">Segmento:</span> {getSelectedSegment()?.name}
                      <div className="text-muted-foreground">
                        {getSelectedSegment()?.contact_count} contatos
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Mensagem</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="bg-muted p-3 rounded-md text-sm whitespace-pre-wrap max-h-32 overflow-y-auto">
                      {previewMessage()}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Agendamento</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-sm">
                      {campaignData.schedule_type === 'immediate' ? (
                        <span>Envio imediato</span>
                      ) : (
                        <span>Agendado para {campaignData.send_date} às {campaignData.send_time}</span>
                      )}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Fila de Respostas</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-sm">
                      {queues.find(q => q.id === campaignData.queue_id)?.name}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wand2 className="h-5 w-5" />
            Criar Nova Campanha
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Progress Steps */}
          <div className="flex items-center justify-between">
            {steps.map((step, index) => (
              <div key={step.step} className="flex items-center">
                <div className={`
                  w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium
                  ${currentStep === step.step 
                    ? 'bg-primary text-primary-foreground' 
                    : currentStep > step.step 
                      ? 'bg-green-500 text-white' 
                      : 'bg-muted text-muted-foreground'
                  }
                `}>
                  {currentStep > step.step ? <Check className="h-4 w-4" /> : step.step}
                </div>
                {index < steps.length - 1 && (
                  <div className={`w-12 h-px ml-2 ${
                    currentStep > step.step ? 'bg-green-500' : 'bg-muted'
                  }`} />
                )}
              </div>
            ))}
          </div>

          {/* Current Step Info */}
          <div className="text-center">
            <h3 className="text-lg font-semibold">{steps[currentStep - 1]?.title}</h3>
            <p className="text-muted-foreground">{steps[currentStep - 1]?.description}</p>
          </div>

          {/* Validation Errors */}
          {validationErrors.length > 0 && (
            <Card className="border-red-200 bg-red-50">
              <CardContent className="p-4">
                <div className="space-y-1">
                  {validationErrors.map((error, index) => (
                    <p key={index} className="text-sm text-red-600">• {error}</p>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Step Content */}
          <div className="min-h-[400px]">
            {renderStep()}
          </div>

          {/* Navigation */}
          <div className="flex justify-between">
            <Button
              variant="outline"
              onClick={prevStep}
              disabled={currentStep === 1}
            >
              <ChevronLeft className="h-4 w-4 mr-2" />
              Anterior
            </Button>

            {currentStep < steps.length ? (
              <Button onClick={nextStep}>
                Próximo
                <ChevronRight className="h-4 w-4 ml-2" />
              </Button>
            ) : (
              <Button onClick={createCampaign} disabled={loading}>
                {loading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                    Criando...
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4 mr-2" />
                    Criar Campanha
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default CampaignWizard;