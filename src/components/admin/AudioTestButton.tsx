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
      console.log('🧪 [TEST] Testando directMediaDownloadService...');
      
      // Teste básico do serviço
      const testResult = await directMediaDownloadService.downloadMedia(
        'test-instance',
        'https://example.com/test.ogg',
        'dGVzdGU=', // "teste" em base64
        '/test/path',
        'audio/ogg',
        'audio'
      );

      console.log('🧪 [TEST] Resultado do teste:', testResult);

      if (testResult.success) {
        toast.success('DirectMediaDownloadService funcionando! ✅');
        
        // Testar estatísticas do cache
        const stats = directMediaDownloadService.getCacheStats();
        console.log('📊 [TEST] Estatísticas do cache:', stats);
        
      } else {
        toast.warning(`Serviço respondeu mas com erro: ${testResult.error || 'Erro desconhecido'}`);
      }

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