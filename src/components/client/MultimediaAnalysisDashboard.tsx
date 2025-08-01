import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { useMultimediaAnalysis } from '@/hooks/useMultimediaAnalysis';
import { FileImage, FileVideo, FileAudio, FileText, Link, Activity, TrendingUp, CheckCircle } from 'lucide-react';

interface MultimediaAnalysisDashboardProps {
  clientId: string;
  ticketId?: string;
}

const MultimediaAnalysisDashboard: React.FC<MultimediaAnalysisDashboardProps> = ({ 
  clientId, 
  ticketId 
}) => {
  const { analyzing, results, stats, loadTicketAnalyses, refreshStats } = useMultimediaAnalysis(clientId);

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'image': return <FileImage className="h-4 w-4" />;
      case 'video': return <FileVideo className="h-4 w-4" />;
      case 'audio': return <FileAudio className="h-4 w-4" />;
      case 'document': return <FileText className="h-4 w-4" />;
      case 'url': return <Link className="h-4 w-4" />;
      default: return <Activity className="h-4 w-4" />;
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'image': return 'bg-blue-500';
      case 'video': return 'bg-purple-500';
      case 'audio': return 'bg-green-500';
      case 'document': return 'bg-orange-500';
      case 'url': return 'bg-cyan-500';
      default: return 'bg-gray-500';
    }
  };

  const handleLoadAnalyses = () => {
    if (ticketId) {
      loadTicketAnalyses(ticketId);
    }
  };

  const handleRefreshStats = () => {
    refreshStats(clientId);
  };

  return (
    <div className="space-y-6">
      {/* Estatísticas Gerais */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Processado</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalProcessed}</div>
            <p className="text-xs text-muted-foreground">mídias analisadas</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Taxa de Sucesso</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.successRate.toFixed(1)}%</div>
            <p className="text-xs text-muted-foreground">análises bem-sucedidas</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Status</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {analyzing ? "Processando..." : "Pronto"}
            </div>
            <p className="text-xs text-muted-foreground">
              {analyzing ? "análise em andamento" : "aguardando mídia"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Distribuição por Tipo */}
      <Card>
        <CardHeader>
          <CardTitle>Análises por Tipo de Mídia</CardTitle>
          <CardDescription>
            Distribuição das mídias processadas por categoria
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {Object.entries(stats.byType).map(([type, count]) => (
              <div key={type} className="flex items-center space-x-2">
                <div className={`p-2 rounded-md ${getTypeColor(type)}`}>
                  {getTypeIcon(type)}
                </div>
                <div>
                  <p className="text-sm font-medium capitalize">{type}</p>
                  <p className="text-xs text-muted-foreground">{count} itens</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Controles */}
      <div className="flex gap-2">
        {ticketId && (
          <Button variant="outline" onClick={handleLoadAnalyses}>
            Carregar Análises do Ticket
          </Button>
        )}
        <Button variant="outline" onClick={handleRefreshStats}>
          Atualizar Estatísticas
        </Button>
      </div>

      {/* Resultados Recentes */}
      {results.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Análises Recentes</CardTitle>
            <CardDescription>
              Resultados das análises mais recentes
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {results.slice(0, 5).map((result, index) => (
                <div key={index} className="flex items-start space-x-3">
                  <div className={`p-2 rounded-md ${getTypeColor(result.type)}`}>
                    {getTypeIcon(result.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge 
                        variant={result.success ? "default" : "destructive"}
                        className="capitalize"
                      >
                        {result.type}
                      </Badge>
                      {result.success ? (
                        <CheckCircle className="h-4 w-4 text-green-500" />
                      ) : (
                        <Activity className="h-4 w-4 text-red-500" />
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {result.analysis.substring(0, 150)}
                      {result.analysis.length > 150 && '...'}
                    </p>
                    {result.metadata && (
                      <div className="mt-1 flex gap-2 text-xs text-muted-foreground">
                        {result.metadata.size && (
                          <span>Tamanho: {result.metadata.size}bytes</span>
                        )}
                        {result.metadata.format && (
                          <span>Formato: {result.metadata.format}</span>
                        )}
                        {result.metadata.duration && (
                          <span>Duração: {result.metadata.duration}s</span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Guia de Capacidades */}
      <Card>
        <CardHeader>
          <CardTitle>Capacidades do Assistente Multimídia</CardTitle>
          <CardDescription>
            O que o assistente pode processar automaticamente
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <FileImage className="h-4 w-4 text-blue-500" />
                <strong>Imagens</strong>
              </div>
              <ul className="text-sm text-muted-foreground ml-6 list-disc">
                <li>Descrição detalhada do conteúdo</li>
                <li>Extração de texto (OCR)</li>
                <li>Identificação de objetos e pessoas</li>
                <li>Análise de documentos visuais</li>
              </ul>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <FileAudio className="h-4 w-4 text-green-500" />
                <strong>Áudios</strong>
              </div>
              <ul className="text-sm text-muted-foreground ml-6 list-disc">
                <li>Transcrição automática</li>
                <li>Detecção de idioma</li>
                <li>Conversão para texto</li>
                <li>Análise de conteúdo falado</li>
              </ul>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <FileVideo className="h-4 w-4 text-purple-500" />
                <strong>Vídeos</strong>
              </div>
              <ul className="text-sm text-muted-foreground ml-6 list-disc">
                <li>Análise de frames-chave</li>
                <li>Extração de áudio</li>
                <li>Descrição de conteúdo visual</li>
                <li>Detecção de ações e objetos</li>
              </ul>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-orange-500" />
                <strong>Documentos</strong>
              </div>
              <ul className="text-sm text-muted-foreground ml-6 list-disc">
                <li>Extração de texto de PDFs</li>
                <li>Processamento de DOCs/TXT</li>
                <li>Análise de planilhas</li>
                <li>Resumo de conteúdo</li>
              </ul>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Link className="h-4 w-4 text-cyan-500" />
                <strong>URLs e Links</strong>
              </div>
              <ul className="text-sm text-muted-foreground ml-6 list-disc">
                <li>Análise de páginas web</li>
                <li>Extração de título e descrição</li>
                <li>Detecção de tipo de conteúdo</li>
                <li>Resumo de informações</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default MultimediaAnalysisDashboard;