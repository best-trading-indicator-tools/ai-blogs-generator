#!/bin/bash

# Script to run keyword discovery, topic generation, blog generation, and then generate inline images
# for the newly created blogs

# Current directory
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$DIR")"
BLOG_DATA_DIR="$ROOT_DIR/public/blog-data"

# Get the desired number of blogs from the first argument, default to 1
NUM_BLOGS_TO_GENERATE=${1:-1}
echo "🔢 Number of blogs to generate: $NUM_BLOGS_TO_GENERATE"

echo "🚀 Starting full blog generation process..."

# Step 1: Discover trending keywords
echo "🔍 Step 1: Discovering trending keywords..."
cd $ROOT_DIR
tsx scripts/keyword-trend-discovery.ts

# Check if the keyword discovery script was successful
if [ $? -ne 0 ]; then
  echo "❌ Keyword discovery failed. Exiting script."
  exit 1
fi

# Step 2: Generate enhanced topics using trend data
echo "🧠 Step 2: Generating optimized topics..."
tsx scripts/enhanced-topic-generator.ts

# Add exit check if needed for topic generation

# Step 3: Run daily blog generation with enhanced topics, passing the number
echo "📝 Step 3: Generating daily blogs..."
npm run daily-blog -- $NUM_BLOGS_TO_GENERATE

# Check if the daily blog generation script was successful
if [ $? -ne 0 ]; then
  echo "❌ Daily blog generation (Step 3) failed. Exiting script."
  exit 1
fi

# --- BEGIN ADDING REBUILD INDEX --- #
echo "🔄 Step 3.5: Rebuilding blog index to include related posts..."
node scripts/rebuild-index.js

# Check if the rebuild-index script was successful
if [ $? -ne 0 ]; then
  echo "❌ Rebuilding blog index (Step 3.5) failed. Exiting script."
  exit 1
fi
# --- END ADDING REBUILD INDEX --- #

# Step 4: Extract the slugs of newly generated blogs
# We'll use the lastUpdated timestamp in index.json to identify recent blogs
echo "🔍 Step 4: Identifying newly generated blogs..."

# Read the index.json file
INDEX_FILE="$BLOG_DATA_DIR/index.json"

# Extract last updated timestamp using jq
LAST_UPDATED=$(jq -r '.lastUpdated' "$INDEX_FILE")

# Check if jq command failed or LAST_UPDATED is empty
if [ $? -ne 0 ] || [ -z "$LAST_UPDATED" ]; then
  echo "❌ Failed to extract lastUpdated timestamp using jq from $INDEX_FILE. Check file and jq installation. Exiting."
  exit 1
fi
echo "Last updated: $LAST_UPDATED"

# Extract slugs using jq (more robust JSON parsing)
# Assumes jq is installed. Extracts the slug field from the first 3 objects in the posts array.
RECENT_SLUGS=$(jq -r '.posts[0:3][] | .slug' "$INDEX_FILE")

# Check if jq command failed or returned empty
if [ $? -ne 0 ] || [ -z "$RECENT_SLUGS" ]; then
  echo "❌ Failed to extract recent slugs using jq or no slugs found. Check $INDEX_FILE and jq installation. Exiting."
  exit 1
fi

# Step 5: Generate inline images for each recent blog
echo "🖼️ Step 5: Generating inline images for recent blogs..."

for SLUG in $RECENT_SLUGS; do
  echo "Processing inline images for: $SLUG"
  npm run generate:inline-images -- $SLUG
  
  # Add a small delay between processing to avoid API rate limits
  sleep 2
done

# Step 5.25: Optimize images specifically for newly generated blogs
echo "🖼️ Step 5.25: Optimizing images for newly generated blogs..."
for SLUG in $RECENT_SLUGS; do
  echo "Optimizing images for: $SLUG"
  
  # Extract the date folder from the slug if applicable
  # This assumes slug patterns like "ditch-sugar-boost-metabolism-energy" without date,
  # and we need to find the actual image directory
  
  # Find the image paths for this blog by checking the blog post JSON
  BLOG_JSON=$(find "$BLOG_DATA_DIR" -name "$SLUG.json" -o -path "*/$SLUG.json")
  
  if [ -n "$BLOG_JSON" ]; then
    echo "Found blog JSON: $BLOG_JSON"
    
    # Extract featuredImage path using grep and basic text processing
    FEATURED_IMAGE=$(grep -o '"featuredImage":[^,]*' "$BLOG_JSON" | cut -d'"' -f4)
    
    if [ -n "$FEATURED_IMAGE" ]; then
      echo "Found featured image: $FEATURED_IMAGE"
      
      # Convert to absolute path
      IMAGE_PATH="$ROOT_DIR/public$FEATURED_IMAGE"
      
      # Only process if the image exists and isn't already in an optimized folder
      if [[ -f "$IMAGE_PATH" && ! "$FEATURED_IMAGE" =~ "/optimized/" ]]; then
        echo "Optimizing featured image: $IMAGE_PATH"
        node scripts/optimize-images.js "$IMAGE_PATH"
      fi
      
      # Also check for inline images in the blog content
      # Find the directory containing the inline images based on the featuredImage path
      if [[ "$FEATURED_IMAGE" =~ "/images/blog/"([^/]+) ]]; then
        DATE_FOLDER="${BASH_REMATCH[1]}"
        INLINE_IMAGES_DIR="$ROOT_DIR/public/images/blog/inline/$DATE_FOLDER/$SLUG"
        
        if [ -d "$INLINE_IMAGES_DIR" ]; then
          echo "Found inline images directory: $INLINE_IMAGES_DIR"
          # Find all image files in this directory
          INLINE_IMAGES=$(find "$INLINE_IMAGES_DIR" -type f \( -name "*.jpg" -o -name "*.jpeg" -o -name "*.png" \) | grep -v "/optimized/")
          
          # Optimize each inline image
          for IMG in $INLINE_IMAGES; do
            echo "Optimizing inline image: $IMG"
            node scripts/optimize-images.js "$IMG"
          done
        fi
      fi
    fi
  fi
done

# Step 5.5: Optimize all existing blog images to improve LCP
echo "🖼️ Step 5.5: Optimizing existing blog images for LCP..."
node scripts/optimize-existing-blog-images.js

# Check if optimization script was successful (node script exits with 0 on success)
if [ $? -ne 0 ]; then
  echo "❌ Image optimization (Step 5.5) failed. Exiting script."
  exit 1
fi

echo "✅ Full blog generation process completed successfully!"
echo "🌟 Generated blogs with inline images:"
for SLUG in $RECENT_SLUGS; do
  echo "- $SLUG"
done

# Step 6: Build the project
echo "🏗️ Step 6: Building the project..."
npm run build

# Check if the build was successful
if [ $? -ne 0 ]; then
  echo "❌ Project build (Step 6) failed. Exiting script."
  exit 1
fi

echo "🎉 Full blog generation and build process completed successfully!" 