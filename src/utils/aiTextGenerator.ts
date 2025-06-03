/**
 * AI Text Generator for blog image overlays
 * Uses Anthropic Claude API to generate catchy text overlays for blog images
 */

import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// API Keys from environment variables
const ANTHROPIC_API_KEY = process.env.VITE_ANTHROPIC_API_KEY;
const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';

/**
 * Generate a catchy text overlay for a blog image using Anthropic Claude
 * @param blogTitle - The title of the blog post
 * @param blogCategory - The category of the blog
 * @param additionalContext - Additional context to help generate relevant text
 * @returns Promise with the generated text overlay
 */
export async function generateTextOverlay(
  blogTitle: string,
  blogCategory: string,
  additionalContext?: string
): Promise<string> {
  try {
    // Default to hardcoded fallback if API key is not available
    if (!ANTHROPIC_API_KEY) {
      console.warn('Anthropic API key not found, using fallback text generation');
      return generateFallbackText(blogTitle, blogCategory);
    }

    const prompt = `
      Create a very short, catchy text overlay for a blog image about "${blogTitle}".
      The blog is in the ${blogCategory} category.
      ${additionalContext ? `Additional context: ${additionalContext}` : ''}
      
      Requirements:
      - Maximum 5 words
      - Bold, attention-grabbing phrase
      - Relevant to the topic but not duplicating the title
      - Should work well as white text on a black background
      - No hashtags or special characters
      
      Return ONLY the text overlay, nothing else.
    `;

    const response = await fetch(ANTHROPIC_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 50,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: `You are a specialist in creating short, impactful text for blog image overlays.

${prompt}`
              }
            ]
          }
        ],
        temperature: 0.7
      })
    });

    if (!response.ok) {
      throw new Error(`Anthropic API error: ${response.statusText}`);
    }

    const data = await response.json();
    const generatedText = data.content[0].text.trim();
    
    // Clean up any quotes or unnecessary characters
    return generatedText.replace(/^["']|["']$/g, '');
    
  } catch (error) {
    console.error('Failed to generate AI text overlay:', error);
    // Fallback to rule-based generation if API fails
    return generateFallbackText(blogTitle, blogCategory);
  }
}

/**
 * Generate a fallback text overlay without using AI
 * @param blogTitle - The title of the blog post
 * @param blogCategory - The category of the blog
 * @returns A rule-based generated text overlay
 */
function generateFallbackText(blogTitle: string, blogCategory: string): string {
  // Health and nutrition related catchy phrases
  const phrases = [
    "NATURAL SWEETNESS",
    "SUGAR-FREE LIVING",
    "SWEET WITHOUT SUGAR",
    "HEALTHY INDULGENCE",
    "BEYOND SUGAR",
    "NATURALLY SWEET",
    "CRAVINGS CONQUERED",
    "SWEET SCIENCE",
    "BETTER CHOICES",
    "SUGAR FREEDOM"
  ];
  
  // Use deterministic selection combining blog title and category
  const seedString = blogTitle + blogCategory;
  const seed = seedString.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0);
  const selectedPhrase = phrases[seed % phrases.length];
  
  return selectedPhrase;
}

/**
 * Generate a concise and engaging blog title using AI.
 * @param keywords - Array of relevant keywords.
 * @param category - Target category for context.
 * @returns Promise resolving to the generated title string.
 */
