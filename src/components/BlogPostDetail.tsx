import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import Header from '../Header';
import Footer from '../Footer';
import TableOfContents from './TableOfContents';
import ActiveHeadingTracker from './ActiveHeadingTracker';
import MobileTableOfContents from './MobileTableOfContents';
import useTableOfContents from './hooks/useTableOfContents';
import ReadingProgressBar from './ReadingProgressBar';
import BlogCTA from './BlogCTA';
// Import RelatedPosts component (will be created next)
import RelatedPosts from './RelatedPosts';


// Ensure the custom element and its stylesheet are loaded exactly once in the browser
// if (typeof window !== 'undefined' && !customElements.get('lite-youtube')) {
//   import('@justinribeiro/lite-youtube');

//   // Dynamically inject the lite-youtube CSS so the thumbnail shows instead of a black box
//   if (!document.head.querySelector('link[data-lite-youtube-css]')) {
//     const link = document.createElement('link');
//     link.rel = 'stylesheet';
//     // Using the package file shipped with the library (handled by bundler / dev-server)
//     link.href = 'https://unpkg.com/@justinribeiro/lite-youtube/dist/lite-youtube.css';
//     link.setAttribute('data-lite-youtube-css', 'true');
//     document.head.appendChild(link);
//   }
// }


type BlogPost = {
  title: string;
  content: string;
  contentMarkdown?: string;
  slug: string;
  publishDate: string;
  author: string;
  category: string;
  featuredImage?: string; // Optional featured image
  metaDescription?: string;
  articleId?: string;
  tags: string[];
  featuredImageAlt?: string; // Optional alternative text for the image
  modifiedDate?: string; // Optional modification date
  filePath?: string; // NEW: Expect filePath from index
  relatedPostSlugs?: string[]; // Optional related post slugs
};

// Add a simpler type for the index list items if needed, or reuse BlogPost
type BlogIndexItem = Pick<BlogPost, 'slug' | 'title' | 'publishDate' | 'featuredImage' | 'category' | 'tags'> & {
  relatedPostSlugs?: string[]; // Optional related post slugs
}; // Example


type BlogPostDetailProps = {
  slug: string;
};

