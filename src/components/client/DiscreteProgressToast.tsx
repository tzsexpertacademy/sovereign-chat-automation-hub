import React, { useState, useEffect } from 'react';
import { Progress } from "@/components/ui/progress";
import { CheckCircle, RefreshCw, AlertCircle, X } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface DiscreteProgressToastProps {
  progress: {
    current: number;
    total: number;
    message: string;
  };
  isVisible: boolean;
  onDismiss?: () => void;
}

const DiscreteProgressToast = ({ progress, isVisible, onDismiss }: DiscreteProgressToastProps) => {
  const [shouldShow, setShouldShow] = useState(false);
  const isCompleted = progress.current >= progress.total;
  const progressPercentage = Math.round((progress.current / progress.total) * 100);
  const isError = progress.message.toLowerCase().includes('erro');

  useEffect(() => {
    if (isVisible) {
      setShouldShow(true);
    } else {
      // Delay na saída para suavizar
      const timer = setTimeout(() => setShouldShow(false), 300);
      return () => clearTimeout(timer);
    }
  }, [isVisible]);

  // Auto dismiss quando completo
  useEffect(() => {
    if (isCompleted && isVisible) {
      const timer = setTimeout(() => {
        onDismiss?.();
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [isCompleted, isVisible, onDismiss]);

  if (!shouldShow) return null;

  return (
    <div className={`fixed bottom-4 right-4 z-50 transition-all duration-300 ${
      isVisible ? 'animate-in slide-in-from-bottom-2' : 'animate-out slide-out-to-bottom-2'
    }`}>
      <Card className="w-72 shadow-md border bg-background/95 backdrop-blur-sm">
        <CardContent className="p-3">
          <div className="flex items-start space-x-3">
            <div className="flex-shrink-0 mt-0.5">
              {isCompleted ? (
                <CheckCircle className="w-4 h-4 text-emerald-500" />
              ) : isError ? (
                <AlertCircle className="w-4 h-4 text-destructive" />
              ) : (
                <RefreshCw className="w-4 h-4 text-primary animate-spin" />
              )}
            </div>
            
            <div className="flex-1 space-y-2 min-w-0">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium truncate">
                  {isCompleted ? '✓ Concluído' : 'Importando...'}
                </p>
                <div className="flex items-center space-x-2">
                  <span className="text-xs text-muted-foreground">
                    {progressPercentage}%
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={onDismiss}
                    className="h-5 w-5 p-0 text-muted-foreground hover:text-foreground"
                  >
                    <X className="w-3 h-3" />
                  </Button>
                </div>
              </div>
              
              <Progress value={progressPercentage} className="h-1.5" />
              
              <p className="text-xs text-muted-foreground line-clamp-2">
                {progress.message}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default DiscreteProgressToast;