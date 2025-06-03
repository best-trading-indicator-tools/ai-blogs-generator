/**
 * Blog Topic Generator
 * Provides a list of new blog topics based on sugar-related keywords
 */

import fs from 'fs';
import path from 'path';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// API keys from environment variables
const ANTHROPIC_API_KEY = process.env.VITE_ANTHROPIC_API_KEY;
const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';

const KEYWORDS_DIR = path.join(process.cwd(), 'public', 'keywords');
const NOSUGAR_KEYWORDS_PATH = path.join(KEYWORDS_DIR, 'nosugar_keywords.json');
const LOOKSMAXXING_KEYWORDS_PATH = path.join(KEYWORDS_DIR, 'looksmaxxing_keywords.json');

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

// Dynamically loaded keyword lists
const baseKeywords = loadJsonKeywords(NOSUGAR_KEYWORDS_PATH);
const looksmaxxingKeywords = loadJsonKeywords(LOOKSMAXXING_KEYWORDS_PATH);

if (baseKeywords.length === 0 && looksmaxxingKeywords.length === 0) {
  console.error('No keywords loaded from JSON files. Exiting.');
  process.exit(1);
}

// Update combined list
const allKeywords = [...baseKeywords, ...looksmaxxingKeywords];

// --- NEW: Define BlogTopic Interface ---
interface BlogTopic {
  title: string;
  slug: string;
  category: string;
  metaDescription: string;
  tags: string[];
}
// --- END NEW ---

// Title templates for different content formats
const nonLooksmaxxingTitleTemplates = [
  // Shorter, concise templates (under 10 words)
  'How [keyword] Affects Your [bodyPart]',
  'The Ultimate Guide to [action] [keyword]',
  '[number] [adjective] [keyword] Hacks',
  'Why Your [bodyPart] Needs [keyword] Reset',
  '[keyword] vs [alternateKeyword]: Best Choice',
  'Breaking Free from [keyword]',
  'How to [action] [keyword] Naturally',
  '[number] Signs of Excess [keyword]',
  '[keyword] Myths Debunked'
];

// --- NEW: Separate Looksmaxxing Templates ---
const looksmaxxingTitleTemplates = [
  'Does [Looksmaxxing Technique] Actually Work?',
  'Beginner\'s Guide to [Looksmaxxing Aspect]',
  '[number] [adjective] Looksmaxxing Tips',
  'Real Risks of [Looksmaxxing Trend]',
  'Looksmaxxing: Beyond [Social Media Platform] Hype',
  'Ultimate Guide to Looksmaxxing: [Looksmaxxing Aspect]',
  'How [Looksmaxxing Concept] Can Boost Your Confidence',
  'Level Up Your Look: Exploring [Looksmaxxing Technique]',
  '[number] Essential [Looksmaxxing Aspect] Tips for Men', // Example of more specific template
  'The Science Behind [Looksmaxxing Technique]'
];
// --- END NEW ---

