import React from 'react';
import { TocItem } from './hooks/useTableOfContents';

interface TableOfContentsProps {
  tocItems: TocItem[];
  activeHeading?: string;
}

const TableOfContents: React.FC<TableOfContentsProps> = ({ tocItems, activeHeading }) => {
  // Scroll to heading when TOC item is clicked
  const scrollToHeading = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };
  
  // Render empty component if no TOC items
  if (tocItems.length === 0) {
    return null;
  }
  
  return (
    <div className="table-of-contents sticky top-24 max-h-[80vh] overflow-y-auto p-4 bg-gray-900 bg-opacity-80 rounded-lg">
      <h3 className="text-xl font-bold text-white mb-4">Table of Contents</h3>
      <nav>
        <ul className="space-y-2">
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
                  block hover:text-blue-300 transition-colors
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
  );
};

export default TableOfContents; 