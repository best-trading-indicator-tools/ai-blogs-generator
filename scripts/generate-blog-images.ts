/**
 * Script to generate blog images using Ideogram API
 * This script can be run during the blog generation process to create images for new blog posts
 */

import fs from 'fs';
import path from 'path';
import { generateBlogImage } from '../src/utils/ideogramApi';

// Path configuration
const BLOG_DATA_DIR = path.resolve(process.cwd(), 'public/blog-data');
const BLOG_IMAGES_DIR = path.resolve(process.cwd(), 'public/images/blog');

// Ensure the blog images directory exists
if (!fs.existsSync(BLOG_IMAGES_DIR)) {
  fs.mkdirSync(BLOG_IMAGES_DIR, { recursive: true });
}

/**
 * Parse a blog data file and extract relevant information for image generation
 * @param filePath - Path to the blog JSON file
 */
async function processBlogFile(filePath: string): Promise<void> {
  try {
    // Read and parse the blog data file
    const fileContent = fs.readFileSync(filePath, 'utf8');
    const blogData = JSON.parse(fileContent);
    
    // Skip if already has a local image (not an external URL)
    if (blogData.featuredImage && !blogData.featuredImage.startsWith('http')) {
      console.log(`Blog ${blogData.slug} already has a local image: ${blogData.featuredImage}`);
      return;
    }
    
    // Generate image based on blog data
    console.log(`Generating image for blog: ${blogData.title}`);
    
    // Extract category - either a string or the first item in an array
    const category = Array.isArray(blogData.category) 
      ? blogData.category[0] 
      : blogData.category;
    
    // Generate additional context from tags and meta description
    const additionalContext = [
      ...(blogData.tags || []),
      blogData.metaDescription
    ].filter(Boolean).join('. ');
    
    // Generate the image
    const imageUrl = await generateBlogImage(
      blogData.title,
      category,
      additionalContext
    );
    
    // Download the image
    const response = await fetch(imageUrl);
    if (!response.ok) {
      throw new Error(`Failed to download image: ${response.statusText}`);
    }
    
    // Save the image locally
    const imageData = await response.arrayBuffer();
    const imageName = `${blogData.slug}.jpg`;
    const imagePath = path.join(BLOG_IMAGES_DIR, imageName);
    
    fs.writeFileSync(imagePath, Buffer.from(imageData));
    console.log(`Saved image to: ${imagePath}`);
    
    // Update the blog JSON with the new local image path
    const relativeImagePath = `/images/blog/${imageName}`;
    blogData.featuredImage = relativeImagePath;
    
    // Add alt text for the featured image
    blogData.featuredImageAlt = `Image illustrating ${blogData.title}`;
    
    // Update the image in the content if it exists
    if (blogData.content) {
      blogData.content = blogData.content.replace(
        /<img src="(https?:\/\/[^"]+)"([^>]*)>/g,
        `<img src="${relativeImagePath}" alt="${blogData.featuredImageAlt}"$2>`
      );
    }
    
    // Write the updated blog data back to the file
    fs.writeFileSync(filePath, JSON.stringify(blogData, null, 2));
    console.log(`Updated blog data for: ${blogData.slug}`);
    
  } catch (error) {
    console.error(`Error processing blog file ${filePath}:`, error);
  }
}

/**
 * Process all blog files or a specific one if provided
 * @param specificSlug - Optional specific blog slug to process
 */
async function main(specificSlug?: string): Promise<void> {
  try {
    const files = fs.readdirSync(BLOG_DATA_DIR);
    
    // Filter for JSON files and exclude index.json
    const blogFiles = files
      .filter(file => file.endsWith('.json') && file !== 'index.json')
      .map(file => path.join(BLOG_DATA_DIR, file));
    
    // If a specific slug is provided, only process that file
    if (specificSlug) {
      const specificFile = blogFiles.find(file => file.includes(specificSlug));
      if (specificFile) {
        await processBlogFile(specificFile);
      } else {
        console.error(`Blog file for slug "${specificSlug}" not found.`);
      }
      return;
    }
    
    // Process all blog files
    console.log(`Processing ${blogFiles.length} blog files...`);
    for (const file of blogFiles) {
      await processBlogFile(file);
      // Add a small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    console.log('All blog images have been generated and updated.');
  } catch (error) {
    console.error('Error in main process:', error);
  }
}

// Handle command line arguments
const slugArg = process.argv[2];
main(slugArg); 