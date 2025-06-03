import React, { useState } from 'react';
import { TocItem } from './hooks/useTableOfContents';

interface MobileTableOfContentsProps {
  tocItems: TocItem[];
  activeHeading?: string;
}

const MobileTableOfContents: React.FC<MobileTableOfContentsProps> = ({ tocItems, activeHeading }) => {
  const [isOpen, setIsOpen] = useState(false);
  
  // Scroll to heading when TOC item is clicked
  const scrollToHeading = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
      // Close the mobile TOC after clicking
      setIsOpen(false);
    }
  };
  
  // Render empty component if no TOC items
  if (tocItems.length === 0) {
    return null;
  }
  
  return (
    <div className="md:hidden relative">
      {/* Toggle button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-6 right-6 z-50 bg-blue-600 text-white p-3 rounded-full shadow-lg hover:bg-blue-700 transition-colors"
        aria-label={isOpen ? "Close table of contents" : "Open table of contents"}
      >
        <svg 
          xmlns="http://www.w3.org/2000/svg" 
          className="h-6 w-6" 
          fill="none" 
          viewBox="0 0 24 24" 
          stroke="currentColor"
        >
          <path 
            strokeLinecap="round" 
            strokeLinejoin="round" 
            strokeWidth={2} 
            d={isOpen 
              ? "M6 18L18 6M6 6l12 12" // X icon
              : "M4 6h16M4 12h16M4 18h16" // Menu icon
            } 
          />
        </svg>
      </button>

      {/* Mobile TOC panel */}
      {isOpen && (
        <div className="fixed inset-0 z-40 bg-black bg-opacity-80 flex items-center justify-center p-4">
          <div className="bg-gray-900 rounded-lg p-6 w-full max-w-md max-h-[80vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold text-white">Table of Contents</h3>
              <button
                onClick={() => setIsOpen(false)}
                className="text-gray-400 hover:text-white"
                aria-label="Close table of contents"
              >
                <svg 
                  xmlns="http://www.w3.org/2000/svg" 
                  className="h-6 w-6" 
                  fill="none" 
                  viewBox="0 0 24 24" 
                  stroke="currentColor"
                >
                  <path 
                    strokeLinecap="round" 
                    strokeLinejoin="round" 
                    strokeWidth={2} 
                    d="M6 18L18 6M6 6l12 12" 
                  />
                </svg>
              </button>
            </div>
            
            <nav>
              <ul className="space-y-3">
                {tocItems.map((item) => (
                  <li 
                    key={item.id}
                    className={`
                      ${item.level === 3 ? 'ml-6' : ''} 
                      ${activeHeading === item.id ? 'text-blue-400' : 'text-gray-300'}
                    `}
                  >
                    <a
                      href={`#${item.id}`}
                      onClick={(e) => {
                        e.preventDefault();
                        scrollToHeading(item.id);
                      }}
                      className={`
                        block hover:text-blue-300 transition-colors py-1
                        ${activeHeading === item.id ? 'font-semibold' : ''}
                        ${item.level === 3 ? 'text-sm' : ''}
                      `}
                    >
                      {item.level === 2 
                        ? `${item.position}. ${item.text}` 
                        : item.text}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
          </div>
        </div>
      )}
    </div>
  );
};

export default MobileTableOfContents; 