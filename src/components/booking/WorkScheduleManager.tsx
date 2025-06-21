import React, { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { 
  Plus, 
  Edit, 
  Trash2, 
  Clock, 
  Copy,
  Save,
  X,
  Calendar,
  Users
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { professionalsService } from "@/services/professionalsService";
import { workScheduleService, WorkSchedule } from "@/services/workScheduleService";
import { bookingValidationService } from "@/services/bookingValidationService";

interface WorkScheduleManagerProps {
  clientId: string;
}

interface CreateScheduleData {
  professional_id: string;
  day_of_week: 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';
  start_time: string;
  end_time: string;
  break_start_time?: string;
  break_end_time?: string;
  is_active: boolean;
}

const WorkScheduleManager = ({ clientId }: WorkScheduleManagerProps) => {
  const [professionals, setProfessionals] = useState<any[]>([]);
  const [schedules, setSchedules] = useState<WorkSchedule[]>([]);
  const [selectedProfessional, setSelectedProfessional] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<string | null>(null);
  const [newSchedule, setNewSchedule] = useState<Partial<CreateScheduleData>>({
    day_of_week: 'monday',
    start_time: '09:00',
    end_time: '18:00',
    break_start_time: '12:00',
    break_end_time: '13:00',
    is_active: true
  });

  const { toast } = useToast();

  const daysOfWeek = [
    { value: 'monday', label: 'Segunda-feira' },
    { value: 'tuesday', label: 'Terça-feira' },
    { value: 'wednesday', label: 'Quarta-feira' },
    { value: 'thursday', label: 'Quinta-feira' },
    { value: 'friday', label: 'Sexta-feira' },
    { value: 'saturday', label: 'Sábado' },
    { value: 'sunday', label: 'Domingo' },
  ];

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
      const professionalsData = await professionalsService.getClientProfessionals(clientId);
      setProfessionals(professionalsData);
    } catch (error) {
      console.error('Erro ao carregar profissionais:', error);
      toast({
        title: "Erro",
        description: "Falha ao carregar profissionais",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const loadSchedules = async () => {
    if (!selectedProfessional) return;
    
    try {
      setLoading(true);
      const schedulesData = await workScheduleService.getProfessionalSchedules(selectedProfessional);
      setSchedules(schedulesData);
    } catch (error) {
      console.error('Erro ao carregar horários:', error);
      toast({
        title: "Erro",
        description: "Falha ao carregar horários",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const createSchedule = async () => {
    if (!selectedProfessional || !newSchedule.day_of_week) return;

    try {
      setLoading(true);
      
      await workScheduleService.createSchedule({
        professional_id: selectedProfessional,
        day_of_week: newSchedule.day_of_week as any,
        start_time: newSchedule.start_time || '09:00',
        end_time: newSchedule.end_time || '18:00',
        break_start_time: newSchedule.break_start_time,
        break_end_time: newSchedule.break_end_time,
        is_active: newSchedule.is_active ?? true
      });

      toast({
        title: "Horário Criado",
        description: "Horário de trabalho criado com sucesso!",
      });

      setNewSchedule({
        day_of_week: 'monday',
        start_time: '09:00',
        end_time: '18:00',
        break_start_time: '12:00',
        break_end_time: '13:00',
        is_active: true
      });
      
      await loadSchedules();
    } catch (error) {
      console.error('Erro ao criar horário:', error);
      toast({
        title: "Erro",
        description: "Falha ao criar horário",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const updateSchedule = async (scheduleId: string, updates: Partial<WorkSchedule>) => {
    try {
      await workScheduleService.updateSchedule(scheduleId, updates);
      
      toast({
        title: "Horário Atualizado",
        description: "Horário de trabalho atualizado com sucesso!",
      });
      
      setEditingSchedule(null);
      await loadSchedules();
    } catch (error) {
      console.error('Erro ao atualizar horário:', error);
      toast({
        title: "Erro",
        description: "Falha ao atualizar horário",
        variant: "destructive",
      });
    }
  };

  const deleteSchedule = async (scheduleId: string) => {
    try {
      await workScheduleService.deleteSchedule(scheduleId);
      
      toast({
        title: "Horário Removido",
        description: "Horário de trabalho removido com sucesso!",
      });
      
      await loadSchedules();
    } catch (error) {
      console.error('Erro ao remover horário:', error);
      toast({
        title: "Erro",
        description: "Falha ao remover horário",
        variant: "destructive",
      });
    }
  };

  const copyScheduleToAllDays = async (schedule: WorkSchedule) => {
    try {
      setLoading(true);
      
      for (const day of daysOfWeek) {
        if (day.value !== schedule.day_of_week) {
          const existingSchedule = schedules.find(s => s.day_of_week === day.value);
          
          if (existingSchedule) {
            await workScheduleService.updateSchedule(existingSchedule.id, {
              start_time: schedule.start_time,
              end_time: schedule.end_time,
              break_start_time: schedule.break_start_time,
              break_end_time: schedule.break_end_time,
              is_active: schedule.is_active
            });
          } else {
            await workScheduleService.createSchedule({
              professional_id: selectedProfessional,
              day_of_week: day.value as any,
              start_time: schedule.start_time,
              end_time: schedule.end_time,
              break_start_time: schedule.break_start_time,
              break_end_time: schedule.break_end_time,
              is_active: schedule.is_active
            });
          }
        }
      }

      toast({
        title: "Horários Copiados",
        description: "Horário copiado para todos os dias da semana!",
      });
      
      await loadSchedules();
    } catch (error) {
      console.error('Erro ao copiar horários:', error);
      toast({
        title: "Erro",
        description: "Falha ao copiar horários",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getDayLabel = (day: string) => {
    return daysOfWeek.find(d => d.value === day)?.label || day;
  };

  const selectedProfessionalData = professionals.find(p => p.id === selectedProfessional);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Horários de Trabalho</h2>
          <p className="text-gray-600">Configure os horários de trabalho dos profissionais</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Users className="w-5 h-5 mr-2" />
            Selecionar Profissional
          </CardTitle>
        </CardHeader>
        <CardContent>
          <select
            value={selectedProfessional}
            onChange={(e) => setSelectedProfessional(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Selecione um profissional</option>
            {professionals.map((professional) => (
              <option key={professional.id} value={professional.id}>
                {professional.name} - {professional.specialty}
              </option>
            ))}
          </select>
        </CardContent>
      </Card>

      {selectedProfessional && (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Calendar className="w-5 h-5 mr-2" />
                Horários Configurados - {selectedProfessionalData?.name}
              </CardTitle>
              <CardDescription>
                Gerencie os horários de trabalho por dia da semana
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {schedules.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <Clock className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                  <p>Nenhum horário configurado para este profissional</p>
                </div>
              ) : (
                schedules.map((schedule) => (
                  <div key={schedule.id} className="border rounded-lg p-4 space-y-2">
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="font-semibold">{getDayLabel(schedule.day_of_week)}</h4>
                        <p className="text-sm text-gray-600">
                          {schedule.start_time} às {schedule.end_time}
                          {schedule.break_start_time && schedule.break_end_time && (
                            ` (Intervalo: ${schedule.break_start_time} às ${schedule.break_end_time})`
                          )}
                        </p>
                        <Badge variant={schedule.is_active ? "default" : "secondary"}>
                          {schedule.is_active ? "Ativo" : "Inativo"}
                        </Badge>
                      </div>
                      <div className="flex space-x-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => copyScheduleToAllDays(schedule)}
                        >
                          <Copy className="w-4 h-4 mr-1" />
                          Copiar
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setEditingSchedule(schedule.id)}
                        >
                          <Edit className="w-4 h-4 mr-1" />
                          Editar
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => deleteSchedule(schedule.id)}
                        >
                          <Trash2 className="w-4 h-4 mr-1" />
                          Remover
                        </Button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Novo Horário</CardTitle>
              <CardDescription>Adicione um novo horário de trabalho</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Dia da Semana</label>
                  <select
                    value={newSchedule.day_of_week || ''}
                    onChange={(e) => setNewSchedule(prev => ({ ...prev, day_of_week: e.target.value as any }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {daysOfWeek.map((day) => (
                      <option key={day.value} value={day.value}>
                        {day.label}
                      </option>
                    ))}
                  </select>
                </div>
                
                <div>
                  <label className="text-sm font-medium">Status</label>
                  <select
                    value={newSchedule.is_active ? 'true' : 'false'}
                    onChange={(e) => setNewSchedule(prev => ({ ...prev, is_active: e.target.value === 'true' }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="true">Ativo</option>
                    <option value="false">Inativo</option>
                  </select>
                </div>

                <div>
                  <label className="text-sm font-medium">Horário de Início</label>
                  <Input
                    type="time"
                    value={newSchedule.start_time}
                    onChange={(e) => setNewSchedule(prev => ({ ...prev, start_time: e.target.value }))}
                  />
                </div>

                <div>
                  <label className="text-sm font-medium">Horário de Fim</label>
                  <Input
                    type="time"
                    value={newSchedule.end_time}
                    onChange={(e) => setNewSchedule(prev => ({ ...prev, end_time: e.target.value }))}
                  />
                </div>

                <div>
                  <label className="text-sm font-medium">Início do Intervalo (Opcional)</label>
                  <Input
                    type="time"
                    value={newSchedule.break_start_time || ''}
                    onChange={(e) => setNewSchedule(prev => ({ ...prev, break_start_time: e.target.value || undefined }))}
                  />
                </div>

                <div>
                  <label className="text-sm font-medium">Fim do Intervalo (Opcional)</label>
                  <Input
                    type="time"
                    value={newSchedule.break_end_time || ''}
                    onChange={(e) => setNewSchedule(prev => ({ ...prev, break_end_time: e.target.value || undefined }))}
                  />
                </div>
              </div>

              <Button onClick={createSchedule} disabled={loading} className="w-full">
                <Plus className="w-4 h-4 mr-2" />
                {loading ? "Criando..." : "Criar Horário"}
              </Button>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
};

export default WorkScheduleManager;
