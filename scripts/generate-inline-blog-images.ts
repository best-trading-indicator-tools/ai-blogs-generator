/**
 * Script to generate inline blog images using Ideogram API
 * This script generates images for placeholders within the blog content
 */

import fs from 'fs';
import path from 'path';
import { generateBlogImage } from '../src/utils/ideogramApi';

// Path configuration
const BLOG_DATA_DIR = path.resolve(process.cwd(), 'public/blog-data');
const BLOG_IMAGES_DIR = path.resolve(process.cwd(), 'public/images/blog');
const INLINE_IMAGES_DIR = path.resolve(process.cwd(), 'public/images/blog/inline');

// Ensure the inline images directory exists
if (!fs.existsSync(INLINE_IMAGES_DIR)) {
  fs.mkdirSync(INLINE_IMAGES_DIR, { recursive: true });
}

// Interface for placeholder data
interface PlaceholderData {
  description: string;
  placeholderHtml: string;
}

/**
 * Extract image placeholders and their full HTML from blog content
 * @param content - HTML content of the blog
 * @returns Array of placeholder data objects
 */
function extractImagePlaceholders(content: string): PlaceholderData[] {
  const regex = /(<div class="blog-image-placeholder" data-description="([^"]+)"><\/div>)/g;
  const placeholders: PlaceholderData[] = [];
  let match;

  while ((match = regex.exec(content)) !== null) {
    placeholders.push({ 
      placeholderHtml: match[1], // Full div match
      description: match[2]      // Only the description
    });
  }

  return placeholders;
}

/**
 * Process a blog file and generate inline images for placeholders
 * @param filePath - Path to the blog JSON file
 */
