import React, { useRef, useState } from 'react';
import { cn } from '@/lib/utils';

interface HolographicCardProps {
  children: React.ReactNode;
  className?: string;
  intensity?: number;
}

const HolographicCard: React.FC<HolographicCardProps> = ({ 
  children, 
  className = "",
  intensity = 0.3 
}) => {
  const cardRef = useRef<HTMLDivElement>(null);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [isHovered, setIsHovered] = useState(false);

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!cardRef.current) return;
    
    const rect = cardRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    setMousePosition({ x, y });
  };

  const handleMouseEnter = () => {
    setIsHovered(true);
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
    setMousePosition({ x: 0, y: 0 });
  };

  const gradientStyle = isHovered ? {
    background: `radial-gradient(600px circle at ${mousePosition.x}px ${mousePosition.y}px, rgba(168, 85, 247, ${intensity}), rgba(217, 70, 239, ${intensity * 0.5}), transparent 40%)`,
  } : {};

  return (
    <div 
      ref={cardRef}
      className={cn(
        "relative overflow-hidden transition-all duration-300",
        isHovered && "scale-[1.02]",
        className
      )}
      onMouseMove={handleMouseMove}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Holographic overlay */}
      <div 
        className="absolute inset-0 opacity-0 hover:opacity-100 transition-opacity duration-300 pointer-events-none"
        style={gradientStyle}
      />
      
      {/* Scanning line effect */}
      {isHovered && (
        <div 
          className="absolute inset-0 pointer-events-none"
          style={{
            background: `linear-gradient(90deg, transparent, rgba(168, 85, 247, 0.2), transparent)`,
            transform: `translateX(${(mousePosition.x / (cardRef.current?.offsetWidth || 1)) * 100 - 50}%)`,
            transition: 'transform 0.3s ease'
          }}
        />
      )}
      
      {/* Content */}
      <div className="relative z-10">
        {children}
      </div>
    </div>
  );
};

export default HolographicCard;