// Simple script to rebuild index.json without generating new blogs
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Get the directory name from the current file path
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Path configuration
const BLOG_DATA_DIR = path.resolve(process.cwd(), 'public/blog-data');
const INDEX_FILE = path.join(BLOG_DATA_DIR, 'index.json');

// Blog data interface
/**
 * @typedef {Object} BlogData
 * @property {string} title
 * @property {string} slug
 * @property {string} publishDate
 * @property {string} author
 * @property {string} category
 * @property {string} content
 * @property {string} metaDescription
 * @property {string} articleId
 * @property {string[]} tags
 * @property {string} [featuredImage]
 * @property {string} [filePath]
 */

/**
 * Update the index.json file with all existing blogs
 */
function updateIndexFile() {
  try {
    console.log('Rebuilding index.json from scratch...');
    const allPosts = [];

    // Function to read blog JSON safely
    const readBlogJson = (filePath) => {
      try {
        const content = fs.readFileSync(filePath, 'utf8');
        const data = JSON.parse(content);
        // Ensure essential fields are present
        if (data.slug && data.title && data.publishDate) {
          return data;
        }
        console.warn(`Skipping invalid blog file (missing essential fields): ${filePath}`);
        return null;
      } catch (readError) {
        console.error(`Error reading blog file ${filePath}:`, readError);
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

    // --- BEGIN ADDING RELATED POSTS LOGIC ---
    for (const post of allPosts) {
      const relatedCandidates = allPosts.filter(candidate => {
        if (candidate.slug === post.slug) {
          return false; // Exclude the post itself
        }
        // Check for shared tags
        const hasSharedTags = Array.isArray(post.tags) && Array.isArray(candidate.tags) &&
                              post.tags.some(tag => candidate.tags.includes(tag));
        // Check for same category
        const isInSameCategory = post.category && candidate.category && post.category === candidate.category;
        
        return hasSharedTags || isInSameCategory;
      });

      // Sort candidates by publish date (newest first) and take top 4 slugs
      post.relatedPostSlugs = relatedCandidates
        .sort((a, b) => new Date(b.publishDate).getTime() - new Date(a.publishDate).getTime())
        .slice(0, 4)
        .map(rp => rp.slug);
    }
    // --- END ADDING RELATED POSTS LOGIC ---

    // Limit tags to the 10 most frequent across all posts
    const tagFrequency = {};
    for (const post of allPosts) {
      if (Array.isArray(post.tags)) {
        post.tags.forEach(tag => {
          tagFrequency[tag] = (tagFrequency[tag] || 0) + 1;
        });
      }
    }

    const topTags = Object.entries(tagFrequency)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([tag]) => tag);

    for (const post of allPosts) {
      if (Array.isArray(post.tags)) {
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
    console.log('Index has been updated and now includes:');
    console.log('--------------------------------------');
    allPosts.slice(0, 5).forEach((post, idx) => {
      console.log(`${idx + 1}. ${post.title} (${post.slug})`);
    });
    console.log(`... and ${allPosts.length - 5} more posts`);

  } catch (error) {
    console.error('Error rebuilding index file:', error);
    process.exit(1);
  }
}

// Run the function
updateIndexFile(); 