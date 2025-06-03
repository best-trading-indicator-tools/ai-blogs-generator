/**
 * Enhanced Topic Generator
 * 
 * This script enhances the existing topic generator by incorporating
 * trending keyword data to create SEO-optimized blog topics
 */

import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { generateAITitle } from '../src/utils/aiTextGenerator'; // Import the new function
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// API keys from environment variables
const ANTHROPIC_API_KEY = process.env.VITE_ANTHROPIC_API_KEY;
const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';

// Constants
const GENERATED_DIR = path.resolve(process.cwd(), 'scripts/generated');
const TRENDING_KEYWORDS_FILE = path.join(GENERATED_DIR, 'latest-trending-keywords.json');
const DEFAULT_TOPIC_COUNT = 2;

const KEYWORDS_DIR = path.join(process.cwd(), 'public', 'keywords');
const NOSUGAR_KEYWORDS_PATH = path.join(KEYWORDS_DIR, 'nosugar_keywords.json');
const LOOKSMAXXING_KEYWORDS_PATH = path.join(KEYWORDS_DIR, 'looksmaxxing_keywords.json');

function loadJsonKeywords(filePath: string): string[] {
  try {
    if (fs.existsSync(filePath)) {
      const data = fs.readFileSync(filePath, 'utf8');
      const parsed = JSON.parse(data);
      if (Array.isArray(parsed)) return parsed as string[];
      console.error(`Keyword JSON at ${filePath} is not an array.`);
    } else {
      console.error(`Keyword JSON file not found at ${filePath}`);
    }
  } catch (err) {
    console.error(`Failed to load keywords from ${filePath}.`, err);
  }
  return [];
}

// Load keyword lists (no fallback)
const nosugarKeywords = loadJsonKeywords(NOSUGAR_KEYWORDS_PATH);
const looksmaxxingKeywordsFile = loadJsonKeywords(LOOKSMAXXING_KEYWORDS_PATH);

if (nosugarKeywords.length === 0 && looksmaxxingKeywordsFile.length === 0) {
  console.error('No keywords loaded from JSON files. Exiting.');
  process.exit(1);
}

// Combine both lists, ensuring uniqueness
const baseKeywords = Array.from(new Set([...nosugarKeywords, ...looksmaxxingKeywordsFile]));

// Category options for blog posts
const categories = [
  'Nutrition Science',
  'Health Education',
  'Diet Tips',
  'Sugar Reduction',
  'Wellness',
  'Health Research',
  'Lifestyle',
  'Looksmaxxing'
];

// Interface for trending keyword data
interface TrendingKeywordData {
  timestamp: string;
  trendingKeywords: string[];
  risingQueries: string[];
  keywordIdeas: string[];
  aiSemanticSuggestions?: string[];
  detailedResults: any[];
}

// Interface for blog topic
interface BlogTopic {
  title: string;
  slug: string;
  category: string;
  metaDescription: string;
  tags: string[];
  trendScore?: number;
}

// Interface adjustment for internal use
interface BlogTopicInternal extends BlogTopic {
    _primaryKeywords?: string[];
}

/**
 * Load trending keyword data from file
 * If the file doesn't exist, return null
 */
function loadTrendingKeywords(): TrendingKeywordData | null {
  try {
    if (fs.existsSync(TRENDING_KEYWORDS_FILE)) {
      const data = fs.readFileSync(TRENDING_KEYWORDS_FILE, 'utf8');
      return JSON.parse(data);
    }
    return null;
  } catch (error) {
    console.error('Error loading trending keywords:', error);
    return null;
  }
}

/**
 * Generate a slug from a title
 */
function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * Generate an optimized, meaningful slug using Claude AI
 * Falls back to basic generateSlug if API call fails
 */
