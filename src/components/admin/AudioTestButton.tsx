import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { TestTube } from 'lucide-react';

export const AudioTestButton = () => {
  const [testing, setTesting] = useState(false);

  const testEdgeFunction = async () => {
    setTesting(true);
    
    try {
      console.log('🧪 [TEST] Testando edge function whatsapp-decrypt-audio...');
      
      // Chamar a edge function com dados de teste
      const { data, error } = await supabase.functions.invoke('whatsapp-decrypt-audio', {
        body: {
          encryptedData: 'dGVzdGU=', // "teste" em base64
          mediaKey: 'dGVzdGU=',
          fileEncSha256: 'sha256test',
          messageId: 'test-message-id'
        }
      });

      console.log('🧪 [TEST] Resposta da edge function:', {
        data,
        error,
        success: data?.success,
        errorMessage: data?.error || error?.message
      });

      if (error) {
        toast.error(`Erro na edge function: ${error.message}`);
        return;
      }

      if (data?.success) {
        toast.success('Edge function funcionando! ✅');
      } else {
        toast.warning(`Edge function respondeu mas com erro: ${data?.error || 'Erro desconhecido'}`);
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
      onClick={testEdgeFunction}
      disabled={testing}
      variant="outline"
      size="sm"
    >
      <TestTube className="h-4 w-4 mr-2" />
      {testing ? 'Testando...' : 'Testar Edge Function'}
    </Button>
  );
};