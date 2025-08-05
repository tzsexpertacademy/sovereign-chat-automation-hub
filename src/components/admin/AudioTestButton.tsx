import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { directMediaDownloadService } from '@/services/directMediaDownloadService';
import { toast } from 'sonner';
import { TestTube } from 'lucide-react';

export const AudioTestButton = () => {
  const [testing, setTesting] = useState(false);

  const testDirectMediaService = async () => {
    setTesting(true);
    
    try {
      console.log('🛑 [TEST] SERVIÇO DESATIVADO - useAudioAutoProcessor centraliza processamento');
      
      // Verificar cache e estatísticas apenas
      const stats = directMediaDownloadService.getCacheStats();
      console.log('📊 [TEST] Estatísticas do cache:', stats);
      
      toast.success('Cache verificado! useAudioAutoProcessor processa automaticamente ✅');

    } catch (error) {
      console.error('🧪 [TEST] Erro no teste:', error);
      toast.error(`Erro no teste: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
    } finally {
      setTesting(false);
    }
  };

  return (
    <Button 
      onClick={testDirectMediaService}
      disabled={testing}
      variant="outline"
      size="sm"
    >
      <TestTube className="h-4 w-4 mr-2" />
      {testing ? 'Testando...' : 'Testar DirectMedia Service'}
    </Button>
  );
};