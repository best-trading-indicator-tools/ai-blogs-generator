import { useState, useEffect, useCallback } from 'react';

export interface TocItem {
  id: string;
  text: string;
  level: number;
  position: number;
}

/**
 * Custom hook to generate a table of contents from HTML content
 * @param content HTML content with h2 and h3 headings
 * @returns Array of TOC items and a function to process content (adding IDs to headings)
 */
export function useTableOfContents(content: string) {
  const [tocItems, setTocItems] = useState<TocItem[]>([]);
  
  // Process the content to extract TOC items
  useEffect(() => {
    if (!content) {
      setTocItems([]);
      return;
    }
    
    // Create a temporary div to parse the HTML
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = content;
    
    // Find all h2 and h3 headings
    const headings = tempDiv.querySelectorAll('h2, h3');
    
    // Generate TOC items
    const items: TocItem[] = [];
    let h2Count = 0;
    
    // First pass: collect all headings and analyze text content
    // to identify and fix any numbering issues
    headings.forEach((heading) => {
      // Generate unique ID if not present
      if (!heading.id) {
        const headingText = heading.textContent || '';
        const id = headingText
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/(^-|-$)/g, '');
        
        heading.id = id;
      }
      
      const level = heading.tagName.toLowerCase() === 'h2' ? 2 : 3;
      const text = heading.textContent || '';
      
      // Strip any existing numbers from the beginning of the heading text
      // (to avoid duplicates like "2. 1. Flavored Yogurt")
      // But preserve time formats like "7:30 AM" or "10:00 PM"
      const cleanedText = text.replace(/^\d+\.\s*(?!\d+:\d+)/, '').trim();
      
      // Update h2 counter only for h2 headings
      if (level === 2) {
        h2Count++;
      }
      
      // Create TOC item (position is handled below)
      items.push({
        id: heading.id,
        text: cleanedText,
        level,
        position: level === 2 ? h2Count : 0 // Placeholder for h3s
      });
    });
    
    setTocItems(items);
  }, [content]);
  
  /**
   * Process HTML content to add IDs to headings and custom styling
   */
  const processContent = useCallback((htmlContent: string): string => {
    if (!htmlContent) return '';
    
    // Create a temporary div to parse the HTML
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = htmlContent;
    
    // Find all h2 and h3 headings
    const headings = tempDiv.querySelectorAll('h2, h3');
    
    // Add IDs to headings that don't have them
    headings.forEach((heading) => {
      if (!heading.id) {
        const headingText = heading.textContent || '';
        const id = headingText
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/(^-|-$)/g, '');
        
        heading.id = id;
      }
      
      // Clean up any existing numbering in the actual heading text
      // But preserve time formats like "7:30 AM" or "10:00 PM"
      const cleanedText = heading.textContent?.replace(/^\d+\.\s*(?!\d+:\d+)/, '').trim();
      if (cleanedText && cleanedText !== heading.textContent) {
        heading.textContent = cleanedText;
      }
      
      // Add scroll margin for better scrolling behavior
      heading.classList.add('scroll-mt-24');
    });
    
    return tempDiv.innerHTML;
  }, []);
  
  return {
    tocItems,
    processContent
  };
}

export default useTableOfContents; 