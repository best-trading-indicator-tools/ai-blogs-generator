import { useState, useEffect } from 'react';

interface ActiveHeadingTrackerProps {
  onHeadingChange: (activeId: string | null) => void;
}

const ActiveHeadingTracker = ({ onHeadingChange }: ActiveHeadingTrackerProps) => {
  const [headingElements, setHeadingElements] = useState<HTMLElement[]>([]);

  // Find and track all headings in the document
  useEffect(() => {
    // Get all h2 and h3 elements from the actual rendered document
    const headings = Array.from(document.querySelectorAll('h2, h3'));
    setHeadingElements(headings as HTMLElement[]);
  }, []);

  // Set up IntersectionObserver for headings
  useEffect(() => {
    if (headingElements.length === 0) return;

    const observerOptions = {
      rootMargin: '-100px 0px -70% 0px', // Offset to determine when a heading is "active"
      threshold: 0
    };

    // Check which headings are visible
    const observerCallback: IntersectionObserverCallback = (entries) => {
      // Find visible headings
      const visibleHeadings = entries
        .filter(entry => entry.isIntersecting)
        .map(entry => entry.target);

      if (visibleHeadings.length > 0) {
        // Use the first visible heading as the active one
        const activeHeading = visibleHeadings[0];
        onHeadingChange(activeHeading.id);
        
        // Add 'active-heading' class to the active heading
        headingElements.forEach(el => {
          if (el.id === activeHeading.id) {
            el.classList.add('active-heading');
          } else {
            el.classList.remove('active-heading');
          }
        });
      } else {
        // No headings are intersecting, set activeId to null
        onHeadingChange(null);
        // Remove 'active-heading' from all previously active headings
        headingElements.forEach(el => {
          el.classList.remove('active-heading');
        });
      }
    };

    const observer = new IntersectionObserver(observerCallback, observerOptions);

    // Observe all heading elements
    headingElements.forEach(element => observer.observe(element));

    // Clean up
    return () => observer.disconnect();
  }, [headingElements, onHeadingChange]);

  // This component doesn't render anything
  return null;
};

export default ActiveHeadingTracker; 