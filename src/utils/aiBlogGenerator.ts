/**
 * AI Blog Content Generator
 * Uses Anthropic Claude API to generate complete blog content
 */

import * as dotenv from 'dotenv';
import { findRelevantYouTubeVideo, generateYoutubeEmbedCode } from './youtubeApi';
import * as fs from 'fs';
import { promises as fsPromises } from 'fs'; // Import promises API
import * as path from 'path';

// Load environment variables
dotenv.config();

// API keys from environment variables
const ANTHROPIC_API_KEY = process.env.VITE_ANTHROPIC_API_KEY;
const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';

const KEYWORDS_DIR = path.join(process.cwd(), 'public', 'keywords');
const NOSUGAR_KEYWORDS_PATH = path.join(KEYWORDS_DIR, 'nosugar_keywords.json');

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
    console.error(`Failed to load keyword JSON from ${filePath}:`, err);
  }
  return [];
}

// Global nosugar keyword list (loaded once).
const nosugarKeywords = loadJsonKeywords(NOSUGAR_KEYWORDS_PATH);

/**
 * Gets valid blog post URLs from index.json only (no sitemap dependency).
 * This ensures we only link to posts that actually exist.
 * @returns An array of blog post URLs that are verified to exist.
 */
async function getBlogUrlsFromSitemap(): Promise<{ loc: string, title: string }[]> {
  console.log('Starting getBlogUrlsFromSitemap (index.json only)...');
  try {
    const indexPath = path.join(process.cwd(), 'public', 'blog-data', 'index.json');
    const blogDataDir = path.join(process.cwd(), 'public', 'blog-data');
    
    let urls: { loc: string, title: string }[] = [];
    
    if (fs.existsSync(indexPath)) {
      console.log('Reading index.json...');
      const indexJsonContent = await fsPromises.readFile(indexPath, 'utf-8');
      console.log('Parsing index.json...');
      const indexData = JSON.parse(indexJsonContent);
      
      if (indexData.posts && Array.isArray(indexData.posts)) {
        console.log('Validating blog posts existence...');
        
        // Only include posts that actually exist as files
        for (const post of indexData.posts) {
          if (!post.slug || !post.title || !post.filePath) {
            console.warn(`Skipping invalid post entry: missing slug, title, or filePath`);
            continue;
          }
          
          const fullFilePath = path.resolve(blogDataDir, post.filePath);
          if (fs.existsSync(fullFilePath)) {
            urls.push({
              loc: `https://www.stoppr.app/blog/${post.slug}`,
              title: post.title
            });
          } else {
            console.warn(`Skipping post "${post.slug}": file not found at ${fullFilePath}`);
          }
        }
        
        console.log(`Validated ${urls.length} existing blog posts from index.json`);
      } else {
        console.error('Invalid index.json structure: missing posts array');
      }
    } else {
      console.error('index.json file not found');
    }
    
    console.log(`Returning ${urls.length} verified blog URLs`);
    return urls;
  } catch (error) {
    console.error('Error in getBlogUrlsFromSitemap:', error);
    return [];
  }
}

/**
 * Selects relevant internal links based on the current article's title.
 * @param currentTitle The title of the article being generated.
 * @param allBlogUrls An array of all available blog URLs with titles.
 * @param count The number of links to select.
 * @returns An array of selected relevant blog URLs and their titles.
 */
