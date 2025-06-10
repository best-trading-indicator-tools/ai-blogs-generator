/**
 * Daily Blog Generation Script
 * Automatically creates two new blog posts with generated images following the same format as existing blogs
 */

import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { generateBlogImage } from '../src/utils/ideogramApi';
import { generateBlogContent, generatePreviewContent, generateMetaDescription } from '../src/utils/aiBlogGenerator';
import * as dotenv from 'dotenv';
import { execSync } from 'child_process';

// Load environment variables
dotenv.config();

// Path configuration
const BLOG_DATA_DIR = path.resolve(process.cwd(), 'public/blog-data');
const BLOG_IMAGES_DIR = path.resolve(process.cwd(), 'public/images/blog');
const TEMPLATE_FILE = path.join(BLOG_DATA_DIR, 'sugar-withdrawal-symptoms.json');
const INDEX_FILE = path.join(BLOG_DATA_DIR, 'index.json');
const SITEMAP_FILE = path.resolve(process.cwd(), 'public/sitemap.xml');

// Blog data interface
interface BlogData {
  title: string;
  slug: string;
  publishDate: string;
  author: string;
  category: string;
  content: string;
  metaDescription: string;
  articleId: string;
  tags: string[];
  featuredImage?: string;
  filePath?: string;
}

// Topic interface
interface BlogTopic {
  title: string;
  slug: string;
  category: string;
  metaDescription: string;
  tags: string[];
}

// Ensure blog images directory exists
if (!fs.existsSync(BLOG_IMAGES_DIR)) {
  fs.mkdirSync(BLOG_IMAGES_DIR, { recursive: true });
}

/**
 * Generate topics using the enhanced topic generator
 * @returns Array of generated topics
 */
function generateDailyTopics(): BlogTopic[] {
  try {
    // First check if we have enhanced topics available
    const enhancedTopicsPath = path.join(process.cwd(), 'scripts/generated/latest-topics.json');
    
    if (fs.existsSync(enhancedTopicsPath)) {
      console.log('Using enhanced topics from keyword trends...');
      const enhancedTopicsData = fs.readFileSync(enhancedTopicsPath, 'utf8');
      return JSON.parse(enhancedTopicsData);
    }
    
    // Fallback to the original topic generator if enhanced topics aren't available
    console.log('Enhanced topics not found, using standard topic generator...');
    const result = execSync('tsx scripts/topic-generator.ts 2', { encoding: 'utf8' });
    return JSON.parse(result);
  } catch (error) {
    console.error('Error generating topics:', error);
    // Fallback topics in case both generators fail
    return [
      {
        title: "10 Best Ways to Beat Sugar Cravings Naturally",
        slug: "beat-sugar-cravings-naturally",
        category: "Nutrition Science",
        metaDescription: "Discover 10 science-backed methods to naturally overcome sugar cravings. Learn effective strategies to regain control and improve your health.",
        tags: ["cravings management", "nutrition science", "natural remedies"]
      },
      {
        title: "The Link Between Sugar and Inflammation: What to Know",
        slug: "sugar-and-inflammation-link",
        category: "Health Education",
        metaDescription: "Uncover the connection between sugar consumption and chronic inflammation. Learn how reducing sugar intake can help improve your overall health.",
        tags: ["inflammation", "health education", "nutrition science"]
      }
    ];
  }
}

/**
 * Replaces standard YouTube iframes with lite-youtube custom elements.
 * @param htmlContent The HTML string to process.
 * @returns HTML string with iframes replaced.
 */