const BlogPostDetail = ({ slug }: BlogPostDetailProps) => {
  const [post, setPost] = useState<BlogPost | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [debugInfo, setDebugInfo] = useState<string | null>(null);
  const [activeHeading, setActiveHeading] = useState<string | null>(null);
  const [allPosts, setAllPosts] = useState<BlogIndexItem[]>([]); // State for all posts index
  const [relatedPosts, setRelatedPosts] = useState<BlogIndexItem[]>([]); // State for related posts
  const [isBarVisible, setIsBarVisible] = useState(false); // State for sticky bar visibility
  const [isBarDismissed, setIsBarDismissed] = useState(false); // State for dismissal
  
  // Get TOC items and content processing function using our custom hook
  const { tocItems, processContent } = useTableOfContents(post?.content || '');

  const handleHeadingChange = useCallback((id: string | null) => {
    setActiveHeading(id);
  }, []); // Empty dependency array ensures the function reference is stable

  // Generate SEO-optimized alt text for the featured image
  const generateOptimizedAltText = (post: BlogPost): string => {
    // If custom alt text is provided, use it
    if (post.featuredImageAlt) return post.featuredImageAlt;
    
    // Otherwise generate a keyword-rich alt text using available metadata
    const category = post.category || '';
    const mainTag = post.tags && post.tags.length > 0 ? post.tags[0] : '';
    const title = post.title || '';
    
    // Combine elements to create a keyword-rich alt text
    return `${title} - ${category}${mainTag ? ` | ${mainTag}` : ''} - Stoppr Blog`;
  };

  // Generate SEO-optimized meta description if none is provided
  const generateMetaDescription = (post: BlogPost): string => {
    // If a meta description is already provided, use it
    if (post.metaDescription && post.metaDescription.length > 20) {
      return post.metaDescription;
    }
    
    // Get the main keywords from the title and tags
    const titleWords = post.title.toLowerCase().split(' ');
    const mainKeywords = post.tags && post.tags.length > 0 
      ? post.tags.slice(0, 3).join(', ') 
      : titleWords.filter(word => word.length > 3).slice(0, 3).join(', ');
    
    // Create a meta description template based on the post title
    let title = post.title.replace(/7 Signs You're Consuming Too Much/i, '7 Warning Signs of Excessive');
    
    // If title mentions brain
    if (title.toLowerCase().includes('brain')) {
      return `Discover the 7 warning signs that sugar is negatively affecting your brain health and cognitive function. Learn science-backed strategies to reduce sugar intake and improve mental clarity. | Stoppr Blog`;
    }
    
    // If title mentions sugar
    if (title.toLowerCase().includes('sugar')) {
      return `7 warning signs you're consuming too much sugar. Learn how excess sugar impacts your health, the science behind sugar addiction, and practical strategies to reduce cravings. | Stoppr Blog`;
    }
    
    // Generic template for other topics
    return `Discover everything about ${title}. Learn science-backed strategies, expert tips, and practical advice for your health journey focused on ${mainKeywords}. | Stoppr Blog`;
  };

  // Get image path, handling both absolute URLs and relative paths
  const getImagePath = (imagePath: string) => {
    if (!imagePath) return undefined;
    if (imagePath.startsWith('http')) return imagePath;
    return imagePath; // keep as-is
  };

  // Given an original relative imagePath like "/images/blog/05-13-2025/image.jpg"
  // return an optimized variant (webp/avif) inside the date folder's /optimized/ sub-dir.
  const getOptimizedImagePath = (
    imagePath: string,
    ext: 'webp' | 'avif' | 'jpg'
  ) => {
    if (!imagePath || imagePath.startsWith('http')) return imagePath;

    // If already points to an optimized folder, just swap extension when needed
    if (imagePath.includes('/optimized/')) {
      return ext === 'jpg'
        ? imagePath.replace(/\.(png|jpe?g|webp|avif)$/i, '-optimized.jpg')
        : imagePath.replace(/\.(png|jpe?g|webp|avif)$/i, `.${ext}`);
    }

    // Split path to inject /optimized/
    const parts = imagePath.split('/');
    const filename = parts.pop() || '';
    const dateFolder = parts.pop() || '';
    const basePath = parts.join('/'); // e.g., "" or "/images/blog"

    const fileBase = filename.replace(/\.(png|jpe?g|webp|avif)$/i, '');

    if (ext === 'jpg') {
      return `${basePath}/${dateFolder}/optimized/${fileBase}-optimized.jpg`;
    }

    return `${basePath}/${dateFolder}/optimized/${fileBase}.${ext}`;
  };

  // Track page view when post is loaded
  useEffect(() => {
    if (post && post.title) {
      // Update document title
      document.title = `${post.title} | Stoppr Blog`;
      
      // Update Open Graph and Twitter Card meta tags
      const updateMetaTag = (property: string, content: string) => {
        let tag = document.querySelector(`meta[property="${property}"]`);
        if (!tag) {
          tag = document.querySelector(`meta[name="${property}"]`);
        }
        
        if (tag) {
          tag.setAttribute('content', content);
        } else {
          const newTag = document.createElement('meta');
          if (property.startsWith('og:')) {
            newTag.setAttribute('property', property);
          } else {
            newTag.setAttribute('name', property);
          }
          newTag.setAttribute('content', content);
          document.head.appendChild(newTag);
        }
      };
      
      // Determine image URL - use post featured image or default
      const imageUrl = post.featuredImage 
        ? (post.featuredImage.startsWith('http') 
            ? post.featuredImage 
            : `https://stoppr.app${getImagePath(post.featuredImage)}`)
        : 'https://www.stoppr.app/images/stoppr-social-share.jpg';
      
      // Determine the canonical URL
      const canonicalUrl = `https://www.stoppr.app/blog/${post.slug}`;
      
      // Update canonical link
      let canonicalLink = document.querySelector('link[rel="canonical"]');
      if (canonicalLink) {
        canonicalLink.setAttribute('href', canonicalUrl);
      } else {
        canonicalLink = document.createElement('link');
        canonicalLink.setAttribute('rel', 'canonical');
        canonicalLink.setAttribute('href', canonicalUrl);
        document.head.appendChild(canonicalLink);
      }
      
      // Add explicit robots meta tag to ensure indexing
      let robotsTag = document.querySelector('meta[name="robots"]');
      if (robotsTag) {
        robotsTag.setAttribute('content', 'index, follow');
      } else {
        robotsTag = document.createElement('meta');
        robotsTag.setAttribute('name', 'robots');
        robotsTag.setAttribute('content', 'index, follow');
        document.head.appendChild(robotsTag);
      }
      
      // Update meta description
      updateMetaTag('description', generateMetaDescription(post));
      
      // Update Open Graph tags
      updateMetaTag('og:type', 'article');
      updateMetaTag('og:title', post.title);
      updateMetaTag('og:description', generateMetaDescription(post));
      updateMetaTag('og:url', canonicalUrl);
      updateMetaTag('og:image', imageUrl);
      updateMetaTag('og:site_name', 'Stoppr');
      
      // Update article-specific Open Graph tags
      updateMetaTag('article:published_time', post.publishDate);
      updateMetaTag('article:modified_time', post.modifiedDate || new Date().toISOString()); // Use modification date if available or current date
      updateMetaTag('article:section', post.category);
      if (post.tags && post.tags.length > 0) {
        // Add first tag as primary tag
        updateMetaTag('article:tag', post.tags[0]);
      }
      
      // Update Twitter Card tags
      updateMetaTag('twitter:card', 'summary_large_image');
      updateMetaTag('twitter:title', post.title);
      updateMetaTag('twitter:description', generateMetaDescription(post));
      updateMetaTag('twitter:url', canonicalUrl);
      updateMetaTag('twitter:image', imageUrl);

    }
  }, [post]);

  // Use debugInfo in a useEffect to log it to console
  useEffect(() => {
    if (debugInfo) {
      console.log('[BlogPostDetail] Debug info:', debugInfo);
    }
  }, [debugInfo]);

  // Function to decode HTML entities
  const decodeHtml = (html: string) => {
    const textarea = document.createElement('textarea');
    textarea.innerHTML = html;
    return textarea.value;
  };

  // Process the content when the post is loaded
  useEffect(() => {
    if (post && post.content) {
      const processedContent = processContent(post.content);
      if (processedContent !== post.content) {
        setPost({
          ...post,
          content: processedContent
        });
      }
    }
  }, [post?.content, processContent]);

  useEffect(() => {
    const fetchBlogData = async () => {
      try {
        setLoading(true);
        
        // Fetch all blog posts index first to find the correct path
        // RENAME variables to avoid conflict with later index fetch
        const postIndexPaths = [
          '/blog-data/index.json',
          '/public/blog-data/index.json',
          'https://stoppr.app/blog-data/index.json',
          'https://www.stoppr.app/blog-data/index.json'
        ];

        let postIndexResponse;
        let postIndexUrl;

        for (const path of postIndexPaths) {
          postIndexUrl = path;
          console.log('Trying to fetch blog index to find post path from:', postIndexUrl);
          postIndexResponse = await fetch(postIndexUrl);
          console.log(`Response status for ${postIndexUrl}:`, postIndexResponse.status);
          if (postIndexResponse.ok) break;
        }

        if (!postIndexResponse || !postIndexResponse.ok) {
           const errorMsg = `Failed to fetch blog index to find post path. Last attempt: ${postIndexUrl} (${postIndexResponse?.status || 'unknown'})`;
           console.error(errorMsg);
           throw new Error(errorMsg);
        } 
            
        const postIndexData = await postIndexResponse.json();
        console.log('Received blog index data to find post path:', postIndexData);
        
        // Find the current post's data (including filePath) in the index
        const postIndexEntry = (postIndexData.posts || []).find((p: any) => p.slug === slug);

        if (!postIndexEntry) {
          throw new Error(`Blog post with slug \"${slug}\" not found in index.json`);
        }

        if (!postIndexEntry.filePath) {
          throw new Error(`Blog post with slug \"${slug}\" found in index.json, but is missing the 'filePath' property.`);
        }
        
        // Construct the correct path using filePath from the index
        const correctPostPath = `/blog-data/${postIndexEntry.filePath}`;
        console.log(`Found filePath in index. Fetching post from: ${correctPostPath}`);
        
        // Fetch current blog post using the correct path
        const postResponse = await fetch(correctPostPath);
        console.log(`Response status for ${correctPostPath}:`, postResponse.status);
        
        if (!postResponse || !postResponse.ok) {
          throw new Error(`Failed to fetch blog post from ${correctPostPath} (${postResponse?.status || 'unknown'} ${postResponse?.statusText || 'unknown'})`);
        }
        
        const postData = await postResponse.json();
        console.log('Received blog post data:', postData);
        if (postData.content_html && !postData.content) {
          postData.content = postData.content_html;
        }
        // Add missing fields if needed
        postData.featuredImage = postData.featuredImage || postData.image_url; // Compatibility
        postData.publishDate = postData.publishDate || postData.created_at || new Date().toISOString(); // Ensure date exists
        postData.tags = postData.tags || []; // Ensure tags is an array

        // Crucial: Add relatedPostSlugs from the index entry to the postData from the individual file
        if (postIndexEntry && postIndexEntry.relatedPostSlugs) {
          postData.relatedPostSlugs = postIndexEntry.relatedPostSlugs;
        } else {
          postData.relatedPostSlugs = []; // Ensure the property exists, even if empty
        }

        setPost(postData);
        setDebugInfo(`Successfully loaded post: ${postData.title}`);

        // Ensure allPosts is populated from the first index fetch
        if (postIndexData && postIndexData.posts) {
            const validPosts: BlogIndexItem[] = (postIndexData.posts || [])
              .filter((p: any) => p && p.slug && p.title && p.publishDate) 
              .map((p: any) => ({
                slug: p.slug,
                title: p.title,
                publishDate: p.publishDate || p.created_at || new Date().toISOString(),
                featuredImage: p.featuredImage || p.image_url, 
                category: p.category || 'Uncategorized', 
                tags: p.tags || [],
                relatedPostSlugs: p.relatedPostSlugs || [] // Ensure this is included
              }));
            setAllPosts(validPosts); 
        }

      } catch (err) {
        console.error('Error fetching blog data:', err);
        setError(`Failed to load blog post or index: ${err instanceof Error ? err.message : 'Unknown error'}`);
        setDebugInfo(`Error details: ${JSON.stringify(err)}`);
      } finally {
        setLoading(false);
      }
    };

    if (slug) {
      fetchBlogData();
    }
  }, [slug]);

  // Effect to determine related posts once current post and all posts are loaded
  useEffect(() => {
    if (post && post.relatedPostSlugs && post.relatedPostSlugs.length > 0 && allPosts.length > 0) {
      const related = post.relatedPostSlugs.map(slug => 
        allPosts.find(p => p.slug === slug)
      ).filter(p => p !== undefined) as BlogIndexItem[]; // Type assertion
      
      console.log('Determined related posts from pre-computed slugs:', related);
      setRelatedPosts(related);
    } else if (post && (!post.relatedPostSlugs || post.relatedPostSlugs.length === 0) && allPosts.length > 0) {
      // Fallback: if no pre-computed slugs, find some generic recent ones (optional)
      // This maintains some related content even if pre-computation hasn't run or found specific ones.
      const fallbackRelated = allPosts
        .filter(p => p.slug !== post.slug) 
        .sort((a, b) => new Date(b.publishDate).getTime() - new Date(a.publishDate).getTime()) 
        .slice(0, 4); 
      console.log('Determined FALLBACK related posts:', fallbackRelated);
      setRelatedPosts(fallbackRelated);
    }
  }, [post, allPosts]);

  // Function to format date
  const formatDate = (dateString: string) => {
    if (!dateString) return '';
    const options: Intl.DateTimeFormatOptions = { year: 'numeric', month: 'long', day: 'numeric' };
    return new Date(dateString).toLocaleDateString('en-US', options);
  };

  // Navigate to blog with tag filter
  const navigateToTagFilter = (tag: string) => {
    window.location.href = `/blog?tag=${encodeURIComponent(tag)}`;
  };

  // Refresh the page to try again
  const refreshPage = () => {
    window.location.reload();
  };

  // Effect to handle scroll and show/hide sticky bar
  useEffect(() => {
    const handleScroll = () => {
      // Show bar after scrolling down 300px
      if (window.scrollY > 300) {
        setIsBarVisible(true);
      } else {
        setIsBarVisible(false);
      }
    };

    window.addEventListener('scroll', handleScroll);

    // Cleanup listener on component unmount
    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  // Function to handle dismissing the bar
  const handleDismiss = () => {
    // Track dismissal in Mixpanel

    setIsBarDismissed(true);
  };





  return (
    <>
      <Header />
      {/* Add Reading Progress Bar when content is loaded */}
      {!loading && !error && post && <ReadingProgressBar />}
      
      {/* Schema.org structured data */}
      {!loading && !error && post && (
        <>
          <script 
            type="application/ld+json"
            dangerouslySetInnerHTML={{ 
              __html: JSON.stringify({
                "@context": "https://schema.org",
                "@type": "BlogPosting",
                "headline": post.title,
                "image": [
                  {
                    "@type": "ImageObject",
                    "url": post.featuredImage ? 
                      (post.featuredImage.startsWith('http') ? post.featuredImage : `https://stoppr.app${getImagePath(post.featuredImage)}`) 
                      : 'https://www.stoppr.app/images/stoppr-social-share.jpg',
                    "caption": generateOptimizedAltText(post)
                  }
                ],
                "datePublished": post.publishDate,
                "dateModified": post.modifiedDate || new Date().toISOString(), // Use modification date if available or current date
                "author": {
                  "@type": "Person",
                  "name": post.author
                },
                "publisher": {
                  "@type": "Organization",
                  "name": "Stoppr",
                  "logo": {
                    "@type": "ImageObject",
                    "url": "https://stoppr.app/images/logo.svg"
                  }
                },
                "description": generateMetaDescription(post),
                "keywords": post.tags?.join(", ") + ", sugar consumption, brain health, cognitive function, sugar addiction, sugar detox, mental clarity, sugar cravings",
                "mainEntityOfPage": {
                  "@type": "WebPage",
                  "@id": `https://stoppr.app/blog/${post.slug}`
                }
              })
            }}
          />
          
          {/* BreadcrumbList schema */}
          <script 
            type="application/ld+json"
            dangerouslySetInnerHTML={{ 
              __html: JSON.stringify({
                "@context": "https://schema.org",
                "@type": "BreadcrumbList",
                "itemListElement": [
                  {
                    "@type": "ListItem",
                    "position": 1,
                    "name": "Home",
                    "item": "https://www.stoppr.app/"
                  },
                  {
                    "@type": "ListItem",
                    "position": 2,
                    "name": "Blog",
                    "item": "https://www.stoppr.app/blog"
                  },
                  {
                    "@type": "ListItem",
                    "position": 3,
                    "name": post.title,
                    "item": `https://www.stoppr.app/blog/${post.slug}`
                  }
                ]
              })
            }}
          />
        </>
      )}
      
      {/* Add custom CSS for blog post content */}
      <style dangerouslySetInnerHTML={{ __html: `
        .prose h2 {
          scroll-margin-top: 6rem;
          padding-top: 1rem;
        }
        .prose h3 {
          scroll-margin-top: 6rem;
          padding-top: 0.5rem;
        }
        .active-heading {
          color: #3b82f6 !important; /* Blue highlight for active headings */
        }
        .prose p {
          color: white !important; /* Force white text for all paragraphs */
        }

        /* For the sticky bottom banner (position: fixed) */
        .banner-shine-effect {
          overflow: hidden;
        }
        .banner-shine-effect::before,
        .static-banner-shine-effect::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          width: 40%; 
          height: 100%;
          background: linear-gradient(
            to right,
            rgba(255, 255, 255, 0) 0%,
            rgba(255, 255, 255, 0.25) 50%,
            rgba(255, 255, 255, 0) 100%
          );
          transform: translateX(-100%) skewX(-20deg);
          animation: shineEffect 3.5s infinite linear;
          z-index: 1;
        }

        /* For the in-flow 'Explore Our Free Tools!' banner */
        .static-banner-shine-effect {
          position: relative; /* Crucial for this banner type */
          overflow: hidden;
        }
        /* ::before styles are shared above */

        /* Shared animation keyframes */
        @keyframes shineEffect {
          0% {
            transform: translateX(-100%) skewX(-20deg);
          }
          100% {
            transform: translateX(250%) skewX(-20deg);
          }
        }
      `}} />
      <main className="pt-[72px] md:pt-[80px] pb-24">
        {/* Sticky Bottom Bar - Animated */}
        {!isBarDismissed && ( // Only render if not dismissed
          <motion.div
            className="fixed bottom-0 left-0 right-0 w-full bg-gradient-to-r from-rose-900 via-pink-900 to-purple-900 bg-opacity-95 backdrop-blur-sm p-6 rounded-t-lg shadow-lg z-50 mx-auto border border-pink-800 border-b-0 banner-shine-effect"
            style={{ maxWidth: "32rem", marginLeft: "auto", marginRight: "auto" }}
            initial={{ y: "100%", opacity: 0 }}
            animate={isBarVisible ? { y: 0, opacity: 1 } : { y: "100%", opacity: 0 }} // Animate in/out based on visibility
            transition={{ duration: 0.5, ease: "easeOut" }} // Animation transition
          >
            {/* Dismiss Button */}
            <button
              onClick={handleDismiss}
              className="absolute top-1 right-1 text-gray-400 hover:text-white transition-colors p-1 z-10"
              aria-label="Dismiss banner"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            {/* Heading */}
            <div className="text-center text-white mb-4">
              <span className="font-bold text-xl">STOPPR</span>
              <span className="block text-sm">Stop your sugar cravings</span>
            </div>


          </motion.div>
        )}
        
        <section className="py-12 sm:py-16 md:py-20 bg-black pb-24 min-h-[calc(100vh-150px)]"> {/* Added padding-bottom to avoid overlap */}
          <div className="container mx-auto px-4 max-w-6xl">
            {loading && (
              <div className="flex justify-center my-12">
                <div className="animate-pulse text-gray-300 text-xl">Loading blog post...</div>
              </div>
            )}

            {error && (
              <div className="bg-red-900 bg-opacity-20 text-red-300 p-4 rounded-lg text-center my-8">
                {error}
                <p className="mt-4">
                  <button
                    onClick={refreshPage}
                    className="bg-red-800 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors mr-4"
                  >
                    Refresh Page
                  </button>
                  <a href="/blog" className="text-blue-400 hover:text-blue-300">
                    Return to blog listing
                  </a>
                </p>
              </div>
            )}

            {!loading && !error && post && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
              >
                <div className="mb-8">
                  <a href="/blog" className="text-blue-400 hover:text-blue-300 inline-flex items-center mb-6">
                    <svg 
                      xmlns="http://www.w3.org/2000/svg" 
                      className="h-4 w-4 mr-1" 
                      fill="none" 
                      viewBox="0 0 24 24" 
                      stroke="currentColor"
                    >
                      <path 
                        strokeLinecap="round" 
                        strokeLinejoin="round" 
                        strokeWidth={2} 
                        d="M15 19l-7-7 7-7" 
                      />
                    </svg>
                    Back to all articles
                  </a>
                  
                  <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold text-white mb-4">
                    {decodeHtml(post.title)}
                  </h1>
                  
                  {post.metaDescription && (
                    <p className="text-gray-300 mb-4 text-lg italic">
                      {decodeHtml(post.metaDescription)}
                    </p>
                  )}
                  
                  <div className="flex flex-wrap items-center text-gray-400 mb-6">
                    <span className="mr-4">{formatDate(post.publishDate)}</span>
                    {post.modifiedDate && post.modifiedDate !== post.publishDate && (
                      <span className="mr-4">Updated: {formatDate(post.modifiedDate)}</span>
                    )}
                    <span className="mr-4">By {post.author}</span>
                    <span className="px-2 py-1 bg-gray-800 rounded text-sm">{post.category}</span>
                  </div>
                </div>

                {post.featuredImage && (
                  <div className="w-full h-64 md:h-96 overflow-hidden bg-gray-900 mb-8">
                    <picture>
                      {/* AVIF first for browsers that support it */}
                      <source
                        srcSet={getOptimizedImagePath(post.featuredImage, 'avif')}
                        type="image/avif"
                      />
                      {/* WebP fallback */}
                      <source
                        srcSet={getOptimizedImagePath(post.featuredImage, 'webp')}
                        type="image/webp"
                      />
                      {/* High-quality jpg fallback */}
                      <source
                        srcSet={getOptimizedImagePath(post.featuredImage, 'jpg')}
                        type="image/jpeg"
                      />
                      <img
                        src={getOptimizedImagePath(post.featuredImage, 'jpg')}
                        alt={generateOptimizedAltText(post)}
                        className="w-full h-full object-cover"
                        width="1200"
                        height="630"
                        sizes="100vw"
                        {...{ fetchpriority: 'high' }}
                      />
                    </picture>
                  </div>
                )}

                {/* Free Tools Banner START */}
                <div className="my-8 p-6 bg-gradient-to-r from-rose-700 via-pink-700 to-purple-700 rounded-lg shadow-xl text-white text-center static-banner-shine-effect">
                  <h3 className="text-3xl font-bold mb-3 text-white">Explore Our Free Tools!</h3>
                  <p className="mb-6 text-lg text-gray-200">
                    Take the next step on your health journey with our specially designed tools.
                  </p>
                  <div className="flex flex-col sm:flex-row justify-center items-center gap-4 sm:gap-6">
                    <a
                      href="http://www.stoppr.app/sugar-impact-tool"
                      className="bg-white text-rose-800 font-semibold py-3 px-8 rounded-lg hover:bg-gray-200 transition-all duration-300 ease-in-out shadow-md hover:shadow-lg transform hover:-translate-y-0.5 w-full sm:w-auto text-md"
                    >
                      Sugar Impact
                    </a>
                    <a
                      href="http://www.stoppr.app/sleep-craving-tool"
                      className="bg-white text-purple-800 font-semibold py-3 px-8 rounded-lg hover:bg-gray-200 transition-all duration-300 ease-in-out shadow-md hover:shadow-lg transform hover:-translate-y-0.5 w-full sm:w-auto text-md"
                    >
                      Sleep & Cravings Helper
                    </a>
                  </div>
                </div>
                {/* Free Tools Banner END */}

                <div className="grid grid-cols-1 lg:grid-cols-[250px_1fr] gap-8">
                  {/* Table of Contents (Left Column on Desktop) */}
                  <div className="hidden lg:block">
                    <TableOfContents tocItems={tocItems} activeHeading={activeHeading || undefined} />
                  </div>
                  
                  {/* Blog Content (Right Column on Desktop) */}
                  <div>
                    <div 
                      className="prose prose-lg prose-invert max-w-none text-white"
                      dangerouslySetInnerHTML={{ __html: post.content }}
                    />
                    
                    {/* Add RelatedPosts component */}
                    {relatedPosts.length > 0 && <RelatedPosts posts={relatedPosts} />}
                    
                    {/* Add BlogCTA after the content */}
                    <BlogCTA />
                  </div>
                </div>

                {/* Mobile Table of Contents */}
                <MobileTableOfContents 
                  tocItems={tocItems} 
                  activeHeading={activeHeading || undefined} 
                />

                {/* Heading tracker component */}
                <ActiveHeadingTracker 
                  onHeadingChange={handleHeadingChange} 
                />

                {post.tags && post.tags.length > 0 && (
                  <div className="mt-8 pt-6 border-t border-gray-800">
                    <h3 className="text-xl font-bold text-white mb-4">Tags</h3>
                    <div className="flex flex-wrap gap-2">
                      {post.tags.map(tag => (
                        <button 
                          key={tag}
                          onClick={() => navigateToTagFilter(tag)}
                          className="px-3 py-1 bg-gray-800 rounded-full text-gray-300 text-sm hover:bg-gray-700 transition-colors cursor-pointer"
                        >
                          {tag}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </motion.div>
            )}
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
};

export default BlogPostDetail; 