async function generateAISlug(title: string): Promise<string> {
  try {
    // Default to basic slug generation if API key is not available
    if (!ANTHROPIC_API_KEY) {
      console.warn('Anthropic API key not found, using fallback slug generation');
      return generateSlug(title);
    }
    
    const prompt = `
      Create a SEO-friendly URL slug for the blog post title: "${title}"
      
      Requirements:
      - Maximum 7 words (absolutely critical)
      - All lowercase
      - Words separated by hyphens
      - Remove stop words (a, the, and, or, for, etc.) if helpful to keep under 7 words
      - No special characters or punctuation
      - Must maintain the key meaning of the title
      - Must form a complete, sensible phrase that reflects the post's content
      - NEVER end in mid-phrase, stop words, or prepositions
      
      Return ONLY the slug, nothing else. No explanations.
    `;
    
    const response = await fetch(ANTHROPIC_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-3-haiku-20240307', // Using a smaller, faster model for this simple task
        max_tokens: 30,
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.1 // Low temperature for more predictable results
      })
    });
    
    if (!response.ok) {
      console.error(`Anthropic API error: ${response.statusText}`);
      return generateSlug(title); // Fall back to basic slug generation
    }
    
    const data = await response.json();
    let slug = data.content[0].text.trim();
    
    // Clean up the slug - remove any quotes or explanation text, replace newlines
    slug = slug.replace(/^[\\"\\'`]|[\\"\\'`]$/g, '');
    slug = slug.replace(/\\n+/g, '-'); // Replace newlines with hyphens
    slug = slug.replace(/-+/g, '-'); // Collapse consecutive hyphens
    slug = slug.replace(/^-|-$/g, ''); // Remove leading/trailing hyphens

    // Validate the generated slug
    if (!slug || slug.length < 3 || !slug.includes('-')) {
      console.warn(`AI generated invalid slug: \\"${slug}\\" for title \\"${title}\\". Using fallback.`);
      return generateSlug(title); // Fall back to basic slug generation
    }
    
    console.log(`Generated AI slug: "${slug}" for title "${title}"`);
    return slug;
    
  } catch (error) {
    console.error('Failed to generate AI slug:', error);
    // Fall back to basic slug generation
    return generateSlug(title);
  }
}

/**
 * Random selection from an array, allowing for a specific item to be weighted.
 */
function getRandomItem<T>(
  array: T[], 
  weightedItem?: T, 
  weight?: number // Probability between 0 and 1 for the weighted item
): T {
  // Check if the weighted item exists and a valid weight is provided
  if (weightedItem && weight != null && weight > 0 && weight < 1 && array.includes(weightedItem)) {
    if (Math.random() < weight) { // Check against the specified weight
      return weightedItem;
    } else {
      // If not selected, pick randomly from the remaining items
      const remainingItems = array.filter(item => item !== weightedItem);
      if (remainingItems.length > 0) {
        return remainingItems[Math.floor(Math.random() * remainingItems.length)];
      }
      // Fallback if only the weighted item was in the array
      return weightedItem; 
    }
  }
  // Default random selection if no weighting is applied or possible
  return array[Math.floor(Math.random() * array.length)];
}

/**
 * Generate a complete blog topic object using AI for title
 * 
 * @param trendingData Trending keyword data or null
 * @param excludeKeywords Keywords used in previously generated topics in this batch to avoid repetition
 * @param lastCategory The category used for the previous topic in this batch
 * @param recentCategories Categories used in the last N topics (for diversity)
 * @returns A BlogTopic object
 */
