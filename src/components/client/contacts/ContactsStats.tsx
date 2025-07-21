
/**
 * Estatísticas da aba contatos
 */

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  Users, 
  MessageSquare, 
  TrendingUp, 
  Clock,
  UserCheck,
  UserX
} from 'lucide-react';

interface ContactsStatsProps {
  stats: {
    total: number;
    withConversations: number;
    withoutConversations: number;
    totalMessages: number;
    activeToday: number;
    newThisWeek: number;
  };
}

const ContactsStats = ({ stats }: ContactsStatsProps) => {
  const conversationRate = stats.total > 0 ? (stats.withConversations / stats.total * 100).toFixed(1) : '0';

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-gray-600 flex items-center">
            <Users className="w-4 h-4 mr-1" />
            Total
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="text-2xl font-bold text-gray-900">{stats.total}</div>
          <p className="text-xs text-gray-500">Contatos</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-gray-600 flex items-center">
            <UserCheck className="w-4 h-4 mr-1" />
            Com Conversa
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="text-2xl font-bold text-green-600">{stats.withConversations}</div>
          <p className="text-xs text-green-600">{conversationRate}% do total</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-gray-600 flex items-center">
            <UserX className="w-4 h-4 mr-1" />
            Sem Conversa
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="text-2xl font-bold text-gray-600">{stats.withoutConversations}</div>
          <p className="text-xs text-gray-500">Potencial</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-gray-600 flex items-center">
            <MessageSquare className="w-4 h-4 mr-1" />
            Mensagens
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="text-2xl font-bold text-blue-600">{stats.totalMessages}</div>
          <p className="text-xs text-blue-600">Total</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-gray-600 flex items-center">
            <Clock className="w-4 h-4 mr-1" />
            Ativos Hoje
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="text-2xl font-bold text-orange-600">{stats.activeToday}</div>
          <p className="text-xs text-orange-600">Interagiram</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-gray-600 flex items-center">
            <TrendingUp className="w-4 h-4 mr-1" />
            Novos
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="text-2xl font-bold text-purple-600">{stats.newThisWeek}</div>
          <p className="text-xs text-purple-600">Esta semana</p>
        </CardContent>
      </Card>
    </div>
  );
};

export default ContactsStats;