function replaceYoutubeIframes(htmlContent: string): string {
  if (!htmlContent) return '';

  // Regex to find YouTube iframe embeds
  // Example: <iframe width="560" height="315" src="https://www.youtube.com/embed/VIDEO_ID" ...></iframe>
  // Or: <iframe src="https://www.youtube-nocookie.com/embed/VIDEO_ID?..." ...></iframe>
  const youtubeIframeRegex = /<iframe[^>]+src=["'](?:https?:)?\/\/(?:www\.)?(?:youtube\.com\/embed\/|youtube-nocookie\.com\/embed\/)([^"'PTV\/\s]+)[^>]*><\/iframe>/gi;

  return htmlContent.replace(youtubeIframeRegex, (match, videoId) => {
    if (videoId) {
      console.log(`Replacing YouTube iframe with <lite-youtube> for video ID: ${videoId}`);
      // Include playlabel for accessibility
      return `<lite-youtube videoid="${videoId}" playlabel="Play Video"></lite-youtube>`;
    }
    // Return original match if videoId couldn't be extracted (shouldn't happen with this regex)
    return match; 
  });
}

/**
 * Generate a blog post based on a template and topic
 */
async function generateBlog(topic: BlogTopic): Promise<string | null> {
  try {
    // Read the template blog
    const templateContent = fs.readFileSync(TEMPLATE_FILE, 'utf8');
    const templateData = JSON.parse(templateContent);
    
    // Try to load trending keywords data for additional context
    let trendingKeywordsContext = '';
    try {
      const trendingKeywordsPath = path.join(process.cwd(), 'scripts/generated/latest-trending-keywords.json');
      if (fs.existsSync(trendingKeywordsPath)) {
        const trendingData = JSON.parse(fs.readFileSync(trendingKeywordsPath, 'utf8'));
        
        // Extract relevant keywords (trending keywords + rising queries)
        const relatedTrendingKeywords = [...trendingData.trendingKeywords, ...trendingData.risingQueries]
          .filter(kw => 
            // Filter only keywords relevant to this topic
            kw.toLowerCase().includes(topic.title.toLowerCase()) || 
            topic.title.toLowerCase().includes(kw.toLowerCase()) ||
            topic.tags.some(tag => kw.toLowerCase().includes(tag.toLowerCase()))
          )
          .slice(0, 10); // Limit to 10 keywords
        
        if (relatedTrendingKeywords.length > 0) {
          trendingKeywordsContext = `SEO keywords to incorporate: ${relatedTrendingKeywords.join(', ')}. `;
          console.log(`Added ${relatedTrendingKeywords.length} trending keywords to the context`);
        }
      }
    } catch (error) {
      console.warn('Could not load trending keywords data:', error);
      // Continue without trending keywords
    }
    
    // Create additional context from tags and meta description plus trending keywords
    const additionalContext = trendingKeywordsContext + [...topic.tags, topic.metaDescription].join('. ');
    
    // Generate AI content
    console.log(`Generating content for: ${topic.title}`);
    let fullContent: string;
    try {
        fullContent = await generateBlogContent(
          topic.title,
          topic.category,
          800,  
          5000, 
          additionalContext
        );

        // Remove leading H1 if present, as the page template should handle the main H1
        if (fullContent && fullContent.trim().toLowerCase().startsWith('<h1>')) {
          const closingH1Index = fullContent.toLowerCase().indexOf('</h1>');
          if (closingH1Index !== -1) {
            fullContent = fullContent.substring(closingH1Index + 5).trim(); // +5 for '</h1>'.length
            console.log(`Removed leading H1 from generated content for: ${topic.title}`);
          }
        }

    } catch (contentError) {
        console.error(`Failed to generate content for "${topic.title}":`, contentError);
        // Propagate the error or return null to indicate failure
        throw contentError; // Re-throw to stop processing this blog in the main loop
        // Alternatively: return null;
    }

    
    // Generate a preview content for index.json
    console.log(`Generating preview content for: ${topic.title}`);
    const previewContent = await generatePreviewContent(
      topic.title,
      topic.category,
      additionalContext
    );

    // Generate an SEO Meta Description
    console.log(`Generating meta description for: ${topic.title}`);
    let seoMetaDescription = topic.metaDescription; // Use topic's as a fallback
    try {
      if (fullContent) { // Ensure fullContent is available
        seoMetaDescription = await generateMetaDescription(topic.title, fullContent);
      } else {
        console.warn(`Full content not available for "${topic.title}", using fallback meta description.`);
      }
    } catch (metaError) {
      console.error(`Failed to generate dynamic meta description for "${topic.title}", using fallback:`, metaError);
      // seoMetaDescription will remain topic.metaDescription (the pre-defined fallback)
    }
    
    // Create a new blog object for the individual blog file (with full content)
    const newBlogFile: BlogData = {
      title: topic.title,
      slug: topic.slug,
      publishDate: new Date().toISOString().replace('Z', '+00:00'),
      author: "Stoppr Team",
      category: topic.category,
      content: fullContent,
      metaDescription: seoMetaDescription, // Use the dynamically generated or fallback meta description
      articleId: uuidv4(),
      tags: topic.tags
    };
    
    // Create a new blog object for the index file (with preview content)
    const newBlogIndex: BlogData = {
      ...newBlogFile,
      content: previewContent
    };
    
    // Generate image using Ideogram API
    console.log(`Generating image for: ${topic.title}`);
    
    // The text overlay is handled directly in the generateBlogImage function
    const imageUrl = await generateBlogImage(topic.title, topic.category, additionalContext);
    
    if (!imageUrl) {
      console.warn('No valid image generated (all contained text). Skipping image download and featuredImage for this blog.');
      // Continue without setting featuredImage
      // Save the blog JSON file (with full content)
      const now = new Date();
      const dateStr = `${(now.getMonth() + 1).toString().padStart(2, '0')}-${now.getDate().toString().padStart(2, '0')}-${now.getFullYear()}`;
      const datedBlogDir = path.join(BLOG_DATA_DIR, dateStr);
      if (!fs.existsSync(datedBlogDir)) {
        fs.mkdirSync(datedBlogDir, { recursive: true });
      }
      const blogFilePath = path.join(datedBlogDir, `${topic.slug}.json`);
      const relativeBlogFilePath = path.join(dateStr, `${topic.slug}.json`);
      newBlogFile.filePath = relativeBlogFilePath;
      newBlogIndex.filePath = relativeBlogFilePath;
      fs.writeFileSync(blogFilePath, JSON.stringify(newBlogFile, null, 2));
      console.log(`Created blog file (no image): ${blogFilePath}`);
      (generateBlog as any).generatedBlogs = (generateBlog as any).generatedBlogs || [];
      (generateBlog as any).generatedBlogs.push(newBlogIndex);
      return topic.slug;
    }
    
    // Download the image - Ideogram images are temporary, so we need to download and save them
    console.log('Downloading image...');
    const response = await fetch(imageUrl);
    if (!response.ok) {
      throw new Error(`Failed to download image: ${response.statusText}`);
    }
    
    // Save the image locally
    const imageData = await response.arrayBuffer();
    const imageName = `${topic.slug}.jpg`;
    
    // --- NEW: Create dated folder for the image ---
    const now = new Date();
    const dateStr = `${(now.getMonth() + 1).toString().padStart(2, '0')}-${now.getDate().toString().padStart(2, '0')}-${now.getFullYear()}`;
    const datedImagesDir = path.join(BLOG_IMAGES_DIR, dateStr);
    
    // Ensure the dated directory exists
    if (!fs.existsSync(datedImagesDir)) {
      fs.mkdirSync(datedImagesDir, { recursive: true });
    }
    
    // Update imagePath to save inside the dated directory
    const imagePath = path.join(datedImagesDir, imageName);
    // --- END NEW ---
    
    fs.writeFileSync(imagePath, Buffer.from(imageData));
    console.log(`Saved image to: ${imagePath}`);
    
    // Define the relative image path
    const relativeImagePath = `/images/blog/${dateStr}/${imageName}`;
    
    // --- NEW: Optimize the image using the optimize-images.js script ---
    try {
      console.log('Optimizing blog image...');
      // Run the optimize-images.js script with the image path as an argument
      execSync(`node scripts/optimize-images.js "${imagePath}"`, { stdio: 'inherit' });
      console.log('Image optimization completed successfully');
      
      // Update the image path to use the optimized version
      const ext = path.extname(imagePath);
      const baseName = imagePath.slice(0, -ext.length);
      const dir = path.dirname(baseName);
      const optimizedPath = `${dir}/optimized/${path.basename(baseName)}`;
      
      // Update the image path in the blog data to use the WebP version (best performance)
      const relativeOptimizedDir = path.join(path.dirname(relativeImagePath), 'optimized');
      const relativeOptimizedBaseName = path.basename(relativeImagePath, ext);
      const relativeOptimizedPath = `${relativeOptimizedDir}/${relativeOptimizedBaseName}.webp`;
      
      newBlogFile.featuredImage = relativeOptimizedPath;
      newBlogIndex.featuredImage = relativeOptimizedPath;
      
      console.log(`Updated featured image path to optimized version: ${relativeOptimizedPath}`);
    } catch (optimizeError) {
      console.error('Error optimizing image:', optimizeError);
      // If optimization fails, keep using the original image
      newBlogFile.featuredImage = relativeImagePath;
      newBlogIndex.featuredImage = relativeImagePath;
    }
    // --- END NEW OPTIMIZATION CODE ---
    
    // --- NEW: Create dated folder and update file path ---
    const datedBlogDir = path.join(BLOG_DATA_DIR, dateStr);
    
    // Ensure the dated directory exists
    if (!fs.existsSync(datedBlogDir)) {
      fs.mkdirSync(datedBlogDir, { recursive: true });
    }
    
    // Update blog file path to be inside the dated directory
    const blogFilePath = path.join(datedBlogDir, `${topic.slug}.json`);
    const relativeBlogFilePath = path.join(dateStr, `${topic.slug}.json`); // Path relative to BLOG_DATA_DIR
    // --- END NEW ---
    
    // Add the relative file path to the blog data
    newBlogFile.filePath = relativeBlogFilePath;
    newBlogIndex.filePath = relativeBlogFilePath;
    
    // Save the blog JSON file (with full content)
    fs.writeFileSync(blogFilePath, JSON.stringify(newBlogFile, null, 2));
    console.log(`Created blog file: ${blogFilePath}`);
    
    // Store the index version (with preview) in the closure for the updateIndexFile function
    (generateBlog as any).generatedBlogs = (generateBlog as any).generatedBlogs || [];
    (generateBlog as any).generatedBlogs.push(newBlogIndex);
    
    return topic.slug;
  } catch (error) {
    // Catch errors from preview/image generation or file saving AFTER content generation succeeded
    // OR catch the re-thrown error from content generation failure
    console.error(`Error processing blog topic "${topic.title}":`, error);
    return null; // Indicate failure for this topic
  }
}

/**
 * Update the index.json file with the new blogs
 */
function updateIndexFile(newSlugs: string[]): void {
  try {
    console.log('Rebuilding index.json from scratch...');
    const allPosts: BlogData[] = [];

    // Function to read blog JSON safely
    const readBlogJson = (filePath: string): BlogData | null => {
      try {
        const content = fs.readFileSync(filePath, 'utf8');
        const data = JSON.parse(content) as Partial<BlogData>; // Read as partial to check fields

        // Ensure essential 'slug' and 'title' are present
        if (!data.slug || !data.title) {
          console.warn(`Skipping invalid blog file (missing slug or title): ${filePath}`);
          return null;
        }

        // Provide default for missing publishDate
        if (!data.publishDate) {
          console.warn(`Blog file missing publishDate, using default: ${filePath}`);
          data.publishDate = '1970-01-01T00:00:00.000+00:00'; // Default date
        }

        // We have the required fields (or defaults), cast back to full BlogData
        // Note: Other fields might still be missing, but we allow it for index generation
        return data as BlogData;

      } catch (readError) {
        console.error(`Error reading or parsing blog file ${filePath}:`, readError);
        return null;
      }
    };

    // Scan the main BLOG_DATA_DIR for root-level JSON files (old posts)
    const rootItems = fs.readdirSync(BLOG_DATA_DIR);
    for (const item of rootItems) {
      const fullPath = path.join(BLOG_DATA_DIR, item);
      const stat = fs.statSync(fullPath);
      if (stat.isFile() && item.endsWith('.json') && item !== 'index.json') {
        const blogData = readBlogJson(fullPath);
        if (blogData) {
          // Generate preview content if needed (or use existing content as placeholder)
          // For simplicity here, we'll just use the first ~300 chars of content
          // In a real scenario, you might call generatePreviewContent or store it
          const previewContent = blogData.content ? blogData.content.substring(0, 300) + '...' : '';
          
          // If filePath is missing, set it to the filename (legacy format)
          if (!blogData.filePath) {
            blogData.filePath = item;
          }
          
          allPosts.push({
            ...blogData,
            content: previewContent, // Use preview content
            filePath: blogData.filePath || item // Path relative to BLOG_DATA_DIR is just the filename
          });
        }
      } 
      // Check if item is a directory (potential date folder)
      else if (stat.isDirectory()) {
        // Basic check if directory name looks like a date MM-DD-YYYY
        if (/^\d{2}-\d{2}-\d{4}$/.test(item)) {
          const dateDirPath = path.join(BLOG_DATA_DIR, item);
          const dateDirItems = fs.readdirSync(dateDirPath);
          for (const blogFile of dateDirItems) {
            if (blogFile.endsWith('.json')) {
              const blogFilePath = path.join(dateDirPath, blogFile);
              const blogData = readBlogJson(blogFilePath);
              if (blogData) {
                // Generate preview content (similar placeholder logic)
                 const previewContent = blogData.content ? blogData.content.substring(0, 300) + '...' : '';
                
                 allPosts.push({
                    ...blogData,
                    content: previewContent, // Use preview content
                    filePath: path.join(item, blogFile) // Path relative to BLOG_DATA_DIR
                 });
              }
            }
          }
        }
      }
    }

    // Sort all posts by publish date (newest first)
    allPosts.sort((a, b) => new Date(b.publishDate).getTime() - new Date(a.publishDate).getTime());

    // Limit the overall set of tags to the 10 most frequent ones across all posts
    const tagFrequency: Record<string, number> = {};
    for (const post of allPosts) {
      if (post.tags && post.tags.length) {
        post.tags.forEach(tag => {
          tagFrequency[tag] = (tagFrequency[tag] || 0) + 1;
        });
      }
    }

    // Determine the 10 most common tags
    const topTags = Object.entries(tagFrequency)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([tag]) => tag);

    // Filter each post's tags so that only the top tags remain
    for (const post of allPosts) {
      if (post.tags && post.tags.length) {
        post.tags = post.tags.filter(tag => topTags.includes(tag));
      }
    }

    // Create the final index data structure
    const indexData = {
      lastUpdated: new Date().toISOString(),
      posts: allPosts
    };

    // Save the updated index file
    fs.writeFileSync(INDEX_FILE, JSON.stringify(indexData, null, 2));
    console.log(`Successfully rebuilt index.json with ${allPosts.length} posts.`);

  } catch (error) {
    console.error('Error rebuilding index file:', error);
    throw error; // Re-throw error to indicate failure
  }
}