function selectRelevantInternalLinks(
  currentTitle: string,
  allBlogUrls: { loc: string, title: string }[],
  count: number = 3
): { loc: string, title: string }[] {
    if (!allBlogUrls || allBlogUrls.length === 0) return [];

    const currentTitleLower = currentTitle.toLowerCase();
    const currentTitleWords = new Set(currentTitleLower.split(/[\s-]+/).filter(w => w.length > 3)); // Extract keywords

    const scoredUrls = allBlogUrls
        // Exclude the current article itself if it's already in the sitemap (e.g., regenerating)
        .filter(url => url.title.toLowerCase() !== currentTitleLower) 
        .map(url => {
            const urlTitleLower = url.title.toLowerCase();
            const urlWords = new Set(urlTitleLower.split(/[\s-]+/).filter(w => w.length > 3));
            
            // Calculate relevance score based on shared words
            let score = 0;
            for (const word of currentTitleWords) {
                if (urlWords.has(word)) {
                    score++;
                }
            }
            
            // Give a bonus for partial matches in title (e.g., "sugar cravings" vs "stop sugar cravings")
            if (urlTitleLower.includes(currentTitleLower) || currentTitleLower.includes(urlTitleLower)) {
                 score += 2; 
            }

            return { ...url, score };
        })
        .filter(url => url.score > 0) // Only consider URLs with some relevance
        .sort((a, b) => b.score - a.score); // Sort by relevance score

    return scoredUrls.slice(0, count); // Return the top 'count' relevant URLs
}

/**
 * Generate blog content using Anthropic Claude
 * @param title - Title of the blog post
 * @param category - Category of the blog post
 * @param wordCountMin - Minimum word count for generated content
 * @param wordCountMax - Maximum word count for generated content
 * @param additionalContext - Additional context like tags and description
 * @returns Promise with the generated blog content in HTML format
 */
