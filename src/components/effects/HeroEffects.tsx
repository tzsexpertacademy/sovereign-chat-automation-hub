import React, { useEffect, useRef, useState } from 'react';

interface HeroEffectsProps {
  children: React.ReactNode;
  backgroundImage: string;
}

const HeroEffects: React.FC<HeroEffectsProps> = ({ children, backgroundImage }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Array<{
    x: number;
    y: number;
    vx: number;
    vy: number;
    size: number;
    life: number;
    maxLife: number;
  }>>([]);
  const animationFrameRef = useRef<number>();
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resizeCanvas = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    // Initialize hero particles (larger and more visible)
    for (let i = 0; i < 30; i++) {
      particlesRef.current.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * 0.3,
        vy: (Math.random() - 0.5) * 0.3,
        size: Math.random() * 3 + 1,
        life: Math.random() * 200,
        maxLife: 200 + Math.random() * 100
      });
    }

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      // Create scanning effect
      const time = Date.now() * 0.001;
      const scanY = Math.sin(time * 0.5) * canvas.height * 0.8 + canvas.height * 0.5;
      
      // Draw scan line
      const gradient = ctx.createLinearGradient(0, scanY - 50, 0, scanY + 50);
      gradient.addColorStop(0, 'rgba(168, 85, 247, 0)');
      gradient.addColorStop(0.5, 'rgba(168, 85, 247, 0.3)');
      gradient.addColorStop(1, 'rgba(168, 85, 247, 0)');
      
      ctx.fillStyle = gradient;
      ctx.fillRect(0, scanY - 50, canvas.width, 100);

      // Draw connections between particles
      ctx.strokeStyle = 'rgba(168, 85, 247, 0.2)';
      ctx.lineWidth = 1.5;
      
      for (let i = 0; i < particlesRef.current.length; i++) {
        for (let j = i + 1; j < particlesRef.current.length; j++) {
          const dx = particlesRef.current[i].x - particlesRef.current[j].x;
          const dy = particlesRef.current[i].y - particlesRef.current[j].y;
          const distance = Math.sqrt(dx * dx + dy * dy);
          
          if (distance < 150) {
            const opacity = (150 - distance) / 150 * 0.4;
            ctx.strokeStyle = `rgba(168, 85, 247, ${opacity})`;
            ctx.beginPath();
            ctx.moveTo(particlesRef.current[i].x, particlesRef.current[i].y);
            ctx.lineTo(particlesRef.current[j].x, particlesRef.current[j].y);
            ctx.stroke();
          }
        }
      }

      // Update and draw particles
      particlesRef.current.forEach((particle) => {
        particle.x += particle.vx;
        particle.y += particle.vy;
        particle.life++;

        // Wrap around edges
        if (particle.x < 0) particle.x = canvas.width;
        if (particle.x > canvas.width) particle.x = 0;
        if (particle.y < 0) particle.y = canvas.height;
        if (particle.y > canvas.height) particle.y = 0;

        // Reset particle if life exceeded
        if (particle.life > particle.maxLife) {
          particle.life = 0;
          particle.x = Math.random() * canvas.width;
          particle.y = Math.random() * canvas.height;
        }

        // Draw particle with glow
        const opacity = Math.sin((particle.life / particle.maxLife) * Math.PI) * 0.8;
        
        // Glow effect
        ctx.shadowColor = 'rgba(168, 85, 247, 0.8)';
        ctx.shadowBlur = 15;
        ctx.fillStyle = `rgba(168, 85, 247, ${opacity})`;
        ctx.beginPath();
        ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
        ctx.fill();
        
        // Reset shadow
        ctx.shadowBlur = 0;
      });

      animationFrameRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      window.removeEventListener('resize', resizeCanvas);
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  // Mouse tracking for parallax and holographic effects
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        const x = (e.clientX - rect.left) / rect.width;
        const y = (e.clientY - rect.top) / rect.height;
        setMousePos({ x, y });
      }
    };

    const container = containerRef.current;
    if (container) {
      container.addEventListener('mousemove', handleMouseMove);
      return () => container.removeEventListener('mousemove', handleMouseMove);
    }
  }, []);

  // Scroll-based parallax effect
  useEffect(() => {
    const handleScroll = () => {
      const scrolled = window.pageYOffset;
      const parallax = scrolled * 0.3;
      
      if (imageRef.current) {
        imageRef.current.style.transform = `translate3d(0, ${parallax}px, 0) scale(1.1)`;
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div ref={containerRef} className="relative min-h-screen overflow-hidden">
      {/* Background Image with Effects */}
      <div className="absolute inset-0">
        <img 
          ref={imageRef}
          src={backgroundImage} 
          alt="Hero Background" 
          className="absolute inset-0 w-full h-full object-cover opacity-30 transition-transform duration-1000 ease-out"
          style={{
            filter: 'contrast(1.1) brightness(0.9)',
          }}
        />
        
        {/* Animated Gradient Overlay */}
        <div 
          className="absolute inset-0 opacity-60"
          style={{
            background: `
              radial-gradient(
                circle at ${mousePos.x * 100}% ${mousePos.y * 100}%, 
                rgba(168, 85, 247, 0.3) 0%, 
                rgba(236, 72, 153, 0.2) 30%, 
                rgba(59, 130, 246, 0.1) 60%, 
                transparent 100%
              )
            `,
            transition: 'background 0.3s ease-out'
          }}
        />

        {/* Static Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-br from-purple-900/40 via-fuchsia-900/30 to-blue-900/20" />
        
        {/* Holographic Reflection Effect */}
        <div 
          className="absolute inset-0 opacity-20 pointer-events-none"
          style={{
            background: `
              linear-gradient(
                ${45 + mousePos.x * 90}deg,
                transparent 0%,
                rgba(255, 255, 255, 0.1) ${40 + mousePos.y * 20}%,
                rgba(168, 85, 247, 0.2) ${50 + mousePos.y * 20}%,
                rgba(236, 72, 153, 0.15) ${60 + mousePos.y * 20}%,
                transparent 100%
              )
            `,
            transition: 'background 0.5s ease-out'
          }}
        />
      </div>

      {/* Hero Particles Canvas */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 pointer-events-none z-10"
        style={{ opacity: 0.7 }}
      />

      {/* Pulse Animation Overlay */}
      <div className="absolute inset-0 z-20">
        <div className="absolute inset-0 bg-gradient-to-r from-purple-500/5 to-fuchsia-500/5 animate-pulse" />
      </div>

      {/* Glitch Effect (subtle) */}
      <div className="absolute inset-0 z-30 opacity-0 animate-[glitch_15s_infinite]">
        <div className="absolute inset-0 bg-gradient-to-r from-red-500/10 to-blue-500/10 mix-blend-screen" />
      </div>

      {/* Content */}
      <div className="relative z-40">
        {children}
      </div>
    </div>
  );
};

export default HeroEffects;