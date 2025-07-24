import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  MessageSquare, 
  Users, 
  Wifi, 
  WifiOff, 
  Ticket,
  AlertCircle,
  CheckCircle,
  Info,
  Clock
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

interface RecentActivity {
  id: string;
  type: 'instance_connected' | 'instance_disconnected' | 'message_received' | 'ticket_created' | 'system_event';
  title: string;
  description: string;
  timestamp: Date;
  status: 'success' | 'warning' | 'error' | 'info';
}

interface RecentActivityCardProps {
  activities: RecentActivity[];
}

export const RecentActivityCard = ({ activities }: RecentActivityCardProps) => {
  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'instance_connected':
        return <Wifi className="w-4 h-4 text-green-500" />;
      case 'instance_disconnected':
        return <WifiOff className="w-4 h-4 text-red-500" />;
      case 'message_received':
        return <MessageSquare className="w-4 h-4 text-blue-500" />;
      case 'ticket_created':
        return <Ticket className="w-4 h-4 text-purple-500" />;
      case 'system_event':
        return <Info className="w-4 h-4 text-gray-500" />;
      default:
        return <AlertCircle className="w-4 h-4 text-gray-500" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'success':
        return <Badge variant="outline" className="text-green-600 border-green-600">Sucesso</Badge>;
      case 'warning':
        return <Badge variant="outline" className="text-yellow-600 border-yellow-600">Aviso</Badge>;
      case 'error':
        return <Badge variant="destructive">Erro</Badge>;
      default:
        return <Badge variant="outline">Info</Badge>;
    }
  };

  const formatTimestamp = (timestamp: Date) => {
    return formatDistanceToNow(timestamp, { 
      addSuffix: true, 
      locale: ptBR 
    });
  };

  if (!activities || activities.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-semibold flex items-center space-x-2">
            <Clock className="w-5 h-5" />
            <span>Atividade Recente</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <AlertCircle className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>Nenhuma atividade recente registrada</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg font-semibold flex items-center space-x-2">
          <Clock className="w-5 h-5" />
          <span>Atividade Recente</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[400px] pr-4">
          <div className="space-y-4">
            {activities.map((activity) => (
              <div 
                key={activity.id} 
                className="flex items-start space-x-3 p-3 rounded-lg border bg-card/50 hover:bg-card/80 transition-colors"
              >
                <div className="flex-shrink-0 mt-1">
                  {getActivityIcon(activity.type)}
                </div>
                
                <div className="flex-grow min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-grow">
                      <h4 className="font-medium text-sm text-foreground leading-tight">
                        {activity.title}
                      </h4>
                      <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                        {activity.description}
                      </p>
                    </div>
                    <div className="flex-shrink-0">
                      {getStatusBadge(activity.status)}
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-xs text-muted-foreground">
                      {formatTimestamp(activity.timestamp)}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
};