/**
 * Update the sitemap.xml file with new blog posts
 */
function updateSitemap(newSlugs: string[]): void {
  try {
    console.log('Updating sitemap.xml with new blog posts...');
    
    // Check if sitemap exists
    if (!fs.existsSync(SITEMAP_FILE)) {
      console.error('Sitemap file not found:', SITEMAP_FILE);
      return;
    }
    
    // Read the current sitemap
    const sitemapContent = fs.readFileSync(SITEMAP_FILE, 'utf8');
    
    // Simple XML parsing and manipulation
    // We'll insert the new blog entries right before the closing </urlset> tag
    const closingTag = '</urlset>';
    const closingTagIndex = sitemapContent.lastIndexOf(closingTag);
    
    if (closingTagIndex === -1) {
      console.error('Invalid sitemap format, missing </urlset> closing tag');
      return;
    }
    
    // Create new entries for the blogs
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
    let newEntries = '';
    
    for (const slug of newSlugs) {
      const blogUrl = `https://www.stoppr.app/blog/${slug}`;
      
      // Check if the URL already exists in the sitemap
      if (sitemapContent.includes(`<loc>${blogUrl}</loc>`)) {
        console.log(`URL already exists in sitemap: ${blogUrl}`);
        continue;
      }
      
      // Create new entry
      newEntries += `  <url>
    <loc>${blogUrl}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.6</priority>
  </url>
`;
    }
    
    // If we have new entries, update the sitemap
    if (newEntries) {
      // Insert the new entries before the closing tag
      const updatedSitemap = 
        sitemapContent.substring(0, closingTagIndex) + 
        newEntries + 
        sitemapContent.substring(closingTagIndex);
      
      // Write the updated sitemap back to the file
      fs.writeFileSync(SITEMAP_FILE, updatedSitemap);
      console.log(`Updated sitemap.xml with ${newSlugs.length} new blog posts`);
    } else {
      console.log('No new entries added to sitemap');
    }
  } catch (error) {
    console.error('Error updating sitemap:', error);
    // Don't throw the error so the script can continue
  }
}

