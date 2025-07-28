import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, CheckCircle, AlertTriangle, RotateCcw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface FixResult {
  success: boolean;
  message: string;
  ticketsProcessed: number;
  ticketsFixed: number;
  errors?: string[];
}

interface FixClientTicketsAssignmentProps {
  clientId: string;
}

export const FixClientTicketsAssignment = ({ clientId }: FixClientTicketsAssignmentProps) => {
  const [isFixing, setIsFixing] = useState(false);
  const [result, setResult] = useState<FixResult | null>(null);
  const { toast } = useToast();

  const handleFixTickets = async () => {
    setIsFixing(true);
    setResult(null);

    try {
      console.log('🔧 [FIX-CLIENT-TICKETS] Iniciando correção para cliente:', clientId);

      const { data, error } = await supabase.functions.invoke('fix-tickets-assignment', {
        body: { clientId }
      });

      if (error) {
        throw new Error(`Erro na função: ${error.message}`);
      }

      setResult(data);
      
      if (data.success) {
        toast({
          title: "Correção concluída!",
          description: `${data.ticketsFixed} tickets corrigidos de ${data.ticketsProcessed} processados`,
        });
      }

    } catch (error) {
      console.error('❌ [FIX-CLIENT-TICKETS] Erro:', error);
      
      toast({
        title: "Erro na correção",
        description: error.message,
        variant: "destructive"
      });
      
      setResult({
        success: false,
        message: error.message,
        ticketsProcessed: 0,
        ticketsFixed: 0
      });
    } finally {
      setIsFixing(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <RotateCcw className="h-5 w-5" />
          Corrigir Assignment de Tickets
        </CardTitle>
        <CardDescription>
          Corrige tickets que não têm fila ou assistente atribuídos automaticamente.
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-4">
        <Button 
          onClick={handleFixTickets} 
          disabled={isFixing}
          className="w-full"
          size="sm"
        >
          {isFixing ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Corrigindo tickets...
            </>
          ) : (
            <>
              <RotateCcw className="mr-2 h-4 w-4" />
              Corrigir Tickets
            </>
          )}
        </Button>

        {result && (
          <div className="space-y-3">
            <Alert className={result.success ? "border-green-200 bg-green-50" : "border-red-200 bg-red-50"}>
              <div className="flex items-center gap-2">
                {result.success ? (
                  <CheckCircle className="h-4 w-4 text-green-600" />
                ) : (
                  <AlertTriangle className="h-4 w-4 text-red-600" />
                )}
                <AlertDescription className="font-medium text-sm">
                  {result.message}
                </AlertDescription>
              </div>
            </Alert>

            {result.success && (
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="bg-blue-50 p-2 rounded">
                  <div className="font-medium text-blue-900 text-xs">Processados</div>
                  <div className="text-lg font-bold text-blue-600">{result.ticketsProcessed}</div>
                </div>
                <div className="bg-green-50 p-2 rounded">
                  <div className="font-medium text-green-900 text-xs">Corrigidos</div>
                  <div className="text-lg font-bold text-green-600">{result.ticketsFixed}</div>
                </div>
              </div>
            )}

            {result.errors && result.errors.length > 0 && (
              <Alert className="border-yellow-200 bg-yellow-50">
                <AlertTriangle className="h-4 w-4 text-yellow-600" />
                <AlertDescription>
                  <div className="font-medium text-yellow-900 mb-1 text-xs">
                    Erros encontrados ({result.errors.length}):
                  </div>
                  <ul className="text-xs text-yellow-800 space-y-1">
                    {result.errors.slice(0, 3).map((error, index) => (
                      <li key={index} className="truncate">• {error}</li>
                    ))}
                    {result.errors.length > 3 && (
                      <li className="italic">... e mais {result.errors.length - 3} erros</li>
                    )}
                  </ul>
                </AlertDescription>
              </Alert>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};