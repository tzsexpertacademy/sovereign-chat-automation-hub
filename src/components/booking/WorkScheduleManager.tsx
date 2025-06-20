
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Clock, Copy, Trash2, Plus, Save, AlertCircle, CheckCircle } from "lucide-react";
import { workScheduleService, WorkSchedule } from "@/services/workScheduleService";
import { professionalsService } from "@/services/professionalsService";

interface Professional {
  id: string;
  name: string;
  specialty?: string;
}

interface WorkScheduleManagerProps {
  clientId: string;
}

const DAYS_OF_WEEK = [
  { key: 'monday', label: 'Segunda-feira' },
  { key: 'tuesday', label: 'Terça-feira' },
  { key: 'wednesday', label: 'Quarta-feira' },
  { key: 'thursday', label: 'Quinta-feira' },
  { key: 'friday', label: 'Sexta-feira' },
  { key: 'saturday', label: 'Sábado' },
  { key: 'sunday', label: 'Domingo' }
];

const WorkScheduleManager: React.FC<WorkScheduleManagerProps> = ({ clientId }) => {
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [selectedProfessional, setSelectedProfessional] = useState<string>('');
  const [schedules, setSchedules] = useState<WorkSchedule[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  // Estado para formulário de horário individual
  const [editingSchedule, setEditingSchedule] = useState<{
    day: string;
    startTime: string;
    endTime: string;
    breakStartTime: string;
    breakEndTime: string;
    isActive: boolean;
  } | null>(null);

  // Estado para cópia de horários
  const [copySource, setCopySource] = useState<string>('');
  const [copyTargets, setCopyTargets] = useState<string[]>([]);

  useEffect(() => {
    loadProfessionals();
  }, [clientId]);

  useEffect(() => {
    if (selectedProfessional) {
      loadSchedules();
    }
  }, [selectedProfessional]);

  const loadProfessionals = async () => {
    try {
      const professionalsList = await professionalsService.getProfessionals(clientId);
      setProfessionals(professionalsList);
      if (professionalsList.length > 0) {
        setSelectedProfessional(professionalsList[0].id);
      }
    } catch (error) {
      toast({
        title: "Erro",
        description: "Falha ao carregar profissionais",
        variant: "destructive",
      });
    }
  };

  const loadSchedules = async () => {
    if (!selectedProfessional) return;

    try {
      setLoading(true);
      const professionalSchedules = await workScheduleService.getProfessionalSchedules(selectedProfessional);
      setSchedules(professionalSchedules);
    } catch (error) {
      toast({
        title: "Erro",
        description: "Falha ao carregar horários",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getScheduleForDay = (dayOfWeek: string) => {
    return schedules.find(s => s.day_of_week === dayOfWeek);
  };

  const handleEditSchedule = (dayOfWeek: string) => {
    const existingSchedule = getScheduleForDay(dayOfWeek);
    
    setEditingSchedule({
      day: dayOfWeek,
      startTime: existingSchedule?.start_time || '08:00',
      endTime: existingSchedule?.end_time || '18:00',
      breakStartTime: existingSchedule?.break_start_time || '',
      breakEndTime: existingSchedule?.break_end_time || '',
      isActive: existingSchedule?.is_active ?? true
    });
  };

  const handleSaveSchedule = async () => {
    if (!editingSchedule || !selectedProfessional) return;

    try {
      setSaving(true);

      const existingSchedule = getScheduleForDay(editingSchedule.day);
      
      const scheduleData = {
        professional_id: selectedProfessional,
        day_of_week: editingSchedule.day as any,
        start_time: editingSchedule.startTime,
        end_time: editingSchedule.endTime,
        break_start_time: editingSchedule.breakStartTime || null,
        break_end_time: editingSchedule.breakEndTime || null,
        is_active: editingSchedule.isActive
      };

      if (existingSchedule) {
        await workScheduleService.updateSchedule(existingSchedule.id, scheduleData);
      } else {
        await workScheduleService.createSchedule(scheduleData);
      }

      toast({
        title: "Sucesso",
        description: "Horário salvo com sucesso!",
      });

      setEditingSchedule(null);
      await loadSchedules();

    } catch (error) {
      toast({
        title: "Erro",
        description: "Falha ao salvar horário",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleCopySchedule = async () => {
    if (!copySource || copyTargets.length === 0 || !selectedProfessional) {
      toast({
        title: "Erro",
        description: "Selecione o dia de origem e pelo menos um dia de destino",
        variant: "destructive",
      });
      return;
    }

    try {
      setSaving(true);
      
      await workScheduleService.copyScheduleToOtherDays(
        selectedProfessional,
        copySource as any,
        copyTargets as any[]
      );

      toast({
        title: "Sucesso",
        description: `Horário copiado para ${copyTargets.length} dia(s)!`,
      });

      setCopySource('');
      setCopyTargets([]);
      await loadSchedules();

    } catch (error) {
      toast({
        title: "Erro",
        description: "Falha ao copiar horário",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteSchedule = async (scheduleId: string) => {
    try {
      await workScheduleService.deleteSchedule(scheduleId);
      
      toast({
        title: "Sucesso",
        description: "Horário removido com sucesso!",
      });

      await loadSchedules();

    } catch (error) {
      toast({
        title: "Erro",
        description: "Falha ao remover horário",
        variant: "destructive",
      });
    }
  };

  const toggleCopyTarget = (day: string) => {
    setCopyTargets(prev => 
      prev.includes(day) 
        ? prev.filter(d => d !== day)
        : [...prev, day]
    );
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="w-5 h-5" />
            Gerenciamento de Horários de Trabalho
          </CardTitle>
          <CardDescription>
            Configure os horários de trabalho dos profissionais para cada dia da semana
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Profissional</Label>
            <Select value={selectedProfessional} onValueChange={setSelectedProfessional}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione um profissional" />
              </SelectTrigger>
              <SelectContent>
                {professionals.map((prof) => (
                  <SelectItem key={prof.id} value={prof.id}>
                    {prof.name} {prof.specialty && `- ${prof.specialty}`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {selectedProfessional && (
        <Tabs defaultValue="schedule">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="schedule">Horários por Dia</TabsTrigger>
            <TabsTrigger value="copy">Copiar Horários</TabsTrigger>
          </TabsList>

          <TabsContent value="schedule" className="space-y-4">
            {DAYS_OF_WEEK.map((day) => {
              const schedule = getScheduleForDay(day.key);
              return (
                <Card key={day.key}>
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <h3 className="font-medium">{day.label}</h3>
                        {schedule && (
                          <div className="flex items-center gap-2">
                            <Badge variant={schedule.is_active ? "default" : "secondary"}>
                              {schedule.is_active ? "Ativo" : "Inativo"}
                            </Badge>
                            <span className="text-sm text-gray-600">
                              {schedule.start_time} - {schedule.end_time}
                            </span>
                            {schedule.break_start_time && schedule.break_end_time && (
                              <span className="text-sm text-gray-500">
                                (Intervalo: {schedule.break_start_time} - {schedule.break_end_time})
                              </span>
                            )}
                          </div>
                        )}
                        {!schedule && (
                          <Badge variant="outline">Não configurado</Badge>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEditSchedule(day.key)}
                        >
                          {schedule ? "Editar" : "Configurar"}
                        </Button>
                        {schedule && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDeleteSchedule(schedule.id)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </TabsContent>

          <TabsContent value="copy" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Copiar Horário Entre Dias</CardTitle>
                <CardDescription>
                  Selecione um dia de origem e os dias de destino para copiar o horário
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Dia de Origem</Label>
                  <Select value={copySource} onValueChange={setCopySource}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o dia para copiar" />
                    </SelectTrigger>
                    <SelectContent>
                      {DAYS_OF_WEEK.map((day) => {
                        const schedule = getScheduleForDay(day.key);
                        return (
                          <SelectItem key={day.key} value={day.key} disabled={!schedule}>
                            {day.label} {schedule ? `(${schedule.start_time} - ${schedule.end_time})` : '(não configurado)'}
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Dias de Destino</Label>
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    {DAYS_OF_WEEK.map((day) => (
                      <Button
                        key={day.key}
                        variant={copyTargets.includes(day.key) ? "default" : "outline"}
                        size="sm"
                        onClick={() => toggleCopyTarget(day.key)}
                        disabled={day.key === copySource}
                      >
                        {day.label}
                      </Button>
                    ))}
                  </div>
                </div>

                <Button 
                  onClick={handleCopySchedule}
                  disabled={!copySource || copyTargets.length === 0 || saving}
                  className="w-full"
                >
                  <Copy className="w-4 h-4 mr-2" />
                  {saving ? "Copiando..." : "Copiar Horário"}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}

      {/* Modal de Edição */}
      {editingSchedule && (
        <Card className="fixed inset-0 z-50 m-4 max-w-md mx-auto my-auto h-fit bg-white shadow-xl">
          <CardHeader>
            <CardTitle>
              Configurar Horário - {DAYS_OF_WEEK.find(d => d.key === editingSchedule.day)?.label}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Hora Início</Label>
                <Input
                  type="time"
                  value={editingSchedule.startTime}
                  onChange={(e) => setEditingSchedule(prev => 
                    prev ? { ...prev, startTime: e.target.value } : null
                  )}
                />
              </div>
              <div>
                <Label>Hora Fim</Label>
                <Input
                  type="time"
                  value={editingSchedule.endTime}
                  onChange={(e) => setEditingSchedule(prev => 
                    prev ? { ...prev, endTime: e.target.value } : null
                  )}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Intervalo Início (opcional)</Label>
                <Input
                  type="time"
                  value={editingSchedule.breakStartTime}
                  onChange={(e) => setEditingSchedule(prev => 
                    prev ? { ...prev, breakStartTime: e.target.value } : null
                  )}
                />
              </div>
              <div>
                <Label>Intervalo Fim (opcional)</Label>
                <Input
                  type="time"
                  value={editingSchedule.breakEndTime}
                  onChange={(e) => setEditingSchedule(prev => 
                    prev ? { ...prev, breakEndTime: e.target.value } : null
                  )}
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="isActive"
                checked={editingSchedule.isActive}
                onChange={(e) => setEditingSchedule(prev => 
                  prev ? { ...prev, isActive: e.target.checked } : null
                )}
              />
              <Label htmlFor="isActive">Dia ativo</Label>
            </div>

            <div className="flex gap-2">
              <Button 
                onClick={handleSaveSchedule}
                disabled={saving}
                className="flex-1"
              >
                <Save className="w-4 h-4 mr-2" />
                {saving ? "Salvando..." : "Salvar"}
              </Button>
              <Button 
                variant="outline" 
                onClick={() => setEditingSchedule(null)}
                disabled={saving}
              >
                Cancelar
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Overlay */}
      {editingSchedule && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-40"
          onClick={() => setEditingSchedule(null)}
        />
      )}
    </div>
  );
};

export default WorkScheduleManager;