async function generateBlogTopic(
  trendingData: TrendingKeywordData | null,
  excludeKeywords: string[] = [],
  recentCategories: string[] = []
): Promise<BlogTopicInternal> {
  let trendScore = 0;
  let selectedKeywords: string[] = [];
  let attempts = 0;
  const MAX_ATTEMPTS = 10; // Prevent infinite loops

  // --- Enhanced Keyword Selection with Intent Focus ---
  attempts = 0;
  while (selectedKeywords.length === 0 && attempts < MAX_ATTEMPTS) {
    attempts++;
    let potentialKeyword: string | undefined;
    let keywordSourceType: string = 'base'; // For logging/debugging

    const useLongTailChance = 0.4; // 40% chance to try a long-tail keyword first
    const useSemanticPairChance = 0.7; // If not long-tail, 70% chance to try semantic pairing

    if (trendingData && Math.random() < useLongTailChance && trendingData.keywordIdeas && trendingData.keywordIdeas.length > 0) {
      // Try to pick a long-tail keyword phrase
      const availableLongTail = trendingData.keywordIdeas.filter(kw => kw && kw.includes(' ') && !excludeKeywords.includes(kw)); // Prioritize phrases
      if (availableLongTail.length > 0) {
        potentialKeyword = getRandomItem(availableLongTail);
        if (potentialKeyword) {
          selectedKeywords.push(potentialKeyword);
          trendScore = 75; // Higher score for specific long-tail
          keywordSourceType = 'long-tail';
          // For long-tail, often one phrase is enough to guide the title AI
        }
      }
    }

    if (selectedKeywords.length === 0 && trendingData) {
      // If no long-tail was picked, or it wasn't available, try primary + semantic or other trending
      const allPrimaryTrending = [
        ...(trendingData.trendingKeywords || []),
        ...(trendingData.risingQueries || [])
      ].filter(kw => kw && !excludeKeywords.includes(kw));

      if (allPrimaryTrending.length > 0) {
        potentialKeyword = getRandomItem(allPrimaryTrending);
        if (potentialKeyword && !selectedKeywords.includes(potentialKeyword)) {
          selectedKeywords.push(potentialKeyword);
          trendScore = 70;
          keywordSourceType = 'trending-primary';

          // Try to pair with a semantic keyword
          if (Math.random() < useSemanticPairChance && trendingData.aiSemanticSuggestions && trendingData.aiSemanticSuggestions.length > 0) {
            const availableSemantic = trendingData.aiSemanticSuggestions.filter(
              skw => skw && !excludeKeywords.includes(skw) && !selectedKeywords.includes(skw) && skw !== potentialKeyword
            );
            if (availableSemantic.length > 0) {
              const semanticKeyword = getRandomItem(availableSemantic);
              if (semanticKeyword) {
                selectedKeywords.push(semanticKeyword);
                keywordSourceType = 'trending-primary+semantic';
              }
            }
          }
        }
      }
    }
    
    // Fallback to base keywords if nothing suitable from trending data or if trendingData is null
    if (selectedKeywords.length === 0) {
      keywordSourceType = 'base-fallback';
      const availableBase = baseKeywords.filter(kw => !excludeKeywords.includes(kw) && !selectedKeywords.includes(kw));
      potentialKeyword = getRandomItem(availableBase.length > 0 ? availableBase : baseKeywords, 'looksmaxxing', 0.1);
      if (potentialKeyword && !selectedKeywords.includes(potentialKeyword)) {
        selectedKeywords.push(potentialKeyword);
        // Optionally, try to add a second base keyword if only one was selected (similar to old logic)
        const currentLength = selectedKeywords.length; // Store length after push
        if (+currentLength === 1 && Math.random() > 0.5) { // Coerce currentLength to number for comparison
            const availableBaseForSecond = baseKeywords.filter(kw => !excludeKeywords.includes(kw) && !selectedKeywords.includes(kw));
            if (availableBaseForSecond.length > 0) {
                const secondBase = getRandomItem(availableBaseForSecond);
                if (secondBase) selectedKeywords.push(secondBase);
            }
        }
      }
    }
    // Ensure at least one keyword if all else failed (should be rare)
     if (selectedKeywords.length === 0) {
        selectedKeywords.push(getRandomItem(baseKeywords));
        keywordSourceType = 'base-absolute-fallback';
     }
    console.log(`Selected keywords via [${keywordSourceType}]: ${selectedKeywords.join(', ')}`);
  }

  if (selectedKeywords.length === 0) {
    // This case should be extremely rare with the fallbacks.
    console.warn("CRITICAL: Could not select any keyword after all attempts. Using a default.");
    selectedKeywords.push('sugar reduction'); // Default emergency keyword
  }
  // --- End Enhanced Keyword Selection ---

  // --- Category Selection with Enhanced Diversity Check ---
  let category: string;
  const categoryWeight = 0.4; // Weight for Looksmaxxing
  const RECENT_CATEGORY_COUNT = 2; // How many recent categories to avoid

  // Filter out categories used recently
  const availableCategories = categories.filter(cat => !recentCategories.includes(cat));

  if (availableCategories.length === 0) {
    // Fallback if all categories were somehow used recently (unlikely with RECENT_CATEGORY_COUNT=2)
    console.warn("All categories used recently. Picking a random one.");
    category = getRandomItem(categories, 'Looksmaxxing', categoryWeight);
  } else {
    // Select from available categories, still applying weight if 'Looksmaxxing' is available
    const looksmaxxingAvailable = availableCategories.includes('Looksmaxxing');
    category = getRandomItem(
        availableCategories, 
        looksmaxxingAvailable ? 'Looksmaxxing' : undefined, // Only weight if available
        looksmaxxingAvailable ? categoryWeight : undefined
    );
  }
  // --- End Category Selection ---

  // Generate title using AI
  console.log(`Generating AI title for keywords: [${selectedKeywords.join(', ')}], category: ${category}`);
  const title = await generateAITitle(selectedKeywords, category);

  // Additional safety: Remove any bullet points or numbered list formatting that might remain
  const cleanedTitle = title.replace(/^\s*\d+[\.\:\)]\s*/g, '')  // Remove starting numbers like "1. "
                            .replace(/\s+\d+[\.\:\)]\s+/g, ' - '); // Replace middle numbers like " 2. " with " - "

  // Generate slug using AI
  const slug = await generateAISlug(cleanedTitle);

  // --- Tag Generation (Simplified) ---
  // Start with the core keywords used for generation
  let tags: string[] = [...selectedKeywords];
  // Add category if it's not already a tag
  if (!tags.includes(category.toLowerCase())) {
      tags.push(category.toLowerCase());
  }
  // Add 1-2 more relevant tags from baseKeywords based on title
  const titleWords = cleanedTitle.toLowerCase().split(/\s+/);
  let addedTags = 0;
  for (const baseKw of baseKeywords) {
      if (tags.length >= 4) break;
      if (!tags.includes(baseKw) && titleWords.some(word => word.includes(baseKw))) {
          tags.push(baseKw);
          addedTags++;
      }
  }
  // Ensure minimum 3 tags if needed
  while (tags.length < 3 && tags.length < baseKeywords.length) {
      const randomTag = getRandomItem(baseKeywords);
      if (!tags.includes(randomTag)) {
          tags.push(randomTag);
      }
  }
  // --- End Tag Generation ---

  // Generate a meta description using the AI title
  const metaDescription = `Discover everything about ${cleanedTitle.toLowerCase()}. Learn science-backed strategies, expert tips, and practical advice for your health journey.`;

  return {
    title: cleanedTitle,
    slug,
    category,
    metaDescription,
    tags: tags.slice(0, 4), // Ensure max 4 tags
    trendScore,
    // Store primary keywords used for diversity check in the next iteration
    _primaryKeywords: selectedKeywords 
  };
}

