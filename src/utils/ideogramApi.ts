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
): Promise<{ imageId: string; imageUrl: string; } | null> {
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
      
      formData.append('num_images', '2'); // Generate only 2 images for cost savings
      
      // Style type commented out as not needed
      //formData.append('style_type', style || 'REALISTIC');

      console.log('Requesting 2 images from Ideogram API...');
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
      
      console.log(`Received ${data.data.length} images from Ideogram API. Selecting first image...`);
      
      // Return the first image
      const firstImageData = data.data[0];
      return {
        imageId: `${firstImageData.seed}`,
        imageUrl: firstImageData.url
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

    // Construct a detailed prompt for better image generation
    // Start with a base prompt focusing on photorealism and quality
    let basePrompt = includeTextOverlay 
      ? `Photorealistic, high-quality image illustrating the concept of \"${primaryDescription}\".`
      : `Professional lifestyle photography showing ${primaryDescription}. Natural, candid scene captured with professional camera equipment. Real people in authentic environments.`;

    // --- Apply base negative prompt universally ---
    let negativePrompts = "Avoid infographics and text, and disturbing/weird depictions. Naked people, nudity, unrealistic, horror.";

    // --- REMOVE Specific handling for condition-specific keywords ---
    let comparisonInstructions = "";


    let textOverlayPrompt = '';
    let visualInstructions = '';
    if (includeTextOverlay) {
      // Use the cleaned blog title for the overlay if requested
      const textOverlayContent = cleanedTitle;
      textOverlayPrompt = `Overlay the exact text \"${textOverlayContent}\" using white font on a solid black banner placed horizontally across the image. The banner should be opaque.`;
      visualInstructions = `Do not add any other text, diagrams, annotations, or labels. Only the requested text overlay.`;
    } else {
      // If no overlay, guide towards a purely visual, photographic image.
      visualInstructions = `Shot with a professional DSLR camera using natural lighting. Documentary-style photography with authentic subjects and real environments. Composition follows rule of thirds with shallow depth of field. Editorial quality photography suitable for lifestyle magazines.`;
      // Keep minimal negative prompts - focus on positive direction instead
      negativePrompts += " text, words, letters, numbers, writing, infographics, charts, diagrams.";
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
    const result = await generateImage(fullPrompt, negativePrompts, 3);
    if (!result) {
      console.warn('No valid image generated. Returning empty string.');
      return '';
    }
    // We'll skip upscaling since Ideogram API already provides high-res images
    return result.imageUrl;
  } catch (error) {
    console.error('Failed to generate blog image:', error);
    throw error;
  }
}