/**
 * Update the llms.txt file with new blog posts
 */
function updateLlmsTxt(newSlugs: string[]): void {
  try {
    console.log('Updating llms.txt with new blog posts...');

    const LLMS_FILE = path.resolve(process.cwd(), 'public/llms.txt');

    if (!fs.existsSync(LLMS_FILE)) {
      console.error('llms.txt file not found:', LLMS_FILE);
      return;
    }

    // Read the updated index.json to retrieve post details
    const indexRaw = fs.readFileSync(INDEX_FILE, 'utf8');
    const indexData = JSON.parse(indexRaw);

    // Build a quick lookup for slug -> post details
    const slugToPost: Record<string, { title: string; metaDescription: string }> = {};
    if (indexData && Array.isArray(indexData.posts)) {
      for (const post of indexData.posts) {
        slugToPost[post.slug] = {
          title: post.title,
          metaDescription: post.metaDescription
        };
      }
    }

    const llmsContent = fs.readFileSync(LLMS_FILE, 'utf8');
    const lines = llmsContent.split('\n');

    // Locate the "## Blog Posts" section
    const sectionStart = lines.findIndex(line => line.trim().startsWith('## Blog Posts'));
    if (sectionStart === -1) {
      console.error('## Blog Posts section not found in llms.txt');
      return;
    }

    // Determine where the section ends (next header or EOF)
    let sectionEnd = lines.length;
    for (let i = sectionStart + 1; i < lines.length; i++) {
      if (lines[i].trim().startsWith('## ')) {
        sectionEnd = i;
        break;
      }
    }

    const existingSectionText = lines.slice(sectionStart + 1, sectionEnd).join('\n');
    const newLines: string[] = [];

    for (const slug of newSlugs) {
      const post = slugToPost[slug];
      if (!post) {
        console.warn(`Post for slug "${slug}" not found in index.json`);
        continue;
      }

      const blogUrl = `https://www.stoppr.app/blog/${slug}`;
      if (existingSectionText.includes(`(${blogUrl})`)) {
        console.log(`Blog already listed in llms.txt: ${blogUrl}`);
        continue;
      }

      newLines.push(`- [${post.title}](${blogUrl}): ${post.metaDescription}`);
    }

    if (newLines.length === 0) {
      console.log('No new entries added to llms.txt');
      return;
    }

    // Insert new lines before the sectionEnd index
    const updatedContent = [
      ...lines.slice(0, sectionEnd),
      ...newLines,
      ...lines.slice(sectionEnd)
    ].join('\n');

    fs.writeFileSync(LLMS_FILE, updatedContent);
    console.log(`Updated llms.txt with ${newLines.length} new blog posts`);
  } catch (error) {
    console.error('Error updating llms.txt:', error);
    // Don't throw the error so the script can continue
  }
}

