import { useState, useEffect } from 'react';
import { multimediaAnalysisService, MediaAnalysisResult, MediaProcessingOptions } from '@/services/multimediaAnalysisService';
import { useToast } from '@/components/ui/use-toast';

interface UseMultimediaAnalysisReturn {
  analyzing: boolean;
  results: MediaAnalysisResult[];
  stats: {
    totalProcessed: number;
    byType: Record<string, number>;
    successRate: number;
  };
  processImage: (imageBase64: string, options: MediaProcessingOptions) => Promise<MediaAnalysisResult>;
  processAudio: (audioBase64: string, options: MediaProcessingOptions) => Promise<MediaAnalysisResult>;
  processVideo: (videoBase64: string, options: MediaProcessingOptions) => Promise<MediaAnalysisResult>;
  processDocument: (documentBase64: string, mimeType: string, options: MediaProcessingOptions) => Promise<MediaAnalysisResult>;
  processURL: (url: string, options: MediaProcessingOptions) => Promise<MediaAnalysisResult>;
  loadTicketAnalyses: (ticketId: string) => Promise<void>;
  refreshStats: (clientId: string) => Promise<void>;
}

export const useMultimediaAnalysis = (clientId: string): UseMultimediaAnalysisReturn => {
  const { toast } = useToast();
  const [analyzing, setAnalyzing] = useState(false);
  const [results, setResults] = useState<MediaAnalysisResult[]>([]);
  const [stats, setStats] = useState({
    totalProcessed: 0,
    byType: {},
    successRate: 0
  });

  const showToast = (result: MediaAnalysisResult) => {
    if (result.success) {
      toast({
        title: "Análise Concluída",
        description: `${result.type.toUpperCase()} processado com sucesso`,
      });
    } else {
      toast({
        title: "Erro na Análise",
        description: result.error || 'Falha no processamento',
        variant: "destructive",
      });
    }
  };

  const processImage = async (imageBase64: string, options: MediaProcessingOptions): Promise<MediaAnalysisResult> => {
    setAnalyzing(true);
    try {
      const result = await multimediaAnalysisService.processImage(imageBase64, options);
      setResults(prev => [result, ...prev]);
      showToast(result);
      return result;
    } finally {
      setAnalyzing(false);
    }
  };

  const processAudio = async (audioBase64: string, options: MediaProcessingOptions): Promise<MediaAnalysisResult> => {
    setAnalyzing(true);
    try {
      const result = await multimediaAnalysisService.processAudio(audioBase64, options);
      setResults(prev => [result, ...prev]);
      showToast(result);
      return result;
    } finally {
      setAnalyzing(false);
    }
  };

  const processVideo = async (videoBase64: string, options: MediaProcessingOptions): Promise<MediaAnalysisResult> => {
    setAnalyzing(true);
    try {
      const result = await multimediaAnalysisService.processVideo(videoBase64, options);
      setResults(prev => [result, ...prev]);
      showToast(result);
      return result;
    } finally {
      setAnalyzing(false);
    }
  };

  const processDocument = async (documentBase64: string, mimeType: string, options: MediaProcessingOptions): Promise<MediaAnalysisResult> => {
    setAnalyzing(true);
    try {
      const result = await multimediaAnalysisService.processDocument(documentBase64, mimeType, options);
      setResults(prev => [result, ...prev]);
      showToast(result);
      return result;
    } finally {
      setAnalyzing(false);
    }
  };

  const processURL = async (url: string, options: MediaProcessingOptions): Promise<MediaAnalysisResult> => {
    setAnalyzing(true);
    try {
      const result = await multimediaAnalysisService.processURL(url, options);
      setResults(prev => [result, ...prev]);
      showToast(result);
      return result;
    } finally {
      setAnalyzing(false);
    }
  };

  const loadTicketAnalyses = async (ticketId: string) => {
    try {
      const analyses = await multimediaAnalysisService.getTicketAnalyses(ticketId);
      setResults(analyses);
    } catch (error) {
      console.error('Erro ao carregar análises:', error);
    }
  };

  const refreshStats = async (clientId: string) => {
    try {
      const newStats = await multimediaAnalysisService.getProcessingStats(clientId);
      setStats(newStats);
    } catch (error) {
      console.error('Erro ao carregar estatísticas:', error);
    }
  };

  // Carregar estatísticas ao inicializar
  useEffect(() => {
    if (clientId) {
      refreshStats(clientId);
    }
  }, [clientId]);

  return {
    analyzing,
    results,
    stats,
    processImage,
    processAudio,
    processVideo,
    processDocument,
    processURL,
    loadTicketAnalyses,
    refreshStats
  };
};