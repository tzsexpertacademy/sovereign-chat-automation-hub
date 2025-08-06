import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, X, BookOpen } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent } from "@/components/ui/card";
import { OnboardingSlide } from './OnboardingSlide';
import { BasicSetupSlide } from './slides/BasicSetupSlide';
import { HumanizationSlide } from './slides/HumanizationSlide';
import { FunnelSystemSlide } from './slides/FunnelSystemSlide';
import { QueuesSystemSlide } from './slides/QueuesSystemSlide';
import { BookingSystemSlide } from './slides/BookingSystemSlide';
import { AdvancedFeaturesSlide } from './slides/AdvancedFeaturesSlide';

interface OnboardingGuideProps {
  clientId: string;
}

const slides = [
  {
    id: 'basic-setup',
    title: 'Configure Seu Primeiro Assistente',
    component: BasicSetupSlide,
    description: 'Aprenda a configurar seu primeiro assistente em 3 passos simples'
  },
  {
    id: 'humanization',
    title: 'Qualidades da Humanização',
    component: HumanizationSlide,
    description: 'Descubra como tornar sua IA mais humana e natural'
  },
  {
    id: 'funnel-system',
    title: 'Sistema de Funil Visual',
    component: FunnelSystemSlide,
    description: 'Gerencie leads através do sistema Kanban de estágios'
  },
  {
    id: 'queues-system',
    title: 'Sistema de Filas Inteligente',
    component: QueuesSystemSlide,
    description: 'Organize atendimento com distribuição automática'
  },
  {
    id: 'booking-system',
    title: 'Agendamentos Integrados',
    component: BookingSystemSlide,
    description: 'Configure e gerencie agendamentos automáticos'
  },
  {
    id: 'advanced-features',
    title: 'Recursos Avançados',
    component: AdvancedFeaturesSlide,
    description: 'Explore todas as funcionalidades avançadas'
  }
];

export const OnboardingGuide: React.FC<OnboardingGuideProps> = ({ clientId }) => {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isCompleted, setIsCompleted] = useState(false);

  // Load progress from localStorage
  useEffect(() => {
    const savedProgress = localStorage.getItem(`onboarding-progress-${clientId}`);
    if (savedProgress) {
      const { slideIndex, completed } = JSON.parse(savedProgress);
      setCurrentSlide(slideIndex);
      setIsCompleted(completed);
    }
  }, [clientId]);

  // Save progress to localStorage
  useEffect(() => {
    const progress = {
      slideIndex: currentSlide,
      completed: isCompleted,
      lastAccessed: new Date().toISOString()
    };
    localStorage.setItem(`onboarding-progress-${clientId}`, JSON.stringify(progress));
  }, [currentSlide, isCompleted, clientId]);

  const nextSlide = () => {
    if (currentSlide < slides.length - 1) {
      setCurrentSlide(currentSlide + 1);
    } else {
      setIsCompleted(true);
    }
  };

  const prevSlide = () => {
    if (currentSlide > 0) {
      setCurrentSlide(currentSlide - 1);
    }
  };

  const goToSlide = (index: number) => {
    setCurrentSlide(index);
  };

  const resetTour = () => {
    setCurrentSlide(0);
    setIsCompleted(false);
    localStorage.removeItem(`onboarding-progress-${clientId}`);
  };

  const progress = ((currentSlide + 1) / slides.length) * 100;
  const CurrentSlideComponent = slides[currentSlide].component;

  if (isCompleted) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <Card className="w-full max-w-2xl">
          <CardContent className="p-8 text-center">
            <div className="mb-6">
              <BookOpen className="h-16 w-16 mx-auto text-primary mb-4" />
              <h1 className="text-3xl font-bold text-foreground mb-2">
                Tour Concluído! 🎉
              </h1>
              <p className="text-muted-foreground text-lg">
                Você agora conhece todos os recursos da plataforma YumerFlow
              </p>
            </div>
            
            <div className="space-y-4">
              <Button onClick={resetTour} variant="outline" className="w-full">
                Refazer o Tour
              </Button>
              <Button 
                onClick={() => window.location.href = `/client/${clientId}/dashboard`}
                className="w-full"
              >
                Ir para o Dashboard
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header with Progress */}
      <div className="bg-card border-b border-border p-4">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-3">
              <BookOpen className="h-6 w-6 text-primary" />
              <h1 className="text-xl font-semibold text-foreground">
                Comece por Aqui - Tour Guiado
              </h1>
            </div>
            <div className="text-sm text-muted-foreground">
              {currentSlide + 1} de {slides.length}
            </div>
          </div>
          
          <Progress value={progress} className="h-2" />
          
          <div className="flex items-center justify-between mt-4">
            <h2 className="text-lg font-medium text-foreground">
              {slides[currentSlide].title}
            </h2>
            <p className="text-sm text-muted-foreground max-w-md">
              {slides[currentSlide].description}
            </p>
          </div>
        </div>
      </div>

      {/* Slide Content */}
      <div className="max-w-6xl mx-auto p-6">
        <OnboardingSlide>
          <CurrentSlideComponent clientId={clientId} />
        </OnboardingSlide>
      </div>

      {/* Navigation */}
      <div className="fixed bottom-0 left-0 right-0 bg-card border-t border-border p-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          {/* Slide Indicators */}
          <div className="flex space-x-2">
            {slides.map((_, index) => (
              <button
                key={index}
                onClick={() => goToSlide(index)}
                className={`w-3 h-3 rounded-full transition-colors ${
                  index === currentSlide 
                    ? 'bg-primary' 
                    : index < currentSlide 
                      ? 'bg-primary/60' 
                      : 'bg-border'
                }`}
              />
            ))}
          </div>

          {/* Navigation Buttons */}
          <div className="flex space-x-3">
            <Button
              variant="outline"
              onClick={prevSlide}
              disabled={currentSlide === 0}
              className="flex items-center space-x-2"
            >
              <ChevronLeft className="h-4 w-4" />
              <span>Anterior</span>
            </Button>
            
            <Button
              onClick={nextSlide}
              className="flex items-center space-x-2"
            >
              <span>
                {currentSlide === slides.length - 1 ? 'Finalizar' : 'Próximo'}
              </span>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Quick Skip Button */}
      <div className="fixed top-4 right-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setIsCompleted(true)}
          className="text-muted-foreground hover:text-foreground"
        >
          <X className="h-4 w-4 mr-2" />
          Pular Tour
        </Button>
      </div>
    </div>
  );
};