/**
 * Keyword Trend Discovery
 * 
 * This script uses Google Trends API to discover trending keywords related to 
 * sugar reduction, health, and nutrition. It saves the results to a JSON file
 * that can be used by the topic generator.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { generateKeywordSuggestions } from '../src/utils/aiTextGenerator';

// Load environment variables
dotenv.config();

// Calculate __dirname equivalent for ES modules
// const __filename = fileURLToPath(import.meta.url);
// const __dirname = path.dirname(__filename);

// Constants
const OUTPUT_DIR = path.resolve(process.cwd(), 'scripts/generated');
const OUTPUT_FILE = path.join(OUTPUT_DIR, `trending-keywords-${new Date().toISOString().split('T')[0]}.json`);
const KEYWORDS_DIR = path.join(process.cwd(), 'public', 'keywords');
const NOSUGAR_KEYWORDS_PATH = path.join(KEYWORDS_DIR, 'nosugar_keywords.json');
const LOOKSMAXXING_KEYWORDS_PATH = path.join(KEYWORDS_DIR, 'looksmaxxing_keywords.json');

// Ensure output directory exists
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

/**
 * Load keywords from JSON file
 */
function loadJsonKeywords(filePath: string): string[] {
  try {
    if (fs.existsSync(filePath)) {
      const raw = fs.readFileSync(filePath, 'utf8');
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed as string[];
      console.error(`Keyword JSON at ${filePath} is not an array.`);
    } else {
      console.error(`Keyword JSON file not found at ${filePath}`);
    }
  } catch (err) {
    console.error(`Keyword JSON load failed for ${filePath}.`, err);
  }
  return [];
}

// Load both keyword files and combine for seed keywords
const nosugarKeywords = loadJsonKeywords(NOSUGAR_KEYWORDS_PATH);
const looksmaxxingKeywords = loadJsonKeywords(LOOKSMAXXING_KEYWORDS_PATH);

const SEED_KEYWORDS = [...new Set([...nosugarKeywords, ...looksmaxxingKeywords])];

if (SEED_KEYWORDS.length === 0) {
  console.error('No seed keywords loaded from JSON files. Exiting.');
  process.exit(1);
}

console.log(`Loaded ${SEED_KEYWORDS.length} seed keywords for trend discovery (${nosugarKeywords.length} from nosugar, ${looksmaxxingKeywords.length} from looksmaxxing)`);

/**
 * Create keyword data from seed keywords and AI suggestions.
 * This is now the primary data generation function.
 */
async function createKeywordData(): Promise<any> {
  console.log('Creating keyword data from seed keywords and AI...');
  
  const trendingKeywords = SEED_KEYWORDS.slice(0, 20);
  
  let baseKeywordIdeas = SEED_KEYWORDS.flatMap(keyword => 
    ['how to', 'best', 'does', 'can', 'why', 'benefits of', 'vs', 'alternatives', 'reviews'].map(prefix => `${prefix} ${keyword}`)
  ).slice(0, 100);
  
  const risingQueries = SEED_KEYWORDS.filter(k => k.includes('challenge') || k.includes('before and after') || k.includes('tiktok') || k.includes('glow up')).slice(0, 30);

  // AI-powered keyword suggestions
  const aiLongTailSuggestions: string[] = [];
  const aiSemanticSuggestions: string[] = [];
  const keywordsForAISuggestions = SEED_KEYWORDS.slice(0, 5); // Process first 5 seed keywords for AI suggestions (to manage API calls)
  const categoriesForAI = ['Health', 'Nutrition', 'Sugar Reduction', 'Beauty']; // Example categories

  console.log(`Fetching AI keyword suggestions for ${keywordsForAISuggestions.length} keywords...`);
  for (const keyword of keywordsForAISuggestions) {
    for (const category of categoriesForAI) { // Using a few categories for broader suggestions
      try {
        console.log(`Fetching long-tail for: ${keyword}, category: ${category}`);
        const longTail = await generateKeywordSuggestions(keyword, category, 'long-tail', 3);
        aiLongTailSuggestions.push(...longTail);
        console.log(`Fetching semantic for: ${keyword}, category: ${category}`);
        const semantic = await generateKeywordSuggestions(keyword, category, 'semantic', 3);
        aiSemanticSuggestions.push(...semantic);
      } catch (error) {
        console.error(`Failed to get AI suggestions for keyword: ${keyword} in category ${category}`, error);
        // Continue without AI suggestions for this keyword/category if an error occurs
      }
    }
  }
  console.log('Finished fetching AI keyword suggestions.');

  const allKeywordIdeas = [...new Set([...baseKeywordIdeas, ...aiLongTailSuggestions])];

  return {
    timestamp: new Date().toISOString(),
    trendingKeywords,
    risingQueries: [...new Set([...risingQueries, ...SEED_KEYWORDS.slice(20, 50)])].slice(0, 50),
    keywordIdeas: allKeywordIdeas,
    aiSemanticSuggestions: [...new Set(aiSemanticSuggestions)], // Add AI semantic suggestions
    detailedResults: trendingKeywords.map(keyword => ({
      keyword,
      relatedQueries: SEED_KEYWORDS.filter(k => k !== keyword && Math.random() > 0.8).slice(0,5), // Simulate some related
      risingQueries: risingQueries.filter(k => k !== keyword && Math.random() > 0.9).slice(0,3), // Simulate some rising
      interestOverTime: 50 + Math.floor(Math.random() * 20 - 10), // Simulate interest
      trendDirection: 'stable', // Default to stable
      score: 50 + Math.floor(Math.random() * 20 - 10) // Simulate score
    }))
  };
}

/**
 * Generates keyword data directly from seed keywords and AI.
 */
async function generateKeywordData(): Promise<any> {
  console.log('Generating new keyword data from SEED_KEYWORDS and AI...');
  const newData = await createKeywordData();
  // We don't save to a separate fallback file anymore
  return newData;
}

/**
 * Main function to run the keyword discovery process (using seed keywords and AI)
 */
async function main() {
  try {
    console.log('Starting keyword data generation (using SEED_KEYWORDS and AI)...');
    
    // Directly generate the keyword data
    const output = await generateKeywordData();
    
    // Only write to the latest file
    const latestFile = path.join(OUTPUT_DIR, 'latest-trending-keywords.json');
    fs.writeFileSync(latestFile, JSON.stringify(output, null, 2));
    console.log(`Keyword data saved to ${latestFile}`);
    
    // Final summary
    console.log('Keyword data generation completed successfully using SEED_KEYWORDS and AI!');
    console.log(`Generated ${output.trendingKeywords.length} base keywords, ${output.risingQueries.length} rising/related queries, ${output.keywordIdeas.length} keyword ideas, and ${output.aiSemanticSuggestions.length} AI semantic suggestions`);
    
  } catch (error) {
    console.error('Error in keyword data generation:', error);
    process.exit(1); // Exit if the process fails
  }
}

// Run the script
main(); 