async function processBlogFile(filePath: string): Promise<void> {
  try {
    // Read and parse the blog data file
    const fileContent = fs.readFileSync(filePath, 'utf8');
    const blogData = JSON.parse(fileContent);
    
    // --- NEW: Create dated folder structure for inline images --- 
    const slug = blogData.slug;
    const now = new Date();
    const dateStr = `${(now.getMonth() + 1).toString().padStart(2, '0')}-${now.getDate().toString().padStart(2, '0')}-${now.getFullYear()}`;
    const datedInlineDir = path.join(INLINE_IMAGES_DIR, dateStr); 
    const blogInlineImagesDir = path.join(datedInlineDir, slug);
    
    // Create folder for this blog's inline images if it doesn't exist
    if (!fs.existsSync(blogInlineImagesDir)) {
      fs.mkdirSync(blogInlineImagesDir, { recursive: true });
    }
    // --- END NEW ---
    
    // Extract all image placeholders from the content
    const allPlaceholders = extractImagePlaceholders(blogData.content);
    
    if (allPlaceholders.length === 0) {
      console.log(`No image placeholders found in blog: ${blogData.title}`);
      return;
    }
    
    console.log(`Found ${allPlaceholders.length} total image placeholders in blog: ${blogData.title}`);

    // Determine random number of images to generate (1 to 3, but no more than found)
    const numPlaceholdersFound = allPlaceholders.length;
    const numToGenerate = Math.min(numPlaceholdersFound, Math.floor(Math.random() * 3) + 1);
    console.log(`Randomly selected to generate ${numToGenerate} inline image(s).`);

    // Randomly select which placeholders to process
    // Shuffle the array and take the first numToGenerate
    const shuffledPlaceholders = allPlaceholders.sort(() => 0.5 - Math.random());
    const placeholdersToProcess = shuffledPlaceholders.slice(0, numToGenerate);
    
    // Extract category and additional context
    const category = Array.isArray(blogData.category) 
      ? blogData.category[0] 
      : blogData.category;
    
    const additionalContext = [
      ...(blogData.tags || []),
      blogData.metaDescription
    ].filter(Boolean).join('. ');
    
    // Generate and replace each selected image
    let updatedContent = blogData.content;
    let generatedCount = 0;
    let failedCount = 0;
    
    for (let i = 0; i < placeholdersToProcess.length; i++) {
      const placeholderData = placeholdersToProcess[i];
      const description = placeholderData.description;
      console.log(`Generating inline image ${i + 1}/${numToGenerate}: "${description}"`);
      
      // Track attempts for this specific image
      let imageGenerated = false;
      const maxAttempts = 2; // Try each image up to 2 times
      
      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
          if (attempt > 1) {
            console.log(`Retrying image generation (attempt ${attempt}/${maxAttempts}) for: "${description}"`);
          }
          
          // Generate an image based on the description - PASS false for includeTextOverlay
          const imageUrl = await generateBlogImage(
            `${blogData.title} - ${description}`, // Use description in title for context
            category,
            `${description}. ${additionalContext}`,
            false // Explicitly set includeTextOverlay to false for inline images
          );
          
          // If we get here, the image URL was obtained successfully
          
          // Download the image with timeout
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout
          
          try {
            const response = await fetch(imageUrl, { signal: controller.signal });
            clearTimeout(timeoutId);
            
            if (!response.ok) {
              throw new Error(`Failed to download image: ${response.status} ${response.statusText}`);
            }
            
            // Save the image locally
            const imageData = await response.arrayBuffer();
            // Use a unique index for the filename based on original position if needed, or just sequence
            const imageName = `inline-${generatedCount + 1}.jpg`; 
            const imagePath = path.join(blogInlineImagesDir, imageName);
            
            fs.writeFileSync(imagePath, Buffer.from(imageData));
            console.log(`✅ Saved inline image to: ${imagePath}`);
            
            // --- NEW: Update relative path for the image to include date --- 
            const relativeImagePath = `/images/blog/inline/${dateStr}/${slug}/${imageName}`; 
            // --- END NEW ---
            
            // Replace the specific placeholder HTML with an actual image tag
            const placeholderHtml = placeholderData.placeholderHtml;
            const imageTag = `<div class="blog-inline-image">
  <img src="${relativeImagePath}" alt="${description}" class="rounded-lg w-full" />
  <p class="text-center text-sm text-gray-600 mt-2">${description}</p>
</div>`;
            
            updatedContent = updatedContent.replace(placeholderHtml, imageTag);
            generatedCount++;
            imageGenerated = true;
            
            // Break out of retry loop if successful
            break;
          } catch (downloadError) {
            clearTimeout(timeoutId);
            console.error(`Failed to download or save image: ${downloadError instanceof Error ? downloadError.message : String(downloadError)}`);
            
            // Only throw if this is the last attempt
            if (attempt === maxAttempts) {
              throw downloadError;
            }
          }
        } catch (imageGenError) {
          const errorMessage = imageGenError instanceof Error ? imageGenError.message : String(imageGenError);
          console.error(`❌ Failed during image generation attempt ${attempt}/${maxAttempts}:`, errorMessage);
          
          // If this is the last attempt, log it and continue to the next image
          if (attempt === maxAttempts) {
            failedCount++;
            console.error(`All ${maxAttempts} attempts failed for image "${description}". Moving to next image.`);
          } else {
            // Add a slightly longer delay between retries
            await new Promise(resolve => setTimeout(resolve, 3000));
          }
        }
      }
      
      // Add a delay even if successful to prevent rate limiting
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    // Log the final results
    console.log(`Image generation complete for ${blogData.slug}:`);
    console.log(`- Successfully generated: ${generatedCount}/${numToGenerate} images`);
    console.log(`- Failed to generate: ${failedCount}/${numToGenerate} images`);
    
    // Update the blog data only if content was changed
    if (generatedCount > 0) {
        blogData.content = updatedContent;
        // Write the updated blog data back to the file
        fs.writeFileSync(filePath, JSON.stringify(blogData, null, 2));
        console.log(`Updated blog content with ${generatedCount} inline images for: ${blogData.slug}`);
    } else {
        console.log(`No inline images were generated or replaced for: ${blogData.slug}`);
    }
    
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
    
    // --- NEW: Update logic to find blog files in dated subfolders --- 
    const blogFiles: string[] = [];
    // Check root directory first (for older blogs)
    files
      .filter(file => file.endsWith('.json') && file !== 'index.json')
      .forEach(file => blogFiles.push(path.join(BLOG_DATA_DIR, file)));
      
    // Check dated subdirectories
    files
      .filter(file => fs.statSync(path.join(BLOG_DATA_DIR, file)).isDirectory())
      .forEach(dir => {
        const datedFiles = fs.readdirSync(path.join(BLOG_DATA_DIR, dir));
        datedFiles
          .filter(file => file.endsWith('.json'))
          .forEach(file => blogFiles.push(path.join(BLOG_DATA_DIR, dir, file)));
      });
    console.log(`Found ${blogFiles.length} total blog files (including dated folders).`);
    // --- END NEW ---
    
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
    console.log(`Processing ${blogFiles.length} blog files for inline images...`);
    for (const file of blogFiles) {
      await processBlogFile(file);
      // Add a small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    console.log('All inline blog images have been generated and updated.');
  } catch (error) {
    console.error('Error in main process:', error);
  }
}

// Handle command line arguments
const slugArg = process.argv[2];
main(slugArg); 