export async function generateAITitle(keywords: string[], category: string): Promise<string> {
  if (!ANTHROPIC_API_KEY) {
    console.warn('Anthropic API key not found, using fallback title generation.');
    // Simple fallback
    return `Exploring ${keywords.join(' and ')} in ${category}`;
  }

  const keywordString = keywords.join(', ');

  const prompt = `Generate a compelling, concise, and grammatically correct blog post title (under 10 words) suitable for the category "${category}". The title should be highly relevant to these keywords: ${keywordString}. The title should be engaging, encourage clicks, and sound like it was written by a human, not a corporate bot, not an human writing an email. Aim for a natural, conversational, and relatable tone.

**IMPORTANT FORMATTING RULES:**
1. DO NOT use numbered lists or bullet points (e.g., "1.", "2.", etc.) in the title.
2. DO NOT start the title with numbers or bullet points.
3. DO NOT structure the title as multiple numbered points.
4. Create a SINGLE, COHESIVE title without numerical prefixes.

Please introduce significant variety in the title structures and starting phrases. Use approaches like questions, clear benefit statements (e.g., "How X Helps You Achieve Y" instead of "Unlock Y with X"), "how-to" guides, and unique hooks. Avoid overusing any single structure, starting phrase, or overly "hyped" marketing verbs (e.g., "unlock," "delve," "discover," "harness," "supercharge," "skyrocket"). Focus on clarity and genuine curiosity.

Examples of good titles:
- Is Sugar Sabotaging Your Weight Loss Goals?
- Surprising Ways Stress Affects Your Metabolism
- The Ultimate Guide to Starting a Keto Diet
- Clear Skin Secrets: How Quitting Sugar Helps Looksmaxxing
- Boost Your Looksmaxxing Journey: Ditch Sugar Now
- The No-Sugar Diet for Enhanced Facial Aesthetics
- Level Up Your Looks: The Sugar-Free Advantage
- Looksmaxxing & Diet: Why Sugar is the Enemy
- Get Jawline Definition: Cut Out Sugar

Generate ONLY the title text, nothing else.`;

  try {
    const response = await fetch(ANTHROPIC_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-3-haiku-20240307', // Use Haiku for speed and cost for titles
        max_tokens: 50, // Titles are short
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.7
      })
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error(`Anthropic API error during title generation: ${response.status} ${response.statusText}`, errorBody);
      throw new Error(`Anthropic API error: ${response.statusText}`);
    }

    const data = await response.json();
    let title = data.content[0].text.trim();

    // Basic cleanup: remove surrounding quotes if AI added them
    title = title.replace(/^["'"']/, '').replace(/["'"']$/, '');
    
    // NEW: Remove numbered bullet points and list formatting from title
    // This will match patterns like "1.", "1:", "1)", "Step 1:", etc.
    title = title.replace(/^\s*\d+[\.\:\)]\s*/g, '');
    
    // Remove multi-item numbered lists (e.g., "1. Item 1 2. Item 2 3. Item 3")
    title = title.replace(/\s+\d+[\.\:\)]\s+/g, ' - ');
    
    console.log(`Generated AI Title: "${title}" for keywords: [${keywordString}], category: ${category}`);
    return title;

  } catch (error) {
    console.error('Failed to generate AI title:', error);
    // Fallback if API fails
    return `Understanding ${keywords.join(' and ')} in the Context of ${category}`;
  }
}

/**
 * Generate long-tail or semantic keyword suggestions using AI.
 * @param primaryKeyword - The main keyword to generate suggestions for.
 * @param category - Target category for context.
 * @param type - Type of keywords to generate: 'long-tail' or 'semantic'.
 * @param count - Number of suggestions to generate.
 * @returns Promise resolving to an array of keyword strings.
 */
export async function generateKeywordSuggestions(
  primaryKeyword: string,
  category: string,
  type: 'long-tail' | 'semantic',
  count: number = 5
): Promise<string[]> {
  if (!ANTHROPIC_API_KEY) {
    console.warn('Anthropic API key not found, using fallback keyword suggestions.');
    // Simple fallback
    if (type === 'long-tail') {
      return [`how to use ${primaryKeyword} for ${category}`, `best ${primaryKeyword} in ${category}`];
    }
    return [`related terms for ${primaryKeyword}`, `${primaryKeyword} and ${category}`];
  }

  let instruction = '';
  if (type === 'long-tail') {
    instruction = `Generate ${count} unique long-tail keyword variations for the primary keyword "${primaryKeyword}". These should be phrases a user might search for when looking for information, solutions, or comparisons related to "${primaryKeyword}" within the "${category}" category. Examples: "how to improve ${primaryKeyword} for ${category}", "best ${primaryKeyword} alternatives", "common ${primaryKeyword} issues".`;
  } else { // semantic
    instruction = `Generate ${count} unique semantic keywords or closely related concepts for the primary keyword "${primaryKeyword}" in the context of "${category}". These should be terms often discussed alongside "${primaryKeyword}". Examples: if primary keyword is "sugar cravings", semantic keywords could be "leptin resistance", "blood sugar balance", "emotional eating".`;
  }

  const prompt = `${instruction}

Return ONLY a comma-separated list of the keywords, nothing else. For example: keyword one, keyword two, keyword three`;

  try {
    const response = await fetch(ANTHROPIC_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-3-haiku-20240307', // Haiku for speed and cost
        max_tokens: 150, // Adjusted for potentially longer lists of keywords
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.7
      })
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error(`Anthropic API error during keyword suggestion: ${response.status} ${response.statusText}`, errorBody);
      throw new Error(`Anthropic API error: ${response.statusText}`);
    }

    const data = await response.json();
    const rawKeywords = data.content[0].text.trim();
    const keywordsArray = rawKeywords.split(',').map((kw: string) => kw.trim()).filter((kw: string) => kw.length > 0);
    
    console.log(`Generated AI ${type} keywords: [${keywordsArray.join('; ')}] for primary: "${primaryKeyword}", category: "${category}"`);
    return keywordsArray;

  } catch (error) {
    console.error('Failed to generate AI keyword suggestions:', error);
    // Fallback if API fails
    if (type === 'long-tail') {
      return [`benefits of ${primaryKeyword}`, `${primaryKeyword} side effects`];
    }
    return [`${category} and ${primaryKeyword} connection`, `understanding ${primaryKeyword}`];
  }
} 