import React from 'react';
import { motion } from 'framer-motion';

// Reuse the BlogIndexItem type or define a specific one if needed
type BlogIndexItem = {
  slug: string;
  title: string;
  featuredImage?: string;
  featuredImageAlt?: string;
  publishDate: string;
};

type RelatedPostsProps = {
  posts: BlogIndexItem[];
};

const RelatedPosts: React.FC<RelatedPostsProps> = ({ posts }) => {
  // Function to decode HTML entities (same as in BlogPostDetail)
  const decodeHtml = (html: string) => {
    const textarea = document.createElement('textarea');
    textarea.innerHTML = html;
    return textarea.value;
  };

  // Function to format date (simplified or reuse from a util)
  const formatDate = (dateString: string) => {
    if (!dateString) return '';
    const options: Intl.DateTimeFormatOptions = { year: 'numeric', month: 'short', day: 'numeric' };
    return new Date(dateString).toLocaleDateString('en-US', options);
  };

  // Get image path, handling both absolute URLs and relative paths
  const getImagePath = (imagePath: string | undefined) => {
    if (!imagePath) return '/images/blog/default-placeholder.png'; // Default placeholder
    if (imagePath.startsWith('http')) return imagePath;
    
    // Always return the path as is - don't try to modify it
    // The path will be like /images/blog/05-12-2025/optimized/image.webp
    return imagePath;
  };

  return (
    <div className="my-12 pt-8 border-t border-gray-800">
      <h3 className="text-2xl font-bold text-white mb-6">Related Articles</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        {posts.map((post, index) => (
          <motion.div
            key={post.slug}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: index * 0.1 }}
            className="bg-gray-900 rounded-lg overflow-hidden border border-gray-700 hover:border-blue-600 transition-colors duration-200"
          >
            <a href={`/blog/${post.slug}`} className="block group">
              <div className="h-40 bg-gray-800 overflow-hidden">
                <picture>
                  {/* Check if the path contains '/optimized/' folder which indicates we have optimized versions */}
                  {post.featuredImage && post.featuredImage.includes('/optimized/') ? (
                    <>
                      {/* Optimized image formats - AVIF first for best compression */}
                      <source
                        srcSet={getImagePath(post.featuredImage.replace(/\.webp$/, '.avif'))}
                        type="image/avif"
                      />
                      {/* WebP as fallback for browsers that don't support AVIF */}
                      <source
                        srcSet={getImagePath(post.featuredImage)}
                        type="image/webp"
                      />
                      {/* Original JPG as final fallback */}
                      <source
                        srcSet={getImagePath(post.featuredImage.replace(/\.webp$/, '-optimized.jpg'))}
                        type="image/jpeg"
                      />
                      {/* Fallback image for browsers that don't support picture */}
                      <img 
                        src={getImagePath(post.featuredImage)}
                        alt={post.featuredImageAlt || decodeHtml(post.title)}
                        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                        onError={(e) => { 
                          // Fallback to default image if loading fails
                          const target = e.target as HTMLImageElement;
                          target.onerror = null; // Prevent infinite loop
                          target.src = '/images/blog/default-placeholder.png'; 
                        }}
                      />
                    </>
                  ) : (
                    /* For non-optimized images, just render the regular img */
                    <img 
                      src={getImagePath(post.featuredImage)}
                      alt={post.featuredImageAlt || decodeHtml(post.title)}
                      className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                      onError={(e) => { 
                        // Fallback to default image if loading fails
                        const target = e.target as HTMLImageElement;
                        target.onerror = null; // Prevent infinite loop
                        target.src = '/images/blog/default-placeholder.png'; 
                      }}
                    />
                  )}
                </picture>
              </div>
              <div className="p-4">
                <h4 className="text-lg font-semibold text-white mb-2 group-hover:text-blue-400 transition-colors duration-200">
                  {decodeHtml(post.title)}
                </h4>
                <p className="text-sm text-gray-400">
                  {formatDate(post.publishDate)}
                </p>
              </div>
            </a>
          </motion.div>
        ))}
      </div>
    </div>
  );
};

export default RelatedPosts; 