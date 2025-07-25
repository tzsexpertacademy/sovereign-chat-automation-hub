import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Props {
  children: React.ReactNode;
  fallbackTitle?: string;
  fallbackMessage?: string;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class SafeComponent extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('🚨 [SafeComponent] Erro capturado:', error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: undefined });
  };

  render() {
    if (this.state.hasError) {
      return (
        <Card className="border-destructive">
          <CardHeader className="text-center pb-2">
            <div className="mx-auto mb-2 w-10 h-10 rounded-full bg-destructive/10 flex items-center justify-center">
              <AlertTriangle className="h-5 w-5 text-destructive" />
            </div>
            <CardTitle className="text-destructive text-lg">
              {this.props.fallbackTitle || 'Erro no Componente'}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-center space-y-3">
            <p className="text-sm text-muted-foreground">
              {this.props.fallbackMessage || 'Este componente encontrou um erro e não pode ser exibido.'}
            </p>
            
            {process.env.NODE_ENV === 'development' && this.state.error && (
              <div className="text-left p-2 bg-muted rounded text-xs font-mono">
                {this.state.error.message}
              </div>
            )}

            <Button onClick={this.handleRetry} size="sm" className="gap-2">
              <RefreshCw className="h-3 w-3" />
              Tentar Novamente
            </Button>
          </CardContent>
        </Card>
      );
    }

    return this.props.children;
  }
}

export default SafeComponent;