/**
 * Generate multiple unique topics
 */
async function generateUniqueTopics(count: number, trendingData: TrendingKeywordData | null): Promise<BlogTopic[]> {
  const topics: BlogTopicInternal[] = [];
  const existingSlugsInternal = new Set<string>(); // For current batch internal check
  const usedKeywords = new Set<string>();
  const recentCategories: string[] = [];
  const recentKeywordPairs = new Set<string>();
  const RECENT_HISTORY_COUNT = 3;

  // ---- ADDED: Load existing posts from index.json ----
  const allPublishedSlugs = new Set<string>();
  const allPublishedTitles = new Set<string>();
  const indexFilePath = path.resolve(process.cwd(), 'public/blog-data/index.json');

  try {
    if (fs.existsSync(indexFilePath)) {
      const indexFileContent = fs.readFileSync(indexFilePath, 'utf8');
      const indexData = JSON.parse(indexFileContent);
      if (indexData && Array.isArray(indexData.posts)) {
        for (const post of indexData.posts) {
          if (post.slug) {
            allPublishedSlugs.add(post.slug);
          }
          if (post.title) {
            allPublishedTitles.add(post.title.toLowerCase().trim());
          }
        }
        console.log(`Loaded ${allPublishedSlugs.size} slugs and ${allPublishedTitles.size} titles from existing index.json`);
      }
    }
  } catch (err) {
    console.warn('Warning: Could not load or parse existing blog index.json. Proceeding without historical duplicate check.', err);
  }
  // ---- END ADDED ----

  while (topics.length < count) {
    let attempts = 0;
    const MAX_GENERATION_ATTEMPTS = 5; // Prevent infinite loops if diversity is hard
    let topicGenerated = false;

    while (attempts < MAX_GENERATION_ATTEMPTS && !topicGenerated) {
        attempts++;
        // Pass keywords used in previous topics of this batch and recent categories
        const topic = await generateBlogTopic(
            trendingData,
            Array.from(usedKeywords),
            recentCategories
        );
        
        // Check 1: Ensure the slug is unique (within this batch and against published)
        if (!topic.slug || existingSlugsInternal.has(topic.slug)) {
            console.warn(`Generated duplicate or empty slug (internal batch) for title \\"${topic.title}\\". Retrying attempt ${attempts}...`);
            continue; // Try generating a different topic
        }

        // ---- ADDED: Check against all published slugs and titles ----
        if (allPublishedSlugs.has(topic.slug)) {
          console.warn(`Generated slug \\"${topic.slug}\\" that already exists in published posts. Retrying attempt ${attempts}...`);
          continue;
        }

        const normalizedNewTitle = topic.title.toLowerCase().trim();
        if (allPublishedTitles.has(normalizedNewTitle)) {
          console.warn(`Generated title \\"${topic.title}\\" that already exists (or is very similar) to a published post. Retrying attempt ${attempts}...`);
          continue;
        }
        // ---- END ADDED ----

        // Check 2: Basic diversity check for keyword pairs
        const keywordPairString = topic._primaryKeywords?.sort().join('|') || 'unknown';
        if (recentKeywordPairs.has(keywordPairString)) {
             console.warn(`Generated topic with recently used keyword pair (${keywordPairString}). Retrying attempt ${attempts}...`);
             continue; // Try generating a different topic
        }

        // If checks pass, add the topic
        existingSlugsInternal.add(topic.slug);
        topic._primaryKeywords?.forEach(kw => usedKeywords.add(kw)); // Add specific keywords
        recentKeywordPairs.add(keywordPairString); // Add keyword pair
        
        // Update recent categories
        recentCategories.push(topic.category);
        if (recentCategories.length > RECENT_HISTORY_COUNT) {
            recentCategories.shift(); // Keep only the last N categories
        }
        // Keep recent keyword pair history limited
        if (recentKeywordPairs.size > RECENT_HISTORY_COUNT * 2) { // Keep a slightly larger history for pairs
            const oldestPair = recentKeywordPairs.values().next().value;
            recentKeywordPairs.delete(oldestPair);
        }

        // Remove internal tracking property before storing
        delete topic._primaryKeywords;
        topics.push(topic);
        topicGenerated = true; // Mark as successfully generated
    }

    if (!topicGenerated) {
        console.error(`Failed to generate a unique and diverse topic after ${MAX_GENERATION_ATTEMPTS} attempts. Stopping generation for this round.`);
        break; // Exit the outer loop if we can't generate a diverse topic
    }
  }
  
  return topics;
}

