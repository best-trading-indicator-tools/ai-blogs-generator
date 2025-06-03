import { useState, useEffect } from 'react';

/**
 * Custom hook to track reading progress as user scrolls through content
 * @returns Current reading progress as a number between 0 and 100
 */
const useReadingProgress = (): number => {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const calculateProgress = () => {
      // Method 1: Calculate based on article element if available
      const articleElement = document.querySelector('.prose');
      
      if (articleElement) {
        // Get the article's position and dimensions
        const articleRect = articleElement.getBoundingClientRect();
        const articleTop = articleRect.top + window.scrollY;
        const articleHeight = articleRect.height;
        
        // Get viewport height
        const viewportHeight = window.innerHeight;
        
        // Calculate how much of the article has been scrolled past
        const distanceFromTop = window.scrollY + viewportHeight - articleTop;
        
        // Calculate the total scrollable distance (article height + viewport height)
        const totalScrollableDistance = articleHeight + viewportHeight;
        
        // Calculate progress percentage
        let progressPercent = (distanceFromTop / totalScrollableDistance) * 100;
        
        // Clamp progress between 0 and 100
        progressPercent = Math.max(0, Math.min(100, progressPercent));
        
        setProgress(progressPercent);
        return;
      }
      
      // Method 2: Fallback - calculate based on entire document if article element not found
      const windowHeight = window.innerHeight;
      const documentHeight = Math.max(
        document.body.scrollHeight,
        document.documentElement.scrollHeight,
        document.body.offsetHeight,
        document.documentElement.offsetHeight,
        document.body.clientHeight,
        document.documentElement.clientHeight
      );
      
      // Calculate the scrollable area (document height minus window height)
      const scrollableHeight = documentHeight - windowHeight;
      
      // Calculate progress percentage based on current scroll position
      const calculatedProgress = (window.scrollY / scrollableHeight) * 100;
      
      // Clamp progress between 0 and 100
      setProgress(Math.max(0, Math.min(100, calculatedProgress)));
    };

    // Calculate initial progress
    calculateProgress();
    
    // Add scroll event listener
    window.addEventListener('scroll', calculateProgress);
    
    // Recalculate on window resize as dimensions might change
    window.addEventListener('resize', calculateProgress);
    
    // Clean up
    return () => {
      window.removeEventListener('scroll', calculateProgress);
      window.removeEventListener('resize', calculateProgress);
    };
  }, []);

  return progress;
};

export default useReadingProgress; 