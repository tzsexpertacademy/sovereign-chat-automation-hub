import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SystemLogEntry } from "@/services/systemLogsService";
import { AlertTriangle, CheckCircle, Info, XCircle, Bug } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

interface LogEntryCardProps {
  log: SystemLogEntry;
}

const LogEntryCard = ({ log }: LogEntryCardProps) => {
  const getLevelIcon = (level: string) => {
    switch (level) {
      case 'error':
        return <XCircle className="w-4 h-4 text-red-500" />;
      case 'warning':
        return <AlertTriangle className="w-4 h-4 text-yellow-500" />;
      case 'info':
        return <Info className="w-4 h-4 text-blue-500" />;
      case 'success':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'debug':
        return <Bug className="w-4 h-4 text-gray-500" />;
      default:
        return <Info className="w-4 h-4 text-blue-500" />;
    }
  };

  const getLevelColor = (level: string) => {
    switch (level) {
      case 'error':
        return 'bg-red-50 border-red-200 text-red-800';
      case 'warning':
        return 'bg-yellow-50 border-yellow-200 text-yellow-800';
      case 'info':
        return 'bg-blue-50 border-blue-200 text-blue-800';
      case 'success':
        return 'bg-green-50 border-green-200 text-green-800';
      case 'debug':
        return 'bg-gray-50 border-gray-200 text-gray-800';
      default:
        return 'bg-gray-50 border-gray-200 text-gray-800';
    }
  };

  const getSourceColor = (source: string) => {
    switch (source) {
      case 'frontend':
        return 'bg-purple-100 text-purple-800';
      case 'yumer':
        return 'bg-indigo-100 text-indigo-800';
      case 'supabase':
        return 'bg-emerald-100 text-emerald-800';
      case 'system':
        return 'bg-orange-100 text-orange-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <Card className={`transition-all duration-200 hover:shadow-md ${getLevelColor(log.level)}`}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              {getLevelIcon(log.level)}
              <Badge variant="outline" className={getSourceColor(log.source)}>
                {log.source}
              </Badge>
              <Badge variant="secondary" className="text-xs">
                {log.component}
              </Badge>
              <span className="text-xs text-gray-500 ml-auto">
                {formatDistanceToNow(log.timestamp, { 
                  addSuffix: true, 
                  locale: ptBR 
                })}
              </span>
            </div>
            
            <p className="text-sm font-medium mb-1">{log.message}</p>
            
            {log.details && (
              <div className="mt-2 p-2 bg-white/50 rounded text-xs font-mono overflow-x-auto">
                <pre className="whitespace-pre-wrap break-words">
                  {typeof log.details === 'object' 
                    ? JSON.stringify(log.details, null, 2) 
                    : log.details
                  }
                </pre>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default LogEntryCard;