// Fill-in options for templates
const fillInOptions = {
  action: ['reduce', 'eliminate', 'manage', 'overcome', 'control', 'balance', 'fight', 'understand', 'optimize', 'improve', 'enhance'],
  bodyPart: ['brain', 'heart', 'liver', 'gut', 'skin', 'immune system', 'hormones', 'metabolism', 'energy levels', 'appearance', 'confidence', 'jawline'],
  timeframe: ['30 days', '2 weeks', 'one month', 'just days', 'your daily routine'],
  number: ['3', '5', '7', '8', '10', '12'],
  adjective: ['powerful', 'effective', 'surprising', 'science-backed', 'doctor-approved', 'natural', 'simple', 'actionable', 'controversial', 'essential', 'underrated', 'overhyped'],
  alternateKeyword: ['artificial sweeteners', 'natural sugars', 'honey', 'fructose', 'carbs', 'fat', 'quick fixes', 'surgery', 'placebo', 'genetics'],
  healthAspect: ['weight loss', 'energy', 'mental clarity', 'sleep', 'digestion', 'aging', 'immune function', 'self-esteem', 'attractiveness', 'social perception', 'first impressions'],
  negativeOutcome: ['cravings', 'withdrawal symptoms', 'feeling deprived', 'hunger', 'energy crashes', 'unrealistic expectations', 'body dysmorphia', 'wasting money', 'dangerous side effects', 'social isolation'],
  // Looksmaxxing specific fill-ins
  'Looksmaxxing Technique': ['mewing', 'cold showers', 'oil pulling', 'specific grooming routines', 'posture correction', 'skincare layering', 'derma rolling', 'facial massage', 'tongue posture'],
  'Looksmaxxing Aspect': ['skincare', 'haircare', 'fitness', 'style', 'mindset', 'looksmaxxing', 'facial structure', 'grooming habits', 'personal hygiene', 'body composition'],
  'Looksmaxxing Trend': ['jawline exercises', 'bone smashing', 'heightmaxxing', 'looksmaxxing itself', 'looksmaxxing challenges', 'celebrity looksmaxxing'],
  'Social Media Platform': ['TikTok', 'Instagram', 'YouTube', 'Reddit', 'looksmaxxing forums'],
  // --- NEW: Added Looksmaxxing Concept ---
  'Looksmaxxing Concept': ['Looksmaxxing', 'Glow Up', 'Self-Improvement', 'Aesthetic Enhancement', 'Personal Optimization']
  // --- END NEW ---
};

// Category options for blog posts
const nonLooksmaxxingCategories = [
  'Nutrition Science',
  'Health Education',
  'Diet Tips',
  'Sugar Reduction',
  'Wellness',
  'Health Research',
  'Lifestyle' // Can overlap, but primarily non-looksmaxxing context here
];

// --- NEW: Separate Looksmaxxing Categories ---
const looksmaxxingCategories = [
  'Self-Improvement',
  "Men's Health", // Fixed quotes for apostrophe
  'Personal Development',
  'Looksmaxxing',
  'Glow Up',
  'Glow Up Tips',
  'Glow Up Advice',
  'Glow Up Routine',
  'Glow Up Guide',
  'Debloat',
  'Debloating',
  'Looksmaxxing Tips',
  'Looksmaxxing Advice',
  'Looksmaxxing Routine',
  'Looksmaxxing Guide',
  'Aesthetics',
  'Style & Fashion'
];
// --- END NEW ---

