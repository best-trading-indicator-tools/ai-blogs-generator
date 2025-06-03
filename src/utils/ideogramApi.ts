/**
 * Ideogram API utility for generating and upscaling blog images
 * API Documentation: https://developer.ideogram.ai/api-reference/api-reference
 */

// Removed unused import
// import { generateTextOverlay } from './aiTextGenerator';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Get the API key from environment variables
const API_KEY = process.env.VITE_IDEOGRAM_API_KEY || '';
const API_BASE_URL = 'https://api.ideogram.ai';
const API_V3_GENERATE_ENDPOINT = '/v1/ideogram-v3/generate';

/**
 * Clean text of bullet points, numbered lists, and other formatting that
 * shouldn't appear in titles or image overlays
 * @param text - The text to clean
 * @returns Cleaned text without bullet points or numbered list formatting
 */
function cleanTextFormatting(text: string): string {
  if (!text) return '';
  
  let cleaned = text;
  
  // Remove numbered bullet points at the beginning of text (e.g., "1. Title")
  cleaned = cleaned.replace(/^\s*\d+[\.\:\)]\s*/g, '');
  
  // Remove multi-item numbered lists (e.g., "1. Item 1 2. Item 2 3. Item 3")
  cleaned = cleaned.replace(/\s+\d+[\.\:\)]\s+/g, ' - ');
  
  return cleaned;
}

// Interfaces for API responses
interface IdeogramGenerationResponse {
  created: string;
  data: Array<{
    prompt: string;
    resolution: string;
    is_image_safe: boolean;
    seed: number;
    url: string;
    style_type: string;
  }>;
}

interface IdeogramUpscaleResponse {
  upscaled_img_url: string;
}

/**
 * Generate an image using Ideogram API with retry logic
 * @param prompt - Text prompt describing the desired image
 * @param negativePrompt - Optional negative prompt for the image
 * @param retryCount - Number of retries (default: 3)
 * @returns Promise with the generated image data and ID
 */
export async function generateImage(
  prompt: string, 
  negativePrompt?: string, 
  retryCount: number = 3
): Promise<{
  imageId: string;
  imageUrl: string;
}> {
  let lastError: Error | null = null;
  
  for (let attempt = 1; attempt <= retryCount; attempt++) {
    try {
      if (!API_KEY) {
        throw new Error('Ideogram API key is not set in environment variables');
      }

      console.log(`Generation attempt ${attempt}/${retryCount} for prompt: "${prompt.substring(0, 50)}..."`);

      // Create form data for multipart request (v3 API)
      const formData = new FormData();
      formData.append('prompt', prompt);
      
      if (negativePrompt) {
        formData.append('negative_prompt', negativePrompt);
      }
      
      // Set aspect ratio to 16:9 for blog headers (corrected format)
      formData.append('aspect_ratio', '16x9');
      
      // Set rendering speed to QUALITY as requested
      formData.append('rendering_speed', 'QUALITY');
      
      // Set magic prompt to OFF
      formData.append('magic_prompt', 'OFF');
      
      // Style type commented out as not needed
      //formData.append('style_type', style || 'REALISTIC');

      const response = await fetch(`${API_BASE_URL}${API_V3_GENERATE_ENDPOINT}`, {
        method: 'POST',
        headers: {
          'Api-Key': API_KEY,
        },
        body: formData,
      });

      // Check for non-200 response and handle specifically
      if (!response.ok) {
        const contentType = response.headers.get('content-type');
        let errorMessage = `HTTP error ${response.status}: ${response.statusText}`;
        
        // Try to extract more error information based on content type
        if (contentType && contentType.includes('application/json')) {
          const errorData = await response.json();
          errorMessage += ` - ${JSON.stringify(errorData)}`;
        } else {
          // If not JSON, get the text (which might be HTML)
          const textResponse = await response.text();
          errorMessage += ` - Non-JSON response: ${textResponse.substring(0, 100)}...`;
        }
        
        throw new Error(errorMessage);
      }

      // Get the response text first to examine it
      const responseText = await response.text();
      
      // Check for empty response
      if (!responseText || responseText.trim() === '') {
        throw new Error('Empty response from Ideogram API');
      }
      
      // Check if the response starts with "<" which indicates HTML instead of JSON
      if (responseText.trim().startsWith('<')) {
        throw new Error(`Received HTML instead of JSON: ${responseText.substring(0, 100)}...`);
      }
      
      // Parse the response as JSON
      const data = JSON.parse(responseText) as IdeogramGenerationResponse;
      
      if (!data.data || !data.data.length) {
        throw new Error('No image data returned from API');
      }
      
      return {
        imageId: `${data.data[0].seed}`,
        imageUrl: data.data[0].url,
      };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      console.error(`Attempt ${attempt}/${retryCount} failed:`, lastError.message);
      
      // Only retry if we haven't reached the maximum attempts
      if (attempt < retryCount) {
        // Exponential backoff: wait longer between each retry
        const backoffMs = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
        console.log(`Retrying in ${backoffMs}ms...`);
        await new Promise(resolve => setTimeout(resolve, backoffMs));
      }
    }
  }
  
  // If we've exhausted all retries, throw the last error
  throw lastError || new Error('Failed to generate image after multiple attempts');
}

