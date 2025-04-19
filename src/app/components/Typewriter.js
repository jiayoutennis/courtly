import { useState, useEffect } from 'react';

const useTypewriter = (text, speed = 75) => {
  const [displayedText, setDisplayedText] = useState('');

  useEffect(() => {
    let i = 0;
    const interval = setInterval(() => {
      setDisplayedText(prev => prev + text.charAt(i));
      i++;
      if (i === text.length) clearInterval(interval);
    }, speed);

    return () => clearInterval(interval);
  }, [text, speed]);

  return displayedText;
};

const Typewriter = ({ text, speed = 75, className = '' }) => {
  const typed = useTypewriter(text, speed);
  return <span className={className}>{typed}</span>;
};

export default Typewriter;
