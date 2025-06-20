
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Clock, Save, Plus, Trash2 } from "lucide-react";
import { professionalsService, type Professional } from "@/services/professionalsService";
import { workScheduleService, type WorkSchedule } from "@/services/workScheduleService";

interface WorkScheduleManagerProps {
  clientId: string;
}

const daysOfWeek = [
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
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

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
      setLoading(true);
      const data = await professionalsService.getClientProfessionals(clientId);
      setProfessionals(data);
      if (data.length > 0 && !selectedProfessional) {
        setSelectedProfessional(data[0].id);
      }
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

  const loadSchedules = async () => {
    try {
      const data = await workScheduleService.getProfessionalSchedules(selectedProfessional);
      setSchedules(data);
    } catch (error) {
      console.error('Erro ao carregar horários:', error);
      toast({
        title: "Erro",
        description: "Erro ao carregar horários de trabalho",
        variant: "destructive"
      });
    }
  };

  const getScheduleForDay = (dayOfWeek: string): WorkSchedule | null => {
    return schedules.find(s => s.day_of_week === dayOfWeek) || null;
  };

  const handleScheduleChange = (dayOfWeek: string, field: string, value: any) => {
    setSchedules(prev => {
      const existing = prev.find(s => s.day_of_week === dayOfWeek);
      if (existing) {
        return prev.map(s => 
          s.day_of_week === dayOfWeek 
            ? { ...s, [field]: value }
            : s
        );
      } else {
        const newSchedule: Omit<WorkSchedule, 'id' | 'created_at' | 'updated_at'> = {
          professional_id: selectedProfessional,
          day_of_week: dayOfWeek as any,
          start_time: '08:00',
          end_time: '18:00',
          break_start_time: null,
          break_end_time: null,
          is_active: true,
          [field]: value
        };
        return [...prev, newSchedule as WorkSchedule];
      }
    });
  };

  const saveSchedules = async () => {
    try {
      setSaving(true);
      
      for (const schedule of schedules) {
        if (schedule.id) {
          await workScheduleService.updateSchedule(schedule.id, schedule);
        } else {
          await workScheduleService.createSchedule({
            professional_id: schedule.professional_id,
            day_of_week: schedule.day_of_week,
            start_time: schedule.start_time,
            end_time: schedule.end_time,
            break_start_time: schedule.break_start_time,
            break_end_time: schedule.break_end_time,
            is_active: schedule.is_active
          });
        }
      }

      toast({
        title: "Sucesso",
        description: "Horários de trabalho salvos com sucesso",
      });

      loadSchedules(); // Recarregar para obter IDs
    } catch (error) {
      console.error('Erro ao salvar horários:', error);
      toast({
        title: "Erro",
        description: "Erro ao salvar horários de trabalho",
        variant: "destructive"
      });
    } finally {
      setSaving(false);
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
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Horários de Trabalho
          </CardTitle>
          <CardDescription>
            Configure os horários de trabalho dos profissionais no YumerFlow
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Seleção do Profissional */}
          <div className="space-y-2">
            <Label htmlFor="professional">Profissional</Label>
            <Select value={selectedProfessional} onValueChange={setSelectedProfessional}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione um profissional" />
              </SelectTrigger>
              <SelectContent>
                {professionals.map((prof) => (
                  <SelectItem key={prof.id} value={prof.id}>
                    {prof.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Configuração por Dia da Semana */}
          {selectedProfessional && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-medium">Configuração Semanal</h3>
                <Button onClick={saveSchedules} disabled={saving}>
                  <Save className="h-4 w-4 mr-2" />
                  {saving ? 'Salvando...' : 'Salvar Horários'}
                </Button>
              </div>

              <div className="grid gap-4">
                {daysOfWeek.map((day) => {
                  const schedule = getScheduleForDay(day.key);
                  const isActive = schedule?.is_active ?? false;

                  return (
                    <Card key={day.key} className={isActive ? 'border-green-200' : 'border-gray-200'}>
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between mb-4">
                          <h4 className="font-medium">{day.label}</h4>
                          <Switch
                            checked={isActive}
                            onCheckedChange={(checked) => 
                              handleScheduleChange(day.key, 'is_active', checked)
                            }
                          />
                        </div>

                        {isActive && (
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <div className="space-y-2">
                              <Label>Início</Label>
                              <Input
                                type="time"
                                value={schedule?.start_time || '08:00'}
                                onChange={(e) => 
                                  handleScheduleChange(day.key, 'start_time', e.target.value)
                                }
                              />
                            </div>

                            <div className="space-y-2">
                              <Label>Fim</Label>
                              <Input
                                type="time"
                                value={schedule?.end_time || '18:00'}
                                onChange={(e) => 
                                  handleScheduleChange(day.key, 'end_time', e.target.value)
                                }
                              />
                            </div>

                            <div className="space-y-2">
                              <Label>Pausa - Início</Label>
                              <Input
                                type="time"
                                value={schedule?.break_start_time || ''}
                                onChange={(e) => 
                                  handleScheduleChange(day.key, 'break_start_time', e.target.value || null)
                                }
                                placeholder="Opcional"
                              />
                            </div>

                            <div className="space-y-2">
                              <Label>Pausa - Fim</Label>
                              <Input
                                type="time"
                                value={schedule?.break_end_time || ''}
                                onChange={(e) => 
                                  handleScheduleChange(day.key, 'break_end_time', e.target.value || null)
                                }
                                placeholder="Opcional"
                              />
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default WorkScheduleManager;
