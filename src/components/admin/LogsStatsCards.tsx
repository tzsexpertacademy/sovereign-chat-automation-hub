import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, CheckCircle, Info, XCircle } from "lucide-react";

interface LogStats {
  total: number;
  errors: number;
  warnings: number;
  info: number;
  success: number;
}

interface LogsStatsCardsProps {
  stats: LogStats;
}

const LogsStatsCards = ({ stats }: LogsStatsCardsProps) => {
  const cards = [
    {
      title: "Total de Logs",
      value: stats.total,
      icon: Info,
      color: "bg-blue-500",
      textColor: "text-blue-600"
    },
    {
      title: "Erros",
      value: stats.errors,
      icon: XCircle,
      color: "bg-red-500",
      textColor: "text-red-600"
    },
    {
      title: "Avisos",
      value: stats.warnings,
      icon: AlertTriangle,
      color: "bg-yellow-500",
      textColor: "text-yellow-600"
    },
    {
      title: "Sucesso",
      value: stats.success,
      icon: CheckCircle,
      color: "bg-green-500",
      textColor: "text-green-600"
    }
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((card) => (
        <Card key={card.title}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{card.title}</CardTitle>
            <card.icon className={`h-4 w-4 ${card.textColor}`} />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{card.value.toLocaleString()}</div>
            <Badge variant="outline" className={`mt-1 ${card.textColor}`}>
              {((card.value / stats.total) * 100 || 0).toFixed(1)}%
            </Badge>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

export default LogsStatsCards;