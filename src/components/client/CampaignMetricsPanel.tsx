import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  Send, 
  CheckCircle, 
  AlertCircle, 
  Eye, 
  MousePointer, 
  MessageCircle,
  TrendingUp,
  TrendingDown
} from 'lucide-react';
import { campaignService, type CampaignMetrics } from "@/services/campaignService";

interface CampaignMetricsPanelProps {
  campaignId: string;
}

const CampaignMetricsPanel: React.FC<CampaignMetricsPanelProps> = ({ campaignId }) => {
  const [metrics, setMetrics] = useState<CampaignMetrics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadMetrics();
  }, [campaignId]);

  const loadMetrics = async () => {
    try {
      setLoading(true);
      const data = await campaignService.getCampaignMetrics(campaignId);
      setMetrics(data);
    } catch (error) {
      console.error('Erro ao carregar métricas:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="animate-pulse">Carregando métricas...</div>;
  }

  if (!metrics) {
    return <div>Erro ao carregar métricas</div>;
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-2">
            <Send className="h-5 w-5 text-blue-500" />
            <div>
              <p className="text-sm text-muted-foreground">Enviadas</p>
              <p className="text-2xl font-bold">{metrics.total_sent}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-green-500" />
            <div>
              <p className="text-sm text-muted-foreground">Taxa de Entrega</p>
              <p className="text-2xl font-bold">{metrics.delivery_rate.toFixed(1)}%</p>
            </div>
          </div>
          <Progress value={metrics.delivery_rate} className="mt-2" />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-2">
            <Eye className="h-5 w-5 text-purple-500" />
            <div>
              <p className="text-sm text-muted-foreground">Taxa de Abertura</p>
              <p className="text-2xl font-bold">{metrics.open_rate.toFixed(1)}%</p>
            </div>
          </div>
          <Progress value={metrics.open_rate} className="mt-2" />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-2">
            <MessageCircle className="h-5 w-5 text-orange-500" />
            <div>
              <p className="text-sm text-muted-foreground">Taxa de Resposta</p>
              <p className="text-2xl font-bold">{metrics.reply_rate.toFixed(1)}%</p>
            </div>
          </div>
          <Progress value={metrics.reply_rate} className="mt-2" />
        </CardContent>
      </Card>
    </div>
  );
};

export default CampaignMetricsPanel;