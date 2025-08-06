import React from 'react';

interface OnboardingSlideProps {
  children: React.ReactNode;
}

export const OnboardingSlide: React.FC<OnboardingSlideProps> = ({ children }) => {
  return (
    <div className="animate-fade-in">
      {children}
    </div>
  );
};