/**
 * Main function
 */
async function main() { // Make main async
  try {
    // Load trending keyword data
    const trendingData = loadTrendingKeywords();
    
    if (trendingData) {
      console.log(`Loaded trending keywords data from ${new Date(trendingData.timestamp).toLocaleString()}`);
      console.log(`Found ${trendingData.trendingKeywords.length} trending keywords, ${trendingData.risingQueries.length} rising queries, and ${trendingData.keywordIdeas.length} keyword ideas`);
    } else {
      console.log('No trending keyword data found. Using base keywords only.');
    }
    
    // Get topic count from command line args or use default
    const topicCount = process.argv[2] ? parseInt(process.argv[2]) : DEFAULT_TOPIC_COUNT;
    
    // Generate topics (now async)
    console.log(`Generating ${topicCount} topics using AI...`);
    const topics = await generateUniqueTopics(topicCount, trendingData);
    
    console.log(`Generated ${topics.length} unique topics:`);
    topics.forEach((topic, index) => {
      console.log(`${index + 1}. ${topic.title}${topic.trendScore ? ` (Trend score: ${topic.trendScore})` : ''}`);
    });
    
    // Only save to the latest file
    const latestFile = path.join(GENERATED_DIR, 'latest-topics.json');
    fs.writeFileSync(latestFile, JSON.stringify(topics, null, 2));
    console.log(`Saved topics to ${latestFile}`);
    
    console.log('Enhanced topic generation completed successfully!');
  } catch (error) {
    console.error('Error in enhanced topic generation:', error);
    process.exit(1);
  }
}

// Run the script
main(); 