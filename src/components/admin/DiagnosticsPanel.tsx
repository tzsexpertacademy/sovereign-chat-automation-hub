import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { UnprocessedMessagesPanel } from "../client/UnprocessedMessagesPanel";
import { MessageProcessingTestPanel } from "../client/MessageProcessingTestPanel";
import AIAutoProcessorStatus from "../client/AIAutoProcessorStatus";
import { Settings, Wrench, AlertTriangle } from "lucide-react";

interface DiagnosticsPanelProps {
  clientId: string;
}

const DiagnosticsPanel = ({ clientId }: DiagnosticsPanelProps) => {
  return (
    <div className="space-y-6">
      {/* Header */}
      <Card className="border-orange-200 bg-gradient-to-r from-orange-50 to-yellow-50">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2 text-orange-800">
            <Wrench className="h-5 w-5" />
            <span>Painel de Diagnósticos</span>
          </CardTitle>
          <CardDescription className="text-orange-700">
            Ferramentas avançadas para monitoramento e resolução de problemas
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center space-x-2">
            <AlertTriangle className="h-4 w-4 text-orange-600" />
            <span className="text-sm text-orange-700">
              Esta seção é destinada para administradores e resolução de problemas técnicos
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Status do Processador Automático */}
      <AIAutoProcessorStatus clientId={clientId} />

      {/* Painéis de Diagnóstico */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <UnprocessedMessagesPanel clientId={clientId} />
        <MessageProcessingTestPanel clientId={clientId} />
      </div>
    </div>
  );
};

export default DiagnosticsPanel;