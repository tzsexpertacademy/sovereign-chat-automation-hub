
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, MessageSquare, Activity, TrendingUp, AlertCircle, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const AdminOverview = () => {
  const stats = [
    { title: "Clientes Ativos", value: "47", change: "+12%", icon: Users, color: "text-blue-600" },
    { title: "Instâncias Online", value: "42", change: "+5%", icon: Activity, color: "text-green-600" },
    { title: "Mensagens/Dia", value: "15.2K", change: "+23%", icon: MessageSquare, color: "text-purple-600" },
    { title: "Uptime Sistema", value: "99.9%", change: "+0.1%", icon: TrendingUp, color: "text-emerald-600" },
  ];

  const recentClients = [
    { name: "Empresa ABC", status: "online", messages: "1.2K", lastActivity: "2 min" },
    { name: "Loja XYZ", status: "online", messages: "856", lastActivity: "5 min" },
    { name: "Consultoria DEF", status: "offline", messages: "432", lastActivity: "1h" },
    { name: "E-commerce GHI", status: "online", messages: "2.1K", lastActivity: "1 min" },
  ];

  const systemAlerts = [
    { type: "info", message: "Nova versão disponível", time: "10 min" },
    { type: "warning", message: "Cliente XYZ com alta latência", time: "25 min" },
    { type: "success", message: "Backup concluído com sucesso", time: "1h" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Dashboard Administrativo</h1>
          <p className="text-gray-600">Visão geral do sistema WhatsApp SaaS</p>
        </div>
        <Button className="bg-gradient-to-r from-green-500 to-blue-500 hover:from-green-600 hover:to-blue-600">
          Relatório Completo
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, index) => (
          <Card key={index} className="hover:shadow-lg transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">
                {stat.title}
              </CardTitle>
              <stat.icon className={`h-4 w-4 ${stat.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-gray-900">{stat.value}</div>
              <p className="text-xs text-green-600 flex items-center mt-1">
                <TrendingUp className="w-3 h-3 mr-1" />
                {stat.change} vs último mês
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Recent Clients */}
        <Card>
          <CardHeader>
            <CardTitle>Clientes Recentes</CardTitle>
            <CardDescription>Atividade dos últimos clientes conectados</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentClients.map((client, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center space-x-3">
                    <div className={`w-3 h-3 rounded-full ${
                      client.status === 'online' ? 'bg-green-500' : 'bg-gray-400'
                    }`} />
                    <div>
                      <p className="font-medium text-gray-900">{client.name}</p>
                      <p className="text-sm text-gray-500">{client.messages} mensagens hoje</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <Badge variant={client.status === 'online' ? 'default' : 'secondary'}>
                      {client.status}
                    </Badge>
                    <p className="text-xs text-gray-500 mt-1">{client.lastActivity}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* System Alerts */}
        <Card>
          <CardHeader>
            <CardTitle>Alertas do Sistema</CardTitle>
            <CardDescription>Notificações e eventos importantes</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {systemAlerts.map((alert, index) => (
                <div key={index} className="flex items-start space-x-3 p-3 bg-gray-50 rounded-lg">
                  {alert.type === 'success' && <CheckCircle className="w-5 h-5 text-green-500 mt-0.5" />}
                  {alert.type === 'warning' && <AlertCircle className="w-5 h-5 text-yellow-500 mt-0.5" />}
                  {alert.type === 'info' && <Activity className="w-5 h-5 text-blue-500 mt-0.5" />}
                  <div className="flex-1">
                    <p className="text-sm text-gray-900">{alert.message}</p>
                    <p className="text-xs text-gray-500">{alert.time} atrás</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AdminOverview;