export async function generateBlogContent(
  title: string,
  category: string,
  wordCountMin: number = 400,  // Increased minimum word count
  wordCountMax: number = 1000, // Increased maximum word count
  additionalContext?: string
): Promise<string> {
  try {
    // Validate and fix the title if it appears to be cut off
    title = ensureCompleteTitlePhrase(title);
    
    // Force API usage - no fallback
    if (!ANTHROPIC_API_KEY) {
      throw new Error('Anthropic API key not found, aborting blog generation');
    }

    // Generate a random word count within the specified range
    const targetWordCount = Math.floor(Math.random() * (wordCountMax - wordCountMin + 1)) + wordCountMin;
    
    // --- NEW: Get Internal Links --- Await the async call
    const allBlogUrls = await getBlogUrlsFromSitemap();
    const relevantLinks = selectRelevantInternalLinks(title, allBlogUrls, 3); // Get up to 3 relevant links
    let internalLinksInstructions = '';
    if (relevantLinks.length >= 2) { // Only add if we have at least 2 links
        const linkList = relevantLinks.map(link => `- ${link.title} (${link.loc})`).join('\\n');
        internalLinksInstructions = `
      INTERNAL LINKING REQUIREMENT:
      - Naturally integrate links to AT LEAST TWO (2), and AT MOST THREE (3), of the following related articles within the body of the text. Make the anchor text relevant to the linked article's title and the surrounding paragraph's context. Do NOT just list the links at the end. Integrate them smoothly where they make sense.
      - Use the full URL provided for the href attribute.
      - Example: <a href="https://www.stoppr.app/blog/example-link">this helpful guide on example topics</a>
      - Relevant Articles to Link:
${linkList}
    `;
    } else {
        console.log("Not enough relevant internal links found to add to prompt.");
    }
    // --- END NEW ---

    // --- NEW: Define prompts based on topic type ---
    let system_persona = `You are a professional nutritionist and health writer specializing in sugar reduction and healthy eating. You consistently write comprehensive, science-backed content that connects emotionally with readers while maintaining SEO best practices. Your writing is especially effective for audiences concerned with fitness, appearance, energy levels, mental clarity, and overall well-being.`;

    let user_prompt_instructions = `
      Write a detailed, informative blog post titled "${title}" for the ${category} category.
      ${additionalContext ? `Additional context: ${additionalContext}` : ''}
      
      IMPORTANT: The content MUST be between ${targetWordCount-20} and ${targetWordCount+20} words in length. 
      This is a strict requirement - not less, not more.
      
      Requirements:
      - The post should begin with a compelling introductory paragraph (without a heading) that hooks the reader, and then proceed into sections with appropriate <h2> and <h3> subheadings.
      - Write exactly ${targetWordCount} words (this is important and non-negotiable)
      - Format as HTML with appropriate headings (h2, h3), paragraphs, and lists
      - Focus on providing valuable, science-backed information
      
      - **VARY PARAGRAPH LENGTH:** Use a mix of short (1-2 sentences), medium (3-4 sentences), and longer (5+ sentences) paragraphs throughout the article. This variation is crucial for readability and engagement. Avoid making all paragraphs the same length.
      - CRITICAL: Avoid any paragraph longer than 5 sentences. If a section feels dense, break it up into smaller paragraphs or use subheadings/lists for readability. Never output a large block of text as a single paragraph.
      - **Sentence Structure:** While maintaining an authoritative tone, use a variety of sentence structures (simple, compound, complex) to create a natural rhythm. Avoid overly long and convoluted sentences where simpler ones would be clearer.
      
      TABLE REQUIREMENT:
      - Include at least 1 informative HTML table (<table>, <tr>, <th>, <td>) that presents relevant data, comparison, or analysis
      - The table should have a clear purpose relevant to the article topic
      - Use proper table formatting with headers (th) and data cells (td)
      - Include at least 4 rows of data and 2-5 columns
      - Example table topics: comparison of sugar alternatives, breakdown of sugar content in foods, timeline of sugar withdrawal symptoms, etc.
      
      IMAGE PLACEMENT REQUIREMENT:
      - Include exactly 3 image placeholders at strategic points in the article using the format: <div class="blog-image-placeholder" data-description="[brief description of what image should show]"></div>
      - Place the first image after the first or second heading (h2) section
      - Place the second image roughly in the middle of the content, preferably after a key point or before an important section
      - Place the third image near the end, before the conclusion or final section
      - Each image placeholder should have a unique, detailed description that clearly explains what the image should depict (related to the surrounding content)
      - Make image descriptions specific and visual (e.g., "A detailed comparison of natural vs. processed sugar molecules" rather than "Sugar comparison")
      
      EMOTIONAL HOOKS:
      - Begin with a compelling emotional hook in the introduction that resonates with the reader's pain points
      - Use relatable scenarios that make the reader feel understood and motivated
      - Include at least one emotionally powerful statement about how sugar affects daily life or long-term health
      - End with an empowering message that gives the reader hope and motivation
      
      SCIENTIFIC CREDIBILITY:
      - Include at least 2-3 specific references to scientific studies or research findings
      - Mention actual statistics or research percentages where relevant (e.g., "Research shows that reducing sugar intake by 40% can lead to a 30% improvement in...")
      - Reference findings from reputable organizations like WHO, CDC, or peer-reviewed journals
      - Explain the biological mechanisms behind sugar's effects on the body when relevant
      
      KEYWORD OPTIMIZATION:
      - Include the main keyword "${title.toLowerCase()}" naturally throughout the content
      - Use variations of this keyword in at least 2-3 H2 or H3 headings
      - Include semantically related terms naturally throughout the text
      - Write with search intent in mind - answer the questions users are likely asking about this topic
      - Include question-based subheadings where appropriate (e.g., "How does sugar affect inflammation?")
      - Maintain keyword density of approximately 1-2% without keyword stuffing
      - Incorporate long-tail keyword variations throughout the content
      - Include at least 2-3 phrases that match common voice search patterns (e.g., "how to reduce sugar cravings quickly")
      - Include complementary keywords from the same topical cluster
      
      STRUCTURE AND FORMAT:
      - Include at least one bulleted list (ul/li) and one numbered list (ol/li)
      - CRITICAL: Use proper HTML list markup - ALL numbered lists MUST be formatted as <ol><li>Item 1</li><li>Item 2</li></ol> NOT as plain text "1. Item 1" "2. Item 2"
      - CRITICAL: Use proper HTML list markup - ALL bulleted lists MUST be formatted as <ul><li>Item 1</li><li>Item 2</li></ul> NOT as plain text "- Item 1" "- Item 2"
      - Use proper HTML structure (no need for html, head, or body tags)
      - Write in a friendly, authoritative tone suitable for health and nutrition content
      - Do not include any introduction saying "here's an article about..."
      - Avoid repetition and fluff
      - Include detailed explanations and specific examples
      - Make sure the content is substantial and informative
      
      ${internalLinksInstructions}

      Return ONLY the HTML content, nothing else.
    `;

    // --- NEW: Use defined prompts in API call ---
    console.log('Initiating Anthropic API call...'); // Log before fetch
    let response: Response;
    let attempts = 0;
    const maxAttempts = 3;
    const retryDelayMs = 5000; // 5 seconds delay

    while (attempts < maxAttempts) {
      attempts++;
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 90000); // 30 seconds timeout

        response = await fetch(ANTHROPIC_API_URL, {
          signal: controller.signal, // Add abort signal
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': ANTHROPIC_API_KEY,
            'anthropic-version': '2023-06-01'
          },
          body: JSON.stringify({
            model: 'claude-3-5-sonnet-20240620',
            max_tokens: 4096,
            messages: [
              {
                role: 'user',
                content: [
                  {
                    type: 'text', 
                    text: `${system_persona}\n\n${user_prompt_instructions}` // Combine persona and instructions
                  }
                ]
              }
            ],
            temperature: 0.7
          })
        });

        clearTimeout(timeoutId); // Clear timeout if fetch completes
        console.log(`Anthropic API attempt ${attempts} response status: ${response.status}`); // Log response status

        if (response.ok) {
          break; // Successful response, exit retry loop
        } else {
          // Handle non-OK responses that we might not want to retry (e.g., 4xx client errors)
          // For now, we'll retry on any non-OK response for simplicity, but this could be refined.
          console.error(`Anthropic API attempt ${attempts} failed with status: ${response.status} ${response.statusText}`);
          if (attempts >= maxAttempts) {
            const errorBody = await response.text();
            console.error(`Anthropic API error after ${maxAttempts} attempts: ${response.status} ${response.statusText}`, errorBody);
            throw new Error(`Anthropic API error after ${maxAttempts} attempts: ${response.statusText}`);
          }
        }

      } catch (fetchError: any) {
        console.error(`Anthropic API attempt ${attempts} fetch error:`, fetchError);
        if (fetchError.name === 'AbortError') {
            console.error('Anthropic API call timed out after 30 seconds.');
            // Optionally, decide if AbortError should be retried or immediately throw
            if (attempts >= maxAttempts) throw new Error('Anthropic API call timed out after multiple attempts.');
        } else if (attempts >= maxAttempts) {
          // This is the final attempt that failed
          throw new Error(`Anthropic API fetch failed after ${maxAttempts} attempts: ${fetchError.message}`);
        }
        // For other fetch errors (like SocketError), we'll retry after a delay
      }
      
      if (attempts < maxAttempts) {
        console.log(`Waiting ${retryDelayMs / 1000} seconds before retry attempt ${attempts + 1}...`);
        await new Promise(resolve => setTimeout(resolve, retryDelayMs));
      }
    }
    // @ts-ignore response will be assigned if successful
    if (!response || !response.ok) {
      // This case should ideally be caught by the throw in the loop, but as a safeguard:
      console.error('Failed to get a successful response from Anthropic API after multiple attempts.');
      throw new Error('Failed to get a successful response - aborting without fallback');
    }
    // --- END NEW ---

    console.log('Parsing Anthropic API response...'); // Log before parsing
    const data = await response.json();
    console.log('Successfully parsed Anthropic API response.'); // Log after parsing
    let generatedContent = data.content[0].text.trim();
    
    // Count words in generated content (roughly)
    const wordCount = generatedContent.split(/\s+/).length;
    console.log(`Generated ${wordCount} words of content for "${title}"`);
    
    // If word count is too low, log a warning
    if (wordCount < wordCountMin) {
      console.warn(`Generated content for "${title}" has only ${wordCount} words, which is less than the minimum ${wordCountMin}`);
    }
    
    // --- YouTube Video Integration Start ---
    const videoPlaceholder = "<!-- YOUTUBE_VIDEO_PLACEHOLDER -->";

    // Find the first closing </table> tag
    let tableEndIndex = generatedContent.indexOf('</table>');
    if (tableEndIndex !== -1) {
      // Insert after </table>
      tableEndIndex += 8; // length of '</table>'
      generatedContent = generatedContent.slice(0, tableEndIndex) + `\n\n${videoPlaceholder}\n\n` + generatedContent.slice(tableEndIndex);
    } else {
      // Fallback: Insert placeholder roughly in the middle as before
      const middleIndex = Math.floor(generatedContent.length / 2);
      let insertIndex = generatedContent.indexOf('</p>', middleIndex);
      if (insertIndex === -1) {
        insertIndex = generatedContent.lastIndexOf('</p>', middleIndex);
      }
      if (insertIndex === -1) {
        console.warn("Could not find a suitable paragraph end tag for video insertion. Inserting at midpoint.");
        insertIndex = middleIndex;
        generatedContent = generatedContent.slice(0, insertIndex) + `\n${videoPlaceholder}\n` + generatedContent.slice(insertIndex);
      } else {
        insertIndex += 4;
        generatedContent = generatedContent.slice(0, insertIndex) + `\n\n${videoPlaceholder}\n\n` + generatedContent.slice(insertIndex);
      }
    }

    // 2. Generate Search Query
    // Use the first ~1000 chars or the whole content if shorter
    const contentSnippet = generatedContent.substring(0, 1000);
    const searchQuery = await generateYouTubeSearchQuery(contentSnippet);

    let videoFound = false;
    if (searchQuery) {
      // 3. Search YouTube
      // Pass blog title for better validation
      const videoId = await findRelevantYouTubeVideo(searchQuery, title);

      if (videoId) {
        // 4. Generate Embed Code
        const embedCode = generateYoutubeEmbedCode(videoId);
        // 5. Replace Placeholder with Embed Code
        generatedContent = generatedContent.replace(videoPlaceholder, embedCode);
        videoFound = true;
        console.log(`Successfully embedded YouTube video ${videoId} for query "${searchQuery}"`);
      } else {
         console.log(`No YouTube video found for query "${searchQuery}".`);
      }
    } else {
       console.log("Could not generate a YouTube search query.");
    }

    // 6. Remove placeholder if video wasn't found/embedded
    if (!videoFound) {
      generatedContent = generatedContent.replace(videoPlaceholder, '');
      console.log("Removed YouTube video placeholder as no video was embedded.");
    }

    // --- YouTube Video Integration End ---

    return generatedContent;
    
  } catch (error) {
    console.error('Failed to generate AI blog content:', error);
    // No fallback - abort generation if there's a failure
    throw new Error('Failed to generate blog content - aborting without fallback');
  }
}