/**
 * Run the daily blog generation
 */
async function main(): Promise<void> {
  try {
    console.log('Starting daily blog generation...');
    
    // Read the desired number of blogs from command line arguments
    // Default to 1 if no argument is provided or if it's not a valid number
    const args = process.argv.slice(2);
    let numBlogsToGenerate = 1; // Default value
    if (args.length > 0) {
      const parsedNum = parseInt(args[0], 10);
      if (!isNaN(parsedNum) && parsedNum > 0) {
        numBlogsToGenerate = parsedNum;
      }
    }
    console.log(`Requested to generate ${numBlogsToGenerate} blog(s)`);

    // Generate topics for today
    // We might generate more topics than needed, but we'll only use the requested number
    const allDailyTopics = generateDailyTopics(); 
    
    // Slice the topics array to get only the number we need to generate
    const topicsToProcess = allDailyTopics.slice(0, numBlogsToGenerate);
    
    if (topicsToProcess.length === 0) {
      console.log('No topics available to generate blogs.');
      return; // Exit if no topics
    }

    console.log(`Generating ${topicsToProcess.length} blog(s) for today`);
    
    // Generate each blog for the selected topics
    const generatedSlugs: string[] = [];
    let failedBlogs = 0;
    for (const topic of topicsToProcess) {
      try {
        const slug = await generateBlog(topic);
        if (slug) { // Check if blog generation succeeded
          generatedSlugs.push(slug);
        } else {
          failedBlogs++;
        }
      } catch (blogError) {
        // Catch errors re-thrown from generateBlog (e.g., content gen failure)
        console.error(`Skipping topic "${topic.title}" due to critical error during generation.`);
        failedBlogs++;
      }
      // Add a delay to avoid rate limiting, even if a blog failed
      if (topicsToProcess.indexOf(topic) < topicsToProcess.length - 1) {
         await new Promise(resolve => setTimeout(resolve, 5000));
      }
    }

    // Only update index/sitemap if some blogs succeeded
    if (generatedSlugs.length > 0) {
        // Update the index file
        updateIndexFile(generatedSlugs);
        
        // Update the sitemap with new blog posts
        updateSitemap(generatedSlugs);
        // Update llms.txt with new blog posts
        updateLlmsTxt(generatedSlugs);
    } else {
        console.log("No blogs were successfully generated.");
    }
    
    console.log(`Daily blog generation finished. Success: ${generatedSlugs.length}, Failed: ${failedBlogs}`);
    
    // Exit with error code if any blogs failed
    if (failedBlogs > 0) {
        process.exit(1);
    }

  } catch (error) {
    console.error('Critical error in daily blog generation main process:', error);
    process.exit(1);
  }
}

// Run the script
main(); 