// Generate a slug from a title
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
    
    // Clean up the slug - remove any quotes or explanation text
    slug = slug.replace(/^["'`]|["'`]$/g, '');
    
    // Validate the generated slug
    if (!slug || slug.length < 3 || !slug.includes('-')) {
      console.warn(`AI generated invalid slug: "${slug}" for title "${title}". Using fallback.`);
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

// Random selection from an array
function getRandomItem<T>(array: T[]): T {
  return array[Math.floor(Math.random() * array.length)];
}

// Fill in a template with random options
function fillTemplate(template: string, availableKeywords: string[]): string {
  let filledTemplate = template;
  
  // Replace [keyword] with a random keyword from the provided list
  while (filledTemplate.includes('[keyword]')) {
    filledTemplate = filledTemplate.replace('[keyword]', getRandomItem(availableKeywords));
  }
  
  // Replace all other template variables
  for (const [key, options] of Object.entries(fillInOptions)) {
    const placeholder = `[${key}]`;
    while (filledTemplate.includes(placeholder)) {
      filledTemplate = filledTemplate.replace(placeholder, getRandomItem(options));
    }
  }
  
  return filledTemplate;
}

// Generate a complete blog topic object
async function generateBlogTopic(): Promise<BlogTopic> {
  let title: string;
  let category: string;
  let selectedKeywords: string[];
  let selectedTags: string[];

  // --- NEW: 70% Chance for Looksmaxxing Topic ---
  const isLooksmaxxingTopic = Math.random() < 0.7;

  if (isLooksmaxxingTopic) {
    console.log("Generating Looksmaxxing topic...");
    title = fillTemplate(getRandomItem(looksmaxxingTitleTemplates), looksmaxxingKeywords); // Use looksmaxxing templates & keywords
    category = getRandomItem(looksmaxxingCategories);
    selectedKeywords = looksmaxxingKeywords; // Use looksmaxxing keywords for tag generation
    selectedTags = ['looksmaxxing', 'self-improvement']; // Start with core tags
  } else {
    console.log("Generating Non-Looksmaxxing topic...");
    title = fillTemplate(getRandomItem(nonLooksmaxxingTitleTemplates), baseKeywords); // Use non-looksmaxxing templates & keywords
    category = getRandomItem(nonLooksmaxxingCategories);
    selectedKeywords = baseKeywords; // Use base keywords for tag generation
    selectedTags = []; // Start with empty tags
  }

  // Generate slug using AI
  const slug = await generateAISlug(title);

  // Generate relevant tags based on the title and selected keyword set
  const tags: string[] = [...selectedTags]; // Use the starting tags based on type
  const words = title.toLowerCase().split(' ');

  // Extract potential tags from the title using the appropriate keyword list
  for (const keyword of selectedKeywords) {
    // Check if any part of the keyword exists in the title words
    // Handles multi-word keywords like 'gut health' or 'style advice'
    if (words.some(word => keyword.toLowerCase().includes(word)) || title.toLowerCase().includes(keyword.toLowerCase())) {
       if (!tags.includes(keyword)) { // Avoid duplicate tags
         tags.push(keyword);
       }
    }
    if (tags.length >= 3) break; // Aim for around 3 tags initially from keywords
  }

  // Ensure we have exactly 3 tags (can adjust this number if needed)
  while (tags.length < 3) {
    const newTag = getRandomItem(selectedKeywords); // Draw from appropriate keyword list
    if (!tags.includes(newTag)) {
      tags.push(newTag);
    }
  }
   // If we have more than 3, slice to 3
   if (tags.length > 3) {
    tags.splice(3);
  }

  // Generate a meta description
  // --- NEW: Tailor meta description slightly based on topic type ---
  let metaDescription: string;
  if (isLooksmaxxingTopic) {
    metaDescription = `Explore ${title.toLowerCase()}. Get insights, tips, and analysis on looksmaxxing, self-improvement, and aesthetics.`;
  } else {
    metaDescription = `Discover everything about ${title.toLowerCase()}. Learn science-backed strategies, expert tips, and practical advice for your health journey.`;
  }
  // --- END NEW ---

  return {
    title,
    slug,
    category,
    metaDescription,
    tags
  };
}

// Generate multiple unique topics
async function generateUniqueTopics(count: number): Promise<BlogTopic[]> {
  const topics: BlogTopic[] = [];
  const existingSlugs = new Set<string>();
  
  while (topics.length < count) {
    const topic = await generateBlogTopic();
    
    // Ensure the slug is unique
    if (!existingSlugs.has(topic.slug)) {
      existingSlugs.add(topic.slug);
      topics.push(topic);
    }
  }
  
  return topics;
}

// Output topics to a file or console
async function main() {
  const topicCount = process.argv[2] ? parseInt(process.argv[2]) : 2;
  const topics = await generateUniqueTopics(topicCount);
  
  console.log(JSON.stringify(topics, null, 2));
  
  // Optionally save to a file
  if (process.argv.includes('--save')) {
    const outputDir = path.resolve(process.cwd(), 'scripts/generated');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    
    const outputFile = path.join(outputDir, `topics-${new Date().toISOString().split('T')[0]}.json`);
    fs.writeFileSync(outputFile, JSON.stringify(topics, null, 2));
    console.log(`Saved topics to ${outputFile}`);
  }
}

// Run the script
main(); 