/**
 * Upscale a generated image for higher quality
 * @param imageId - ID of the image to upscale
 * @returns Promise with the upscaled image URL
 */
export async function upscaleImage(imageId: string): Promise<string> {
  if (!API_KEY) {
    console.error('Ideogram API key is not set in environment variables. Upscaling aborted.');
    throw new Error('Ideogram API key is not set in environment variables. Upscaling aborted.');
  }
  
  const response = await fetch(`${API_BASE_URL}/upscale`, {
    method: 'POST',
    headers: {
      'Api-Key': API_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      generation_id: imageId,
    }),
  });

  if (!response.ok) {
    let errorData;
    try {
      errorData = await response.json();
    } catch (e) {
      // If response is not JSON, use statusText
      errorData = { message: response.statusText };
    }
    console.error(`Failed to upscale image: Ideogram API error: ${errorData.message || response.statusText}`);
    throw new Error(`Failed to upscale image: Ideogram API error: ${errorData.message || response.statusText}`);
  }

  const data = await response.json() as IdeogramUpscaleResponse;
  if (!data.upscaled_img_url) {
    console.error('Failed to upscale image: API response did not contain upscaled_img_url.');
    throw new Error('Failed to upscale image: API response did not contain upscaled_img_url.');
  }
  return data.upscaled_img_url;
}

/**
 * Generate blog image with appropriate prompt based on blog title and content
 * @param blogTitle - Title of the blog post
 * @param blogCategory - Category of the blog (e.g., "Nutrition", "Health Tips")
 * @param additionalContext - Optional additional context for better image generation
 * @param includeTextOverlay - Optional boolean to include text overlay
 * @returns Promise with the final image URL
 */
