/**
 * Optimize Existing Blog Images
 * 
 * This script scans all blog images in the public/images/blog directory,
 * runs the optimize-images.js script on them, and updates the blog post JSON
 * files to reference the optimized versions.
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { glob } from 'glob';

// Path configuration
const BLOG_IMAGES_DIR = path.resolve(process.cwd(), 'public/images/blog');
const BLOG_DATA_DIR = path.resolve(process.cwd(), 'public/blog-data');

// Track stats
const stats = {
  totalImages: 0,
  optimizedImages: 0,
  failedImages: 0,
  updatedPosts: 0,
  failedPosts: 0
};

/**
 * Optimize a single image
 * @param {string} imagePath - Path to the image file
 * @returns {string|null} Path to the optimized image or null if failed
 */
async function optimizeImage(imagePath) {
  try {
    console.log(`Optimizing: ${imagePath}`);
    
    // Run the optimize-images.js script on the image
    execSync(`node scripts/optimize-images.js "${imagePath}"`, { stdio: 'inherit' });
    
    // Calculate the path to the optimized WebP version
    const ext = path.extname(imagePath);
    const baseName = imagePath.slice(0, -ext.length);
    const dir = path.dirname(baseName);
    
    // The optimized directory and WebP version
    const optimizedDir = path.join(dir, 'optimized');
    const optimizedPath = path.join(optimizedDir, `${path.basename(baseName)}.webp`);
    
    // Check if the optimized file was created
    if (fs.existsSync(optimizedPath)) {
      console.log(`Successfully optimized: ${optimizedPath}`);
      return optimizedPath;
    } else {
      console.error(`Optimization failed: Optimized file not found at ${optimizedPath}`);
      return null;
    }
  } catch (error) {
    console.error(`Error optimizing image ${imagePath}:`, error);
    return null;
  }
}

/**
 * Update a blog post JSON file to use the optimized image
 * @param {string} jsonPath - Path to the blog post JSON file
 * @param {string} originalImagePath - Original image path (relative to public)
 * @param {string} relativeOptimizedWebPPath - Path to the optimized WebP image (relative to public)
 * @param {string} relativeOptimizedAvifPath - Path to the optimized AVIF image (relative to public)
 */
async function updateBlogPost(jsonPath, originalImagePath, relativeOptimizedWebPPath, relativeOptimizedAvifPath) {
  try {
    // Read the JSON file
    const rawContent = fs.readFileSync(jsonPath, 'utf8');
    const data = JSON.parse(rawContent);

    const originalImageRelativePath = originalImagePath.replace(path.resolve(process.cwd(), 'public'), '');

    // Determine which optimized path to use (prefer AVIF over WebP)
    let optimizedRelativePathToUse = null;
    const absoluteAvifPath = relativeOptimizedAvifPath ? path.join(process.cwd(), 'public', relativeOptimizedAvifPath) : null;
    const absoluteWebPPath = relativeOptimizedWebPPath ? path.join(process.cwd(), 'public', relativeOptimizedWebPPath) : null;

    if (absoluteAvifPath && fs.existsSync(absoluteAvifPath)) {
      optimizedRelativePathToUse = relativeOptimizedAvifPath;
    } else if (absoluteWebPPath && fs.existsSync(absoluteWebPPath)) {
      optimizedRelativePathToUse = relativeOptimizedWebPPath;
    }

    if (!optimizedRelativePathToUse) {
      return false; // No optimized image available
    }

    let updated = false;

    // 1. Update featuredImage if present and matches the original image base name
    if (data.featuredImage) {
      const originalImageBaseName = path.basename(originalImagePath).replace(/\.[^.]+$/, '');
      if (data.featuredImage.includes(originalImageBaseName) && data.featuredImage !== optimizedRelativePathToUse) {
        data.featuredImage = optimizedRelativePathToUse;
        updated = true;
      }
    }

    // 2. Replace inline image references inside the content field
    if (data.content && typeof data.content === 'string' && data.content.includes(originalImageRelativePath)) {
      data.content = data.content.split(originalImageRelativePath).join(optimizedRelativePathToUse);
      updated = true;
    }

    if (updated) {
      fs.writeFileSync(jsonPath, JSON.stringify(data, null, 2));
      console.log(`✅ Updated blog post JSON (inline/featured): ${jsonPath}`);
    }

    return updated;
  } catch (error) {
    console.error(`Error updating blog post ${jsonPath}:`, error);
    return false;
  }
}

/**
 * Main function to run the optimization process
 */