/**
 * Generate a short preview content for blog listings
 * @param title - Title of the blog post
 * @param category - Category of the blog post
 * @param additionalContext - Additional context like tags and description
 * @returns Promise with brief preview content (50-80 words) for index.json
 */
export async function generatePreviewContent(
  title: string,
  category: string,
  additionalContext?: string
): Promise<string> {
  // Validate and fix the title if it appears to be cut off
  title = ensureCompleteTitlePhrase(title);
  
  // Ensure API key is available
  if (!ANTHROPIC_API_KEY) {
    console.error('Anthropic API key not found, aborting preview generation.');
    throw new Error('Anthropic API key not found, aborting preview generation.');
  }
  
  const prompt = `
    Create a brief preview text for a blog post titled "${title}" in the ${category} category.
    ${additionalContext ? `Additional context: ${additionalContext}` : ''}
    
    Requirements:
    - Total length: 50-80 words maximum (critical requirement)
    - Format: Start with a catchy headline on the first line, followed by a brief description
    - First line should be a short, impactful headline (3-7 words) that captures attention
    - After the headline, write 2-3 sentences that summarize the value proposition and main benefit
    - Focus on problem-solution format that highlights what the reader will gain
    - No HTML formatting or tags - return plain text only
    - Do not include quotes or unnecessary punctuation
    - No introductory phrases like "This article explores..." - be direct and engaging
    
    Return ONLY the preview text, nothing else.
  `;
  
  const response = await fetch(ANTHROPIC_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: 'claude-3-5-sonnet-20241022', // Using the smaller model is sufficient for short previews
      max_tokens: 150,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text', 
              text: `You are a specialist in creating concise, engaging blog previews that drive reader interest. 

${prompt}`
            }
          ]
        }
      ],
      temperature: 0.7
    })
  });
  
  if (!response.ok) {
    const errorBody = await response.text();
    console.error(`Anthropic API error for preview content: ${response.status} ${response.statusText}`, errorBody);
    throw new Error(`Anthropic API error for preview content: ${response.statusText}`);
  }
  
  const data = await response.json();
  const generatedPreview = data.content[0].text.trim();
  
  return generatedPreview;
}