export async function generateBlogImage(
  blogTitle: string,
  blogCategory: string,
  additionalContext?: string,
  includeTextOverlay: boolean = true
): Promise<string> {
  try {
    // Clean title and context of any bullet points or list formatting
    const cleanedTitle = cleanTextFormatting(blogTitle);
    const cleanedContext = additionalContext ? cleanTextFormatting(additionalContext) : undefined;
    
    // Determine the primary description based on whether it's an inline image (no overlay) with specific context
    const primaryDescription = !includeTextOverlay && cleanedContext ? cleanedContext : cleanedTitle;
    const lowerPrimaryDescription = primaryDescription.toLowerCase(); // Use this for checks

    // Construct a detailed prompt for better image generation
    // Start with a base prompt focusing on photorealism and quality
    let basePrompt = includeTextOverlay 
      ? `Photorealistic, high-quality image illustrating the concept of \"${primaryDescription}\".`
      : `Photorealistic, high-quality image showing ${primaryDescription} without any text elements.`;

    // --- Apply base negative prompt universally ---
    let negativePrompts = "Avoid graphic, disturbing, overly severe, or weird depictions. Focus on clarity and aesthetic quality. disturbing, naked people, nudity, unrealistic, horror.";

    // If it's a header image, add negative prompts to avoid generic fruit images unless specifically related to topic
    if (includeTextOverlay) {
      negativePrompts += " Avoid generic fruit imagery (oranges, kiwi, berries, citrus) unless directly relevant to the specific topic. Avoid repetitive or common stock photo looks.";
    }

    // --- REMOVE Specific handling for acne/skin condition keywords ---
    // const lowerTitle = blogTitle.toLowerCase(); // Use lowerPrimaryDescription instead
    let comparisonInstructions = "";

    // Handle comparison/transformation prompts explicitly using the primary description
    if (lowerPrimaryDescription.includes('transformation') || lowerPrimaryDescription.includes('before and after') || lowerPrimaryDescription.includes('comparison')) {
        // If it's about acne/skin, ensure the 'after' shows improvement
        // We still need this specific comparison instruction if the title implies it, regardless of keywords
        if (lowerPrimaryDescription.includes('acne') || lowerPrimaryDescription.includes('skin')) {
             comparisonInstructions = " If showing a before/after comparison, the 'after' state MUST show significantly improved, clearer, healthier skin with reduced inflammation compared to the 'before' state.";
        } else {
             comparisonInstructions = " If showing a before/after comparison, ensure the 'after' state clearly depicts a positive improvement relevant to the title.";
        }
        // Modify base prompt for comparison, using the primary description
        basePrompt = includeTextOverlay
          ? `Photorealistic before-and-after comparison illustrating "${primaryDescription}".`
          : `Photorealistic before-and-after comparison showing ${primaryDescription} without any text elements.`;
    }

    let textOverlayPrompt = '';
    let visualInstructions = '';
    if (includeTextOverlay) {
      // Use the cleaned blog title for the overlay if requested
      const textOverlayContent = cleanedTitle;
      textOverlayPrompt = `Overlay the exact text \"${textOverlayContent}\" using white font on a solid black banner placed horizontally across the image. The banner should be opaque.`;
      visualInstructions = `Do not add any other text, diagrams, annotations, or labels. Only the requested text overlay.`;
    } else {
      // If no overlay, just request a visual image without text.
      visualInstructions = `CREATE A VISUAL REPRESENTATION ONLY. ABSOLUTELY NO TEXT, LETTERS, WORDS, LABELS, CAPTIONS OR TEXT OF ANY KIND IN THE IMAGE.`;
      // Add strong negative prompts against text for inline images
      negativePrompts += " textual content, written language, typographic elements, letterforms, characters, numerals, words, sentences, paragraphs, captions, labels, headlines, titles, subtitles, watermarks, signatures, logos with text, annotations, diagrams with text, infographics with text. IMAGE ONLY. NO WRITING. NO LETTERS. NO NUMBERS.";
    }

    const categoryContext = `For a ${blogCategory} article`;

    // Image style and visual treatment options
    const visualStyles = [
      "professional photography with dramatic lighting",
      "bright and airy lifestyle photography",
      "moody atmospheric photography with deep contrasts",
      "clean minimalist approach with simple backgrounds",
      "vibrant colors with striking composition",
      "natural light photography with soft tones",
      "cinematic dramatic style with dynamic angles",
      "high-end editorial photography",
      "documentary-style authentic moment",
      "artistic composition with selective focus"
    ];
    
    // Composition options
    const compositionStyles = [
      "overhead flat lay",
      "close-up detail shot",
      "environmental wide shot",
      "rule-of-thirds composition",
      "symmetrical centered composition",
      "side-by-side comparison",
      "person interacting with elements",
      "abstract conceptual arrangement",
      "lifestyle contextual setting",
      "workspace or preparation area",
      "studio setting with clean background"
    ];
    
    // Randomly select visual style and composition for variety
    const randomVisualStyle = visualStyles[Math.floor(Math.random() * visualStyles.length)];
    const randomComposition = compositionStyles[Math.floor(Math.random() * compositionStyles.length)];
    
    // Base style instructions
    let styleInstructions = `${randomVisualStyle} with ${randomComposition}. `;
    
    // Enhanced topic-specific imagery guidance
    let topicImagery = '';
    
    // Detect keywords in the primary description to determine subject matter
    const lowerDescription = primaryDescription.toLowerCase();
    
    // Add category-specific elements and diverse imagery options
    if (blogCategory.toLowerCase().includes('nutrition')) {
      if (lowerDescription.includes('sugar') || lowerDescription.includes('cravings')) {
        topicImagery = `Show sugar alternatives, person declining sweets, visual metaphors for breaking addiction (broken chains, open cage), or transformation scenes. Could include stevia plants, monk fruit, erythritol crystals, or person choosing water over soda. Avoid generic fruit bowls.`;
      } else if (lowerDescription.includes('energy') || lowerDescription.includes('metabolism')) {
        topicImagery = `Show active people, energy visualization (light streams, dynamic motion), metabolism-boosting activities, or morning routines. Consider green tea preparation, HIIT exercise, protein-rich meals, or person feeling energized. Also consider thermogenic foods like chili peppers, ginger root, or cinnamon.`;
      } else if (lowerDescription.includes('gut') || lowerDescription.includes('digestion')) {
        topicImagery = `Show digestive health imagery, probiotics visualization, fermentation process, or gut-friendly foods. Could include kombucha brewing, yogurt making, kimchi preparation, or person feeling relief. Consider microscopic beneficial bacteria visualization.`;
      } else {
        topicImagery = `Show varied whole foods beyond just fruits - include vegetables, proteins, grains, nuts, seeds in interesting arrangements. Consider meal prep scene, cooking process, farmer's market, garden harvest, or farm-to-table concept.`;
      }
    } else if (blogCategory.toLowerCase().includes('health')) {
      if (lowerDescription.includes('sleep') || lowerDescription.includes('rest')) {
        topicImagery = `Show peaceful sleeping environment, relaxation techniques, calming bedtime routines, or sleep accessories. Consider lavender sachets, meditation cushion, person in restful pose, chamomile tea preparation, or sunset/evening ambiance.`;
      } else if (lowerDescription.includes('stress') || lowerDescription.includes('anxiety')) {
        topicImagery = `Show stress-reduction techniques, meditation, nature scenes, breathing exercises, or calming activities. Consider person doing yoga, forest bathing, journaling, walking in nature, or hands in meditation mudra.`;
      } else if (lowerDescription.includes('weight') || lowerDescription.includes('loss')) {
        topicImagery = `Show fitness activities, healthy meal planning, body composition measurement, or weight management visualizations. Consider resistance training, portion control, measuring tape, meal prepping, or hiking outdoors. Avoid just showing fruits.`;
      } else {
        topicImagery = `Show diverse health-related imagery - medical professionals, preventative screenings, wellness practices, fitness activities, or medical technology. Consider holistic approaches, integrative medicine, wearable health devices, or health coaching session.`;
      }
    } else if (blogCategory.toLowerCase().includes('science')) {
      topicImagery = `Show relevant scientific/educational elements - laboratories, research process, scientists at work, data visualization, scientific equipment, or experimental setup. Consider microscopes, test tubes, data graphs, research notes, or cutting-edge technology.`;
    } else if (blogCategory.toLowerCase().includes('lifestyle')) {
      topicImagery = `Show diverse people in relevant everyday healthy situations - work-life balance, social activities, outdoor recreation, or home environments. Consider morning routines, family meals, friends exercising together, community gardens, or workspace wellness.`;
    } else if (blogCategory.toLowerCase().includes('looksmaxxing') || lowerDescription.includes('skin') || lowerDescription.includes('acne')) {
      if (lowerDescription.includes('skin') || lowerDescription.includes('acne')) {
        topicImagery = `Show skin care routines, dermatological treatments, close-ups of improved skin, or product application techniques. Consider facial treatments, sheet masks, facial tools, professional consultation, or natural ingredients for skin. Avoid generic fruit images.`;
      } else if (lowerDescription.includes('hair') || lowerDescription.includes('looksmaxxing')) {
        topicImagery = `Show grooming routines, hair care products, styling techniques, personal care rituals, or salon environment. Consider hair treatments, styling tools, barber shop, product application, or hair transformation.`;
      } else {
        topicImagery = `Focus on specific self-improvement routines, wellness practices, aesthetic enhancement activities, or personal transformation. Consider grooming station, wellness retreat, professional styling, fitness training, or confidence-building activities.`;
      }
    }
    
    // Human element options for variety (when appropriate)
    const humanElements = [
      "diverse people of various ethnicities and backgrounds",
      "professionals demonstrating techniques",
      "everyday people in relatable situations",
      "hands performing relevant actions",
      "silhouettes suggesting activity",
      "close-up on facial expressions showing relevant emotions",
      "group interactions showing community aspects"
    ];
    
    // Setting options for variety
    const settingOptions = [
      "modern home interior",
      "professional workspace",
      "outdoor natural environment",
      "urban setting",
      "clinical/professional environment",
      "stylish minimalist space",
      "gymnasium or fitness space",
      "kitchen or meal prep area",
      "wellness or spa setting"
    ];
    
    // Randomly select human and setting options when appropriate
    if (!lowerDescription.includes('ingredient') && !lowerDescription.includes('food') && Math.random() > 0.3) {
      const randomHumanElement = humanElements[Math.floor(Math.random() * humanElements.length)];
      const randomSetting = settingOptions[Math.floor(Math.random() * settingOptions.length)];
      topicImagery += ` Include ${randomHumanElement} in a ${randomSetting}.`;
    }
    
    // Add topicImagery to styleInstructions
    styleInstructions += `${topicImagery}`;

    // Construct the full prompt conditionally based on includeTextOverlay
    const promptParts = [
        basePrompt,
        comparisonInstructions,
        includeTextOverlay ? textOverlayPrompt : '',
        visualInstructions,
        categoryContext,
        styleInstructions,
    ];
    const fullPrompt = promptParts.filter(part => part && part.trim()).join('. '); // Join non-empty parts

    console.log("\n--- Generating Ideogram Image ---");
    console.log(`Full Prompt: ${fullPrompt}`);
    console.log(`Negative Prompt: ${negativePrompts || 'None'}`);
    console.log("-------------------------------\n");

    // First generate the image, passing the negative prompt
    const { imageUrl } = await generateImage(fullPrompt, negativePrompts);
    
    // We'll skip upscaling since Ideogram API already provides high-res images
    return imageUrl;
  } catch (error) {
    console.error('Failed to generate blog image:', error);
    throw error;
  }
} 