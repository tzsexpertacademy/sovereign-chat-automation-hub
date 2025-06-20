
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface BookingSettingsProps {
  clientId: string;
}

interface BookingConfig {
  id?: string;
  timezone: string;
  advance_booking_days: number;
  same_day_booking_enabled: boolean;
  booking_window_start: string;
  booking_window_end: string;
  google_calendar_integration_enabled: boolean;
  auto_confirm_appointments: boolean;
  send_confirmation_messages: boolean;
  send_reminder_messages: boolean;
  reminder_hours_before: number;
}

const BookingSettings: React.FC<BookingSettingsProps> = ({ clientId }) => {
  const [config, setConfig] = useState<BookingConfig>({
    timezone: 'America/Sao_Paulo',
    advance_booking_days: 30,
    same_day_booking_enabled: true,
    booking_window_start: '08:00',
    booking_window_end: '18:00',
    google_calendar_integration_enabled: false,
    auto_confirm_appointments: false,
    send_confirmation_messages: true,
    send_reminder_messages: true,
    reminder_hours_before: 24
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadSettings();
  }, [clientId]);

  const loadSettings = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('booking_settings')
        .select('*')
        .eq('client_id', clientId)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      if (data) {
        setConfig(data);
      }
    } catch (error) {
      console.error('Erro ao carregar configurações:', error);
      toast({
        title: "Erro",
        description: "Erro ao carregar configurações de agendamento",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      
      const configData = {
        ...config,
        client_id: clientId
      };

      if (config.id) {
        const { error } = await supabase
          .from('booking_settings')
          .update(configData)
          .eq('id', config.id);
        
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from('booking_settings')
          .insert(configData)
          .select()
          .single();
        
        if (error) throw error;
        setConfig(data);
      }

      toast({
        title: "Sucesso",
        description: "Configurações salvas com sucesso"
      });
    } catch (error) {
      console.error('Erro ao salvar configurações:', error);
      toast({
        title: "Erro",
        description: "Erro ao salvar configurações",
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
      <div>
        <h2 className="text-2xl font-bold">Configurações de Agendamento</h2>
        <p className="text-muted-foreground">Configure as regras e integrações do sistema de agendamento</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Configurações Gerais */}
        <Card>
          <CardHeader>
            <CardTitle>Configurações Gerais</CardTitle>
            <CardDescription>Configurações básicas do sistema de agendamento</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="timezone">Fuso Horário</Label>
              <Select 
                value={config.timezone} 
                onValueChange={(value) => setConfig({ ...config, timezone: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="America/Sao_Paulo">São Paulo (UTC-3)</SelectItem>
                  <SelectItem value="America/New_York">Nova York (UTC-5)</SelectItem>
                  <SelectItem value="Europe/London">Londres (UTC+0)</SelectItem>
                  <SelectItem value="Europe/Paris">Paris (UTC+1)</SelectItem>
                  <SelectItem value="Asia/Tokyo">Tóquio (UTC+9)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="advance_booking">Antecedência máxima (dias)</Label>
              <Input
                id="advance_booking"
                type="number"
                value={config.advance_booking_days}
                onChange={(e) => setConfig({ ...config, advance_booking_days: parseInt(e.target.value) })}
                min={1}
                max={365}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="start_time">Horário de início</Label>
                <Input
                  id="start_time"
                  type="time"
                  value={config.booking_window_start}
                  onChange={(e) => setConfig({ ...config, booking_window_start: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="end_time">Horário de fim</Label>
                <Input
                  id="end_time"
                  type="time"
                  value={config.booking_window_end}
                  onChange={(e) => setConfig({ ...config, booking_window_end: e.target.value })}
                />
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label>Permitir agendamento no mesmo dia</Label>
                <p className="text-sm text-muted-foreground">
                  Permite que clientes agendem para o mesmo dia
                </p>
              </div>
              <Switch
                checked={config.same_day_booking_enabled}
                onCheckedChange={(checked) => setConfig({ ...config, same_day_booking_enabled: checked })}
              />
            </div>
          </CardContent>
        </Card>

        {/* Automação */}
        <Card>
          <CardHeader>
            <CardTitle>Automação</CardTitle>
            <CardDescription>Configure a automação de agendamentos e notificações</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label>Confirmação automática</Label>
                <p className="text-sm text-muted-foreground">
                  Confirma agendamentos automaticamente
                </p>
              </div>
              <Switch
                checked={config.auto_confirm_appointments}
                onCheckedChange={(checked) => setConfig({ ...config, auto_confirm_appointments: checked })}
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label>Mensagens de confirmação</Label>
                <p className="text-sm text-muted-foreground">
                  Enviar mensagem de confirmação via WhatsApp
                </p>
              </div>
              <Switch
                checked={config.send_confirmation_messages}
                onCheckedChange={(checked) => setConfig({ ...config, send_confirmation_messages: checked })}
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label>Mensagens de lembrete</Label>
                <p className="text-sm text-muted-foreground">
                  Enviar lembretes antes do agendamento
                </p>
              </div>
              <Switch
                checked={config.send_reminder_messages}
                onCheckedChange={(checked) => setConfig({ ...config, send_reminder_messages: checked })}
              />
            </div>

            {config.send_reminder_messages && (
              <div>
                <Label htmlFor="reminder_hours">Lembrete (horas antes)</Label>
                <Input
                  id="reminder_hours"
                  type="number"
                  value={config.reminder_hours_before}
                  onChange={(e) => setConfig({ ...config, reminder_hours_before: parseInt(e.target.value) })}
                  min={1}
                  max={168}
                />
              </div>
            )}
          </CardContent>
        </Card>

        {/* Integração Google Calendar */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Integração Google Calendar</CardTitle>
            <CardDescription>
              Configure a sincronização com o Google Calendar para backup e visualização externa
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label>Ativar integração Google Calendar</Label>
                <p className="text-sm text-muted-foreground">
                  Sincroniza agendamentos com o Google Calendar
                </p>
              </div>
              <Switch
                checked={config.google_calendar_integration_enabled}
                onCheckedChange={(checked) => setConfig({ ...config, google_calendar_integration_enabled: checked })}
              />
            </div>

            {config.google_calendar_integration_enabled && (
              <div className="p-4 border rounded-lg bg-muted/50">
                <p className="text-sm text-muted-foreground">
                  Para ativar a integração com Google Calendar, você precisará configurar as credenciais OAuth2 
                  nas configurações avançadas do sistema. Entre em contato com o suporte para mais informações.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving}>
          {saving ? 'Salvando...' : 'Salvar Configurações'}
        </Button>
      </div>
    </div>
  );
};

export default BookingSettings;