/**
 * Generate an SEO-optimized meta description using Anthropic Claude
 * @param title - Title of the blog post
 * @param fullContent - The full HTML content of the blog post
 * @returns Promise with the generated meta description (plain text)
 */
export async function generateMetaDescription(
  title: string,
  fullContent: string
): Promise<string> {
  if (!ANTHROPIC_API_KEY) {
    console.error('Anthropic API key not found, aborting meta description generation.');
    throw new Error('Anthropic API key not found, aborting meta description generation.');
  }

  // Prepare a snippet of the content for the prompt (e.g., first 1000 characters)
  // This helps keep the prompt concise while giving context
  const contentSnippet = fullContent.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').substring(0, 1000);

  const prompt = `
    Analyze the following blog post title and content snippet.
    Blog Post Title: "${title}"
    Content Snippet: "${contentSnippet}..."

    Your task is to write a compelling SEO meta description for this blog post.

    Requirements:
    - Length: Strictly between 120 and 155 characters. This is crucial for search engine display.
    - Content: Accurately summarize the blog post's main topic and unique value proposition.
    - Keywords: Naturally incorporate the primary keyword(s) from the title. Also, try to include 1-2 relevant secondary keywords if they fit naturally and add value.
    - Engagement: Make it engaging and click-worthy. Encourage users to read the full article.
    - Tone: Match the informative and helpful tone of a health and wellness blog.
    - Format: Plain text only. No HTML tags. No newline characters. No quotation marks unless part of a direct, very short quote that is essential.
    - Uniqueness: Ensure the description is unique and not a generic template.

    Return ONLY the meta description text, nothing else.
  `;

  const response = await fetch(ANTHROPIC_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: 'claude-3-haiku-20240307', // Haiku is suitable for this focused task
      max_tokens: 100, // Max 155 chars ~ 70-80 tokens roughly, 100 is safe buffer
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: prompt
            }
          ]
        }
      ],
      temperature: 0.6 // Slightly lower temperature for more focused and concise output
    })
  });

  if (!response.ok) {
    const errorBody = await response.text();
    console.error(`Anthropic API error (meta description): ${response.status} ${response.statusText}`, errorBody);
    throw new Error(`Anthropic API error for meta description: ${response.statusText}`);
  }

  const data = await response.json();
  let generatedMetaDesc = data.content[0].text.trim();

  // Final cleanup: remove any accidental newlines and ensure length constraint (as a fallback)
  generatedMetaDesc = generatedMetaDesc.replace(/\n/g, ' ');
  if (generatedMetaDesc.length > 155) {
    generatedMetaDesc = generatedMetaDesc.substring(0, 152) + '...';
  }
  if (generatedMetaDesc.length < 50 && title) { // If too short, throw an error
      console.error("Generated meta description too short, aborting.")
      throw new Error("Generated meta description too short, aborting.");
  }

  console.log(`Generated Meta Description for "${title}": ${generatedMetaDesc}`);
  return generatedMetaDesc;
}

