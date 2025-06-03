import React from 'react';
import useReadingProgress from './hooks/useReadingProgress';

interface ReadingProgressBarProps {
  color?: string;
  height?: number;
  zIndex?: number;
}

const ReadingProgressBar: React.FC<ReadingProgressBarProps> = ({
  color = '#3b82f6', // Default blue color
  height = 4, // Default height in pixels
  zIndex = 1000, // Default z-index
}) => {
  const progress = useReadingProgress();
  
  return (
    <div 
      className="reading-progress-bar fixed top-0 left-0 w-full shadow-sm"
      style={{ 
        height: `${height}px`,
        backgroundColor: 'rgba(0, 0, 0, 0.1)',
        zIndex: zIndex
      }}
      aria-hidden="true"
      role="progressbar"
      aria-valuenow={Math.round(progress)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className="h-full"
        style={{ 
          width: `${progress}%`,
          backgroundColor: color,
          transition: 'width 0.1s ease-out',
          borderTopRightRadius: '2px',
          borderBottomRightRadius: '2px',
          boxShadow: progress > 0 ? '0 0 3px rgba(59, 130, 246, 0.5)' : 'none'
        }}
      />
    </div>
  );
};

export default ReadingProgressBar; 