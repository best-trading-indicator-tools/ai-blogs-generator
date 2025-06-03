import { readdir, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import sharp from 'sharp';

const QUALITY = {
  webp: 80,
  avif: 65,
};

/**
 * Optimize all images in the public/images directory
 * Creates multiple formats:
 * - .webp (80% quality)
 * - .avif (65% quality) 
 * - Resized original at 60% quality for PNG/JPG
 */
async function optimizeImages() {
  try {
    console.log('🔍 Starting image optimization...');

    // Get image paths from command line arguments, excluding script path itself
    const imagePaths = process.argv.slice(2); 

    if (imagePaths.length === 0) {
      console.error('❌ Error: No image paths provided as arguments.');
      console.log('Usage: npm run optimize-images <path/to/image1.png> <path/to/image2.jpg> ...');
      return; 
    }

    console.log(`Found ${imagePaths.length} images to process from arguments:`);
    imagePaths.forEach(p => console.log(`  - ${p}`));

    // Process each image
    let successCount = 0;
    let errorCount = 0;
    const optimizedList = [];
    
    for (const imagePath of imagePaths) {
      try {
        // Skip SVGs
        if (imagePath.toLowerCase().endsWith('.svg')) {
          continue;
        }
        
        // Skip already optimized files
        if (imagePath.includes('-optimized') || 
            imagePath.endsWith('.webp') || 
            imagePath.endsWith('.avif')) {
          continue;
        }
        
        console.log(`Processing: ${imagePath}`);
        
        // Get image dimensions
        const metadata = await sharp(imagePath).metadata();
        
        // Create base name for optimized versions
        const ext = path.extname(imagePath);
        const baseName = imagePath.slice(0, -ext.length);
        const dir = path.dirname(baseName);
        
        // Ensure optimized directory exists
        if (!existsSync(`${dir}/optimized`)) {
          await mkdir(`${dir}/optimized`, { recursive: true });
        }
        
        // Create optimized versions
        const optimizedPath = `${dir}/optimized/${path.basename(baseName)}`;
        
        // WebP version
        try {
          await sharp(imagePath)
            .webp({ quality: QUALITY.webp })
            .toFile(`${optimizedPath}.webp`);
          optimizedList.push(`${optimizedPath}.webp`);
          console.log(`  ✓ Successfully created ${optimizedPath}.webp`);
        } catch (err) {
          console.error(`  ✗ Error creating WebP for ${imagePath}:`, err);
        }
        
        // AVIF version
        try {
          await sharp(imagePath)
            .avif({ quality: QUALITY.avif })
            .toFile(`${optimizedPath}.avif`);
          optimizedList.push(`${optimizedPath}.avif`);
          console.log(`  ✓ Successfully created ${optimizedPath}.avif`);
        } catch (err) {
          console.error(`  ✗ Error creating AVIF for ${imagePath}:`, err);
        }
        
        // Compressed original format (if not already a WebP or AVIF)
        if (['.jpg', '.jpeg', '.png'].includes(ext.toLowerCase())) {
          try {
            await sharp(imagePath)
              .jpeg({ quality: 75 }) // Assuming JPG/JPEG for simplicity, adjust if PNG needs separate handling
              .toFile(`${optimizedPath}-optimized${ext}`);
            optimizedList.push(`${optimizedPath}-optimized${ext}`);
            console.log(`  ✓ Successfully created ${optimizedPath}-optimized${ext}`);
          } catch (err) {
            console.error(`  ✗ Error creating compressed ${ext} for ${imagePath}:`, err);
          }
        }
        
        // Create mobile version (50% width) if larger than 1000px wide
        if (metadata.width > 1000) {
          const newWidth = Math.floor(metadata.width * 0.5);
          const newHeight = Math.floor(metadata.height * 0.5);
          
          // Mobile WebP
          try {
            await sharp(imagePath)
              .resize(newWidth, newHeight)
              .webp({ quality: QUALITY.webp })
              .toFile(`${optimizedPath}-mobile.webp`);
            optimizedList.push(`${optimizedPath}-mobile.webp`);
            console.log(`  ✓ Successfully created ${optimizedPath}-mobile.webp`);
          } catch (err) {
            console.error(`  ✗ Error creating mobile WebP for ${imagePath}:`, err);
          }
          
          // Mobile AVIF
          try {
            await sharp(imagePath)
              .resize(newWidth, newHeight)
              .avif({ quality: QUALITY.avif })
              .toFile(`${optimizedPath}-mobile.avif`);
            optimizedList.push(`${optimizedPath}-mobile.avif`);
            console.log(`  ✓ Successfully created ${optimizedPath}-mobile.avif`);
          } catch (err) {
            console.error(`  ✗ Error creating mobile AVIF for ${imagePath}:`, err);
          }
          
          // Mobile original format
          try {
            await sharp(imagePath)
              .resize(newWidth, newHeight)
              .jpeg({ quality: 75 }) // Assuming JPG/JPEG
              .toFile(`${optimizedPath}-mobile${ext}`);
            optimizedList.push(`${optimizedPath}-mobile${ext}`);
            console.log(`  ✓ Successfully created ${optimizedPath}-mobile${ext}`);
          } catch (err) {
            console.error(`  ✗ Error creating mobile ${ext} for ${imagePath}:`, err);
          }
        }
        
        successCount++;
      } catch (err) {
        console.error(`Error processing ${imagePath}:`, err);
        errorCount++;
      }
    }
    
    console.log(`
    ✅ Image optimization complete!
    ✓ Successfully processed: ${successCount} images
    ❌ Errors: ${errorCount} images
    
    Next steps:
    1. The optimized images are in [original-directory]/optimized/
    2. Update your <picture> elements to use these new formats
    3. Consider moving the optimized versions to replace the originals
    `);
    
  } catch (err) {
    console.error('Error optimizing images:', err);
  }
}

// Run the optimization
optimizeImages(); 