/**
 * Generates a concise YouTube search query based on blog content using Anthropic Claude.
 * @param contentSnippet A snippet of the blog content (e.g., first 500 chars).
 * @returns A promise resolving to the generated search query string, or null if failed.
 */
async function generateYouTubeSearchQuery(contentSnippet: string): Promise<string | null> {
  if (!ANTHROPIC_API_KEY) {
    console.error('Anthropic API key not found, cannot generate YouTube search query.');
    throw new Error('Anthropic API key not found, cannot generate YouTube search query.');
  }

  const prompt = `Analyze the following blog post content snippet. Generate a concise and highly relevant 3-7 word search query suitable for finding a matching YouTube video. Focus intensely on the core topic or the single most salient point discussed in the snippet. Output ONLY the search query text, nothing else.

Content Snippet:
---
${contentSnippet}
---

Search Query:`;

  const response = await fetch(ANTHROPIC_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      // Using Haiku for speed and cost-effectiveness for this simple task
      model: 'claude-3-haiku-20240307',
      max_tokens: 50, // Should be plenty for a short query
      messages: [ { role: 'user', content: prompt } ],
      temperature: 0.5, // Lower temperature for more focused output
    })
  });

  if (!response.ok) {
    const errorBody = await response.text();
    console.error(`Anthropic API error for YouTube query gen: ${response.statusText} - ${errorBody}`);
    throw new Error(`Anthropic API error for YouTube query gen: ${response.statusText}`);
  }

  const data = await response.json();
  const query = data.content[0].text.trim();
  console.log(`Generated YouTube search query: "${query}"`);
  return query;
}

