import React, { useState, useEffect, useRef } from 'react';

interface TypingEffectProps {
  text: string;
  speed?: number;
  delay?: number;
  className?: string;
  onComplete?: () => void;
}

const TypingEffect: React.FC<TypingEffectProps> = ({
  text,
  speed = 50,
  delay = 0,
  className = "",
  onComplete
}) => {
  const [displayedText, setDisplayedText] = useState('');
  const [isComplete, setIsComplete] = useState(false);
  const [showCursor, setShowCursor] = useState(true);
  const indexRef = useRef(0);

  useEffect(() => {
    // Reset state when text changes
    setDisplayedText('');
    setIsComplete(false);
    indexRef.current = 0;

    const startTimeout = setTimeout(() => {
      const typingInterval = setInterval(() => {
        if (indexRef.current < text.length) {
          setDisplayedText(text.slice(0, indexRef.current + 1));
          indexRef.current += 1;
        } else {
          clearInterval(typingInterval);
          setIsComplete(true);
          onComplete?.();
        }
      }, speed);

      return () => clearInterval(typingInterval);
    }, delay);

    return () => clearTimeout(startTimeout);
  }, [text, speed, delay, onComplete]);

  // Cursor blinking effect
  useEffect(() => {
    const cursorInterval = setInterval(() => {
      setShowCursor(prev => !prev);
    }, 500);

    return () => clearInterval(cursorInterval);
  }, []);

  return (
    <span className={className}>
      {displayedText}
      {!isComplete && (
        <span className={`inline-block w-0.5 h-[1em] bg-current ml-1 ${showCursor ? 'opacity-100' : 'opacity-0'} transition-opacity`}>
        </span>
      )}
    </span>
  );
};

export default TypingEffect;