async function main() {
  try {
    console.log('🔍 Starting blog image optimization...');
    
    const imageFiles = glob.sync(`${BLOG_IMAGES_DIR}/**/*.{jpg,jpeg,png}`, { 
      ignore: [`${BLOG_IMAGES_DIR}/**/optimized/**`] 
    });
    
    stats.totalImages = imageFiles.length;
    console.log(`Found ${stats.totalImages} blog images to process (excluding those already in /optimized/ subdirs).`);
    
    const PUBLIC_DIR = path.resolve(process.cwd(), 'public');

    for (const imagePath of imageFiles) { // imagePath is absolute
      const dir = path.dirname(imagePath);
      const baseNameNoExt = path.basename(imagePath, path.extname(imagePath));
      const optimizedDir = path.join(dir, 'optimized');
      const webpPathAbsolute = path.join(optimizedDir, `${baseNameNoExt}.webp`);
      const avifPathAbsolute = path.join(optimizedDir, `${baseNameNoExt}.avif`);

      let optimizedWebPPathAbsolute = fs.existsSync(webpPathAbsolute) ? webpPathAbsolute : null;
      const avifExists = fs.existsSync(avifPathAbsolute);

      // Only run optimise if either WebP or AVIF is missing
      if (!optimizedWebPPathAbsolute || !avifExists) {
        const result = await optimizeImage(imagePath);
        if (result) {
          optimizedWebPPathAbsolute = result; // optimization guarantees webp
          stats.optimizedImages++;
        } else {
          stats.failedImages++;
          continue; // Can't proceed without at least webp
        }
      }

      // Prepare relative paths (they may have existed before optimisation)
      const relativeOptimizedWebP = optimizedWebPPathAbsolute ? optimizedWebPPathAbsolute.replace(PUBLIC_DIR, '') : null;
      const relativeOptimizedAvif = fs.existsSync(avifPathAbsolute) ? avifPathAbsolute.replace(PUBLIC_DIR, '') : null;
      const blogJsonFiles = glob.sync(`${BLOG_DATA_DIR}/**/*.json`, { ignore: [`${BLOG_DATA_DIR}/index.json`] });

      for (const jsonPath of blogJsonFiles) {
        const updated = await updateBlogPost(
          jsonPath,
          imagePath,
          relativeOptimizedWebP,
          relativeOptimizedAvif
        );
        if (updated) {
          stats.updatedPosts++;
        }
      }
    }
    
    console.log('Updating blog index.json...');
    const indexPath = path.join(BLOG_DATA_DIR, 'index.json');
    try {
      if (fs.existsSync(indexPath)) {
        const content = fs.readFileSync(indexPath, 'utf8');
        const indexData = JSON.parse(content);
        
        let indexUpdatedCount = 0;
        indexData.posts = indexData.posts.map(post => {
          if (post.featuredImage) {
            const currentFeaturedImageRelative = post.featuredImage;
            const originalImageBaseName = path.basename(currentFeaturedImageRelative).replace(/(-optimized)?\.(jpg|jpeg|png|webp|avif)$/i, '');
            
            const dateFolderPattern = /\/images\/blog\/([^\/]+)\//;
            const match = currentFeaturedImageRelative.match(dateFolderPattern);
            const dateFolder = match ? match[1] : null;

            if (!dateFolder && !currentFeaturedImageRelative.includes('/05-15-2025/')) { // Heuristic for older images not in date folders
                // console.log(`Skipping index update for ${currentFeaturedImageRelative} - no clear date folder and not today's test image.`);
                return post;
            }
            
            // Construct potential optimized paths
            // The baseName here should be from the *original* non-optimized name if possible.
            // currentFeaturedImageRelative might be /images/blog/DATE/optimized/BASENAME.webp
            // We need /images/blog/DATE/optimized/BASENAME.avif or .webp
            
            const optimizedDirRelative = path.dirname(currentFeaturedImageRelative).includes('/optimized') 
                ? path.dirname(currentFeaturedImageRelative)
                : path.join(path.dirname(currentFeaturedImageRelative), 'optimized');

            const candidateAvifRelative = path.join(optimizedDirRelative, `${originalImageBaseName}.avif`);
            const candidateWebpRelative = path.join(optimizedDirRelative, `${originalImageBaseName}.webp`);

            const candidateAvifAbsolute = path.join(process.cwd(), 'public', candidateAvifRelative);
            const candidateWebpAbsolute = path.join(process.cwd(), 'public', candidateWebpRelative);

            let newFeaturedImageRelativePath = null;

            if (fs.existsSync(candidateAvifAbsolute)) {
              newFeaturedImageRelativePath = candidateAvifRelative;
            } else if (fs.existsSync(candidateWebpAbsolute)) {
              newFeaturedImageRelativePath = candidateWebpRelative;
            }

            if (newFeaturedImageRelativePath && currentFeaturedImageRelative !== newFeaturedImageRelativePath) {
              // console.log(`Index: Updating ${currentFeaturedImageRelative} to ${newFeaturedImageRelativePath}`);
              post.featuredImage = newFeaturedImageRelativePath;
              indexUpdatedCount++;
            } else if (newFeaturedImageRelativePath && currentFeaturedImageRelative === newFeaturedImageRelativePath) {
              // console.log(`Index: No update needed for ${currentFeaturedImageRelative}`);
            } else {
              // console.log(`Index: No AVIF/WebP found for base ${originalImageBaseName} (tried ${candidateAvifRelative}, ${candidateWebpRelative})`);
            }
          }
          return post;
        });
        
        if (indexUpdatedCount > 0) {
            indexData.lastUpdated = new Date().toISOString();
            fs.writeFileSync(indexPath, JSON.stringify(indexData, null, 2));
            console.log(`✅ Successfully updated blog index.json (${indexUpdatedCount} posts).`);
        } else {
            console.log('ℹ️ Blog index.json was already up-to-date with AVIF/WebP images.');
        }

      } else {
        console.warn('Blog index.json not found, skipping update');
      }
    } catch (error) {
      console.error('Error updating blog index.json:', error);
      stats.failedPosts++;
    }
    
    console.log('\n🎉 Blog image optimization complete!');
    console.log(`✅ Total images found: ${stats.totalImages}`);
    console.log(`✅ Images successfully optimized: ${stats.optimizedImages}`);
    console.log(`❌ Images failed to optimize: ${stats.failedImages}`);
    console.log(`✅ Blog posts updated: ${stats.updatedPosts}`);
    console.log(`❌ Blog posts failed to update: ${stats.failedPosts}`);
    
    console.log('\nNext steps:');
    console.log('1. Verify the optimized images look good on the blog pages');
    console.log('2. Run a PageSpeed Insights test to confirm performance improvements');
    
  } catch (error) {
    console.error('Critical error in optimization process:', error);
    process.exit(1);
  }
}

// Run the script
main(); 