/**
 * Ensures a title is not cut off in the middle of a phrase by checking for common indicators
 * @param title - The title of the blog post
 * @returns A corrected title if needed, or the original if it appears complete
 */
function ensureCompleteTitlePhrase(title: string): string {
  // Common patterns that suggest a title is incomplete
  const incompleteMarkers = [
    { ending: '&', replacement: '& Wellness' },
    { ending: 'and', replacement: 'and Wellness' },
    { ending: 'the', replacement: 'the Body' },
    { ending: 'your', replacement: 'your Health' },
    { ending: 'to', replacement: 'to Wellness' },
    { ending: 'for', replacement: 'for Health' },
    { ending: 'with', replacement: 'with Ease' },
    { ending: 'of', replacement: 'of Wellness' },
    { ending: 'by', replacement: 'by Design' },
    { ending: 'from', replacement: 'from Your Diet' },
    { ending: 'affects', replacement: 'affects Health' },
    { ending: 'impact', replacement: 'impact on Health' }
  ];
  
  // Check if title ends with any of the incomplete markers
  const words = title.split(' ');
  const lastWord = words[words.length - 1].toLowerCase();
  
  for (const marker of incompleteMarkers) {
    if (lastWord === marker.ending.toLowerCase()) {
      // If we found a match, append the replacement text
      console.log(`Fixed incomplete title: "${title}" -> "${title} ${marker.replacement}"`);
      return `${title} ${marker.replacement}`;
    }
  }
  
  // Additional check for incomplete phrases in the middle
  const titleLower = title.toLowerCase();
  if (titleLower.includes(' affects ') && !titleLower.includes(' affects your ') && !titleLower.includes(' affects health')) {
    const updatedTitle = title.replace(' affects ', ' affects your ');
    console.log(`Fixed incomplete affects phrase: "${title}" -> "${updatedTitle}"`);
    return updatedTitle;
  }
  
  return title;
} 