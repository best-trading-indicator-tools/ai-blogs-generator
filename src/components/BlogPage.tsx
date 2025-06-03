import { motion } from 'framer-motion';
import { useInView } from 'react-intersection-observer';
import { useState, useEffect } from 'react';
import Header from '../Header';
import Footer from '../Footer';
import { trackPageView } from '../../google-analytics';

type BlogPost = {
  title: string;
  content: string;
  contentMarkdown?: string;
  slug: string;
  publishDate: string;
  author: string;
  category: string;
  featuredImage?: string;
  featuredImageAlt?: string;
  metaDescription?: string;
  articleId?: string;
  tags: string[];
};

const BlogPage = () => {
  const [ref, inView] = useInView({
    triggerOnce: true,
    threshold: 0.1,
  });
  
  const [blogPosts, setBlogPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [debugInfo, setDebugInfo] = useState<string | null>(null);
  // Add state for tags and filtering
  const [allTags, setAllTags] = useState<string[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [filteredPosts, setFilteredPosts] = useState<BlogPost[]>([]);
  // Add state for pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [postsPerPage] = useState(9); // Display 9 posts per page (3x3 grid)

  // Track page view when component mounts
  useEffect(() => {
    // Set the document title
    document.title = "The Sugar-Free Blog | Stoppr";
    
    // Update meta tags for the blog listing page
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
    
    // Set canonical URL
    const canonicalUrl = "https://www.stoppr.app/blog";
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
    const description = "The Sugar-Free Blog - Insights, tips, and success stories to help you on your journey to quit sugar.";
    updateMetaTag('description', description);
    
    // Update Open Graph tags
    updateMetaTag('og:type', 'website');
    updateMetaTag('og:title', "The Sugar-Free Blog | Stoppr");
    updateMetaTag('og:description', description);
    updateMetaTag('og:url', canonicalUrl);
    updateMetaTag('og:image', "https://www.stoppr.app/images/stoppr-social-share.jpg");
    
    // Update Twitter Card tags
    updateMetaTag('twitter:card', 'summary_large_image');
    updateMetaTag('twitter:title', "The Sugar-Free Blog | Stoppr");
    updateMetaTag('twitter:description', description);
    updateMetaTag('twitter:url', canonicalUrl);
    updateMetaTag('twitter:image', "https://www.stoppr.app/images/stoppr-social-share.jpg");
    
    // Track the page view
    trackPageView(
      document.title,
      window.location.pathname
    );
  }, []);

  // Use debugInfo in a useEffect to log it to console
  useEffect(() => {
    if (debugInfo) {
      console.log('[BlogPage] Debug info:', debugInfo);
    }
  }, [debugInfo]);

  // Add this function to extract the first image from HTML content
  const extractFirstImage = (htmlContent: string): string | null => {
    if (!htmlContent) return null;
    const imgRegex = /<img[^>]+src="([^">]+)"/i;
    const match = htmlContent.match(imgRegex);
    if (match && match[1]) {
      console.log('[Blog] Extracted image from content:', match[1]);
      return match[1];
    }
    return null;
  };

  // Check for tag parameter in URL
  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const tagParam = searchParams.get('tag');
    
    if (tagParam) {
      setSelectedTags([decodeURIComponent(tagParam)]);
    }
  }, []);

  useEffect(() => {
    const fetchBlogPosts = async () => {
      try {
        setLoading(true);
        console.log('[Blog] Starting to fetch blog posts...');
        
        // First check if we can access the blog-data directory
        try {
          console.log('[Blog] Checking if blog-data directory is accessible...');
          const directoryCheckResponse = await fetch('/blog-data/');
          console.log(`[Blog] Directory check status: ${directoryCheckResponse.status}`);
          
          if (directoryCheckResponse.status === 404) {
            console.error('[Blog] Blog data directory not found');
            setDebugInfo('Blog data directory not found. This may indicate the webhook has not created any blog files yet.');
          }
        } catch (dirError) {
          console.warn('[Blog] Error checking blog directory:', dirError);
        }
        
        // Try multiple potential locations for the blog data
        const potentialPaths = [
          '/blog-data/index.json',  // Current path
          '/public/blog-data/index.json',  // Path in GitHub repo
          'https://stoppr.app/blog-data/index.json',  // Direct URL
          'https://www.stoppr.app/blog-data/index.json'  // WWW URL
        ];
        
        let response;
        let indexUrl;
        let debugMessage = null;
        
        // Try each path until we find one that works
        for (const path of potentialPaths) {
          indexUrl = path;
          console.log('[Blog] Trying to fetch blog index from:', indexUrl);
          response = await fetch(indexUrl);
          console.log(`[Blog] Response status for ${indexUrl}:`, response.status);
          
          if (response.ok) {
            console.log('[Blog] Successfully loaded blog index from:', indexUrl);
            break;
          }
        }
        
        // If all paths failed
        if (!response || !response.ok) {
          console.error('[Blog] All fetch attempts failed');
          throw new Error(`Failed to fetch blog posts from any location. Last attempt: ${indexUrl} (${response?.status || 'unknown'} ${response?.statusText || 'unknown'})`);
        }
        
        // Process the successful response
        const data = await response.json();
        console.log('[Blog] Received blog data:', data);
        
        // Set debug info to help troubleshoot
        debugMessage = `Found ${(data.posts || []).length} posts. Last updated: ${data.lastUpdated || 'unknown'}`;
        console.log('[Blog] Debug message:', debugMessage);
        
        let posts: BlogPost[] = data.posts || [];
        
        // Validate post data to ensure all required fields are present
        posts = posts.filter(post => {
          const isValid = !!post.title && !!post.slug;
          if (!isValid) {
            console.warn('[Blog] Filtering out invalid post:', post);
          }
          return isValid;
        });
        
        // Ensure all posts have content field (even if empty)
        posts = posts.map(post => ({
          ...post,
          content: post.content || '',
          featuredImage: post.featuredImage || '',
          publishDate: post.publishDate || new Date().toISOString(),
          tags: post.tags || []
        }));
        
        console.log('[Blog] Validated posts:', posts);
        
        // Sort by publish date (newest first)
        posts.sort((a, b) => new Date(b.publishDate).getTime() - new Date(a.publishDate).getTime());
        console.log('[Blog] Sorted posts:', posts.length);
        
        // Process posts to include first image from content if no featured image
        const processedPosts = posts.map((post: any) => {
          const firstImage = extractFirstImage(post.content);
          // Handle both image_url and featuredImage fields
          const imageUrl = post.image_url || post.featuredImage || firstImage;
          
          console.log(`[Blog] Processing post "${post.title}":`, {
            imageUrl: post.image_url || post.featuredImage,
            firstImage,
            finalImage: imageUrl
          });

          return {
            title: post.title,
            content: post.content,
            slug: post.slug,
            // Handle both publishDate and created_at fields
            publishDate: post.publishDate || post.created_at || new Date().toISOString(),
            author: post.author,
            category: post.category,
            featuredImage: imageUrl || undefined,
            featuredImageAlt: post.featuredImageAlt,
            metaDescription: post.metaDescription,
            tags: post.tags || []
          };
        });
        
        // Extract all unique tags from posts
        const tagsSet = new Set<string>();
        processedPosts.forEach(post => {
          if (post.tags && Array.isArray(post.tags)) {
            post.tags.forEach(tag => tagsSet.add(tag));
          }
        });
        
        const allTagsArray = Array.from(tagsSet).sort();
        
        setBlogPosts(processedPosts);
        setAllTags(allTagsArray);
        setDebugInfo(debugMessage);
      } catch (err) {
        console.error('[Blog] Error fetching blog posts:', err);
        setError(`Failed to load blog posts: ${err instanceof Error ? err.message : 'Unknown error'}`);
        setDebugInfo(`Error details: ${JSON.stringify(err)}`);
      } finally {
        console.log('[Blog] Setting loading to false');
        setLoading(false);
      }
    };

    fetchBlogPosts();
  }, []);

  // Filter posts when selectedTags changes or when blogPosts updates
  useEffect(() => {
    if (selectedTags.length === 0) {
      setFilteredPosts(blogPosts);
    } else {
      const filtered = blogPosts.filter(post => 
        selectedTags.some(tag => post.tags && post.tags.includes(tag))
      );
      setFilteredPosts(filtered);
    }
    // Reset to first page whenever filters change
    setCurrentPage(1);
  }, [selectedTags, blogPosts]);
  
  // Calculate pagination values
  const indexOfLastPost = currentPage * postsPerPage;
  const indexOfFirstPost = indexOfLastPost - postsPerPage;
  const currentPosts = filteredPosts.slice(indexOfFirstPost, indexOfLastPost);
  const totalPages = Math.ceil(filteredPosts.length / postsPerPage);

  // Change page handler
  const paginate = (pageNumber: number) => {
    if (pageNumber < 1 || pageNumber > totalPages) return;
    setCurrentPage(pageNumber);
    window.scrollTo(0, 0); // Scroll to top on page change
  };

  // Function to decode HTML entities
  const decodeHtml = (html: string) => {
    const textarea = document.createElement('textarea');
    textarea.innerHTML = html;
    return textarea.value;
  };

  // Generate excerpt from content
  const generateExcerpt = (content: string | undefined | null, maxLength = 150) => {
    if (!content) return '';
    
    // Decode HTML entities
    const decodedContent = decodeHtml(content);
    
    // Remove HTML tags
    const plainText = decodedContent.replace(/<[^>]*>?/gm, '');
    
    if (plainText.length <= maxLength) return plainText;
    return plainText.substring(0, maxLength).trim() + '...';
  };

  // Function to format date
  const formatDate = (dateString: string) => {
    const options: Intl.DateTimeFormatOptions = { year: 'numeric', month: 'long', day: 'numeric' };
    return new Date(dateString).toLocaleDateString('en-US', options);
  };

  // Check browser cache status
  const refreshPage = () => {
    window.location.reload();
  };

  // Handle tag selection/deselection
  const toggleTag = (tag: string) => {
    if (selectedTags.includes(tag)) {
      setSelectedTags(selectedTags.filter(t => t !== tag));
    } else {
      setSelectedTags([...selectedTags, tag]);
    }
  };

  // Clear all selected tags
  const clearTags = () => {
    setSelectedTags([]);
  };
  
  return (
    <>
      <Header />
      
      {/* Schema.org structured data for Blog Listing */}
      {!loading && !error && blogPosts.length > 0 && (
        <script 
          type="application/ld+json"
          dangerouslySetInnerHTML={{ 
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "Blog",
              "name": "The Sugar-Free Blog",
              "description": "Insights, tips, and success stories to help you on your journey to quit sugar.",
              "url": "https://stoppr.app/blog",
              "publisher": {
                "@type": "Organization",
                "name": "Stoppr",
                "logo": {
                  "@type": "ImageObject",
                  "url": "https://stoppr.app/images/logo.svg"
                }
              },
              "blogPosts": blogPosts.map(post => ({
                "@type": "BlogPosting",
                "headline": post.title,
                "description": post.metaDescription,
                "datePublished": post.publishDate,
                "author": {
                  "@type": "Person",
                  "name": post.author
                },
                "url": `https://stoppr.app/blog/${post.slug}`
              }))
            })
          }}
        />
      )}
      
      <main className="pt-[72px] md:pt-[80px]">
        <section className="py-12 sm:py-16 md:py-20 bg-black min-h-screen">
          <div className="container mx-auto px-4">
            <motion.div
              ref={ref}
              initial={{ opacity: 0, y: 20 }}
              animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
              transition={{ duration: 0.5 }}
              className="text-center mb-10 sm:mb-16"
            >
              <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold text-white mb-6">
                The Sugar-Free Blog
              </h1>
              <p className="text-base sm:text-lg md:text-xl text-gray-300 max-w-3xl mx-auto">
                Insights, tips, and success stories to help you on your journey to quit sugar.
              </p>
            </motion.div>

            {loading && (
              <div className="flex flex-col items-center justify-center my-12">
                <div className="animate-pulse text-gray-300 text-xl mb-4">Loading blog posts...</div>
                <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
              </div>
            )}

            {error && (
              <div className="bg-red-900 bg-opacity-20 text-red-300 p-6 rounded-lg text-center my-8 max-w-2xl mx-auto">
                <div className="text-xl font-semibold mb-4">Error Loading Blog Posts</div>
                <p className="mb-4">{error}</p>
                <div className="mt-4">
                  <button 
                    onClick={refreshPage}
                    className="bg-red-800 text-white px-6 py-3 rounded-lg hover:bg-red-700 transition-colors"
                  >
                    Try Again
                  </button>
                </div>
                <div className="mt-6 text-left text-sm opacity-80 bg-gray-900 p-4 rounded overflow-auto max-h-60">
                  <p className="font-mono">Try these troubleshooting steps:</p>
                  <ol className="list-decimal pl-5 mt-2 space-y-1">
                    <li>Check if blog data files exist in public/blog-data/</li>
                    <li>Verify the blog index.json file is properly formatted</li>
                    <li>Check browser console for additional errors</li>
                    <li>Clear browser cache and reload</li>
                  </ol>
                </div>
              </div>
            )}

            {!loading && !error && blogPosts.length === 0 && (
              <div className="text-center my-12">
                <p className="text-gray-300 text-xl mb-8">No blog posts found</p>
                <div className="bg-gray-900 bg-opacity-50 p-6 rounded-lg max-w-2xl mx-auto text-left">
                  <h3 className="text-white font-semibold mb-3">Possible reasons:</h3>
                  <ul className="list-disc pl-5 text-gray-300 space-y-2">
                    <li>Blog content hasn't been published yet</li>
                    <li>The webhook hasn't created any blog files</li>
                    <li>The blog data directory isn't accessible</li>
                    <li>The blog index file is missing or malformed</li>
                  </ul>
                  <div className="mt-6">
                    <button 
                      onClick={refreshPage}
                      className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition-colors"
                    >
                      Refresh Page
                    </button>
                  </div>
                </div>
              </div>
            )}

            {!loading && !error && blogPosts.length > 0 && (
              <>
                {/* Tag filtering UI */}
                {allTags.length > 0 && (
                  <div className="mb-10">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4">
                      <h2 className="text-xl text-white font-bold mb-3 sm:mb-0">Filter by tags:</h2>
                      {selectedTags.length > 0 && (
                        <button 
                          onClick={clearTags}
                          className="text-sm text-blue-400 hover:text-blue-300 underline"
                        >
                          Clear all filters
                        </button>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {allTags.map(tag => (
                        <button
                          key={tag}
                          onClick={() => toggleTag(tag)}
                          className={`px-3 py-1 rounded-full text-sm transition-colors ${
                            selectedTags.includes(tag)
                              ? 'bg-blue-600 text-white'
                              : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                          }`}
                        >
                          {tag}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Display number of filtered results */}
                {selectedTags.length > 0 && (
                  <div className="mb-6 text-gray-300">
                    Showing {filteredPosts.length} {filteredPosts.length === 1 ? 'post' : 'posts'} matching {selectedTags.length === 1 ? 'tag' : 'tags'}: {selectedTags.join(', ')}
                  </div>
                )}

                {/* Filtered posts grid */}
                {currentPosts.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    {currentPosts.map((post) => (
                      <BlogCard
                        key={post.slug}
                        title={post.title}
                        excerpt={generateExcerpt(post.content)}
                        imagePath={post.featuredImage}
                        imageAlt={post.featuredImageAlt}
                        date={formatDate(post.publishDate)}
                        slug={post.slug}
                        tags={post.tags}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="text-center my-12 p-6 bg-gray-900 bg-opacity-50 rounded-lg">
                    <p className="text-gray-300 text-xl mb-4">No posts found matching the selected tags</p>
                    <button 
                      onClick={clearTags}
                      className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition-colors"
                    >
                      Clear filters
                    </button>
                  </div>
                )}
                
                {/* Pagination Controls */}
                {totalPages > 1 && (
                  <div className="mt-12 flex justify-center items-center space-x-2">
                    <button
                      onClick={() => paginate(currentPage - 1)}
                      disabled={currentPage === 1}
                      className="px-4 py-2 rounded-lg bg-gray-800 text-gray-300 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-700 transition-colors"
                    >
                      Previous
                    </button>
                    
                    <span className="text-gray-400">
                      Page {currentPage} of {totalPages}
                    </span>
                    
                    <button
                      onClick={() => paginate(currentPage + 1)}
                      disabled={currentPage === totalPages}
                      className="px-4 py-2 rounded-lg bg-gray-800 text-gray-300 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-700 transition-colors"
                    >
                      Next
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
};

type BlogCardProps = {
  title: string;
  excerpt: string;
  imagePath?: string;
  imageAlt?: string;
  date: string;
  slug: string;
  tags?: string[];
};

const BlogCard = ({ title, excerpt, imagePath, imageAlt, date, slug, tags }: BlogCardProps) => {
  // Function to handle tag click
  const handleTagClick = (tag: string, e: React.MouseEvent) => {
    e.preventDefault(); // Prevent navigating to blog post
    window.location.href = `/blog?tag=${encodeURIComponent(tag)}`;
  };
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="bg-black rounded-xl overflow-hidden border border-gray-800 hover:border-gray-700 transition-all"
    >
      {imagePath && (
        <a href={`/blog/${slug}`} className="block h-48 overflow-hidden bg-gray-900">
          <div className="h-full flex items-center justify-center">
            <img 
              src={imagePath} 
              alt={imageAlt || title}
              className="w-full h-full object-cover transition-transform hover:scale-105 duration-300"
            />
          </div>
        </a>
      )}
      <div className="p-6">
        <p className="text-sm text-gray-400 mb-2">{date}</p>
        <h3 className="text-xl font-bold text-white mb-2 hover:text-blue-400 transition-colors">
          <a href={`/blog/${slug}`}>{title}</a>
        </h3>
        <p className="text-gray-300 mb-4" dangerouslySetInnerHTML={{ __html: excerpt }}></p>
        
        {/* Show tags if available */}
        {tags && tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-4">
            {tags.slice(0, 3).map(tag => (
              <a
                key={tag}
                href={`/blog?tag=${encodeURIComponent(tag)}`}
                onClick={(e) => handleTagClick(tag, e)}
                className="text-xs bg-gray-800 text-gray-300 px-2 py-1 rounded-full hover:bg-gray-700 transition-colors"
              >
                {tag}
              </a>
            ))}
            {tags.length > 3 && (
              <span className="text-xs text-gray-400">+{tags.length - 3} more</span>
            )}
          </div>
        )}
        
        <a 
          href={`/blog/${slug}`}
          className="text-blue-400 hover:text-blue-300 font-medium inline-flex items-center transition-colors"
        >
          Read more
          <svg 
            xmlns="http://www.w3.org/2000/svg" 
            className="h-4 w-4 ml-1" 
            fill="none" 
            viewBox="0 0 24 24" 
            stroke="currentColor"
          >
            <path 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              strokeWidth={2} 
              d="M9 5l7 7-7 7" 
            />
          </svg>
        </a>
      </div>
    </motion.div>
  );
};

export default BlogPage; 