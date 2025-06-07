import { google } from 'googleapis';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const YOUTUBE_API_KEY = process.env.VITE_YOUTUBE_API_KEY;

if (!YOUTUBE_API_KEY) {
  console.error('Error: VITE_YOUTUBE_API_KEY environment variable is not set.');
  // Decide how to handle this: throw error, return default, etc.
  // For scripts, throwing an error might be appropriate to halt execution.
  // throw new Error('Missing VITE_YOUTUBE_API_KEY environment variable.');
}

const youtube = google.youtube({
  version: 'v3',
  auth: YOUTUBE_API_KEY,
});

/**
 * Searches YouTube for the most relevant video based on a query and blog title.
 * Fetches multiple results and performs a basic title keyword check against the blog title.
 * @param query The search query string (generated from content snippet).
 * @param blogTitle The original title of the blog post for keyword validation.
 * @returns The video ID of the first relevant result, or null if no relevant video is found or an error occurs.
 */
export async function findRelevantYouTubeVideo(query: string, blogTitle: string): Promise<string | null> {
  if (!YOUTUBE_API_KEY) {
    console.error("Cannot search YouTube without an API key. No video will be embedded.");
    return null;
  }

  console.log(`Searching YouTube for: "${query}" (Blog Title: "${blogTitle}")`);

  const blogTitleKeywords = blogTitle
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '') // Remove special characters, keep spaces and hyphens
    .split(/\s+/) // Split by spaces
    .map(word => word.replace(/-/g, '')) // Remove hyphens from words for cleaner matching
    .filter(word => word.length > 3 && !['from', 'with', 'that', 'this', 'over', 'what', 'your'].includes(word)); // Filter short/common words
  
  if (blogTitleKeywords.length === 0) {
      console.warn("Blog title too short or generic to extract meaningful keywords for validation. Video matching will be less strict.");
  } else {
      console.log(`Validating results against blog title keywords: ${blogTitleKeywords.join(', ')}`);
  }

  try {
    const searchResponse = await youtube.search.list({
      part: ['snippet'],
      q: query,
      type: ['video'],
      maxResults: 5, 
      videoDuration: 'medium',
      relevanceLanguage: 'en',
      regionCode: 'US',
    });

    const { data } = searchResponse;

    if (data.items && data.items.length > 0) {
        let bestMatch: { videoId: string; score: number; title: string } | null = null;

        for (const item of data.items) {
            const videoId = item.id?.videoId;
            const videoTitle = item.snippet?.title;
            const videoTitleLower = videoTitle?.toLowerCase();

            if (videoId && videoTitle && videoTitleLower) {
                let score = 0;
                if (blogTitleKeywords.length > 0) {
                    blogTitleKeywords.forEach(keyword => {
                        if (videoTitleLower.includes(keyword)) {
                            score++;
                        }
                    });
                } else {
                    score = 1; 
                }

                const queryWords = query.toLowerCase().split(/\s+/).filter(qWord => qWord.length > 3);
                queryWords.forEach(qWord => {
                    if (videoTitleLower.includes(qWord)) {
                        score += 0.5; 
                    }
                });

                console.log(`Video: "${videoTitle}" (ID: ${videoId}), Score: ${score}`);

                if (score > 0 && (!bestMatch || score > bestMatch.score)) {
                    bestMatch = { videoId, score, title: videoTitle };
                }
            }
        }

        if (bestMatch) {
            console.log(`Selected best match YouTube video ID: ${bestMatch.videoId} (Title: "${bestMatch.title}", Score: ${bestMatch.score})`);
            return bestMatch.videoId;
        } else {
            console.warn(`No relevant YouTube video found for query: "${query}" after scoring. No video will be embedded.`);
            return null;
        }
    } else {
      console.log('No YouTube videos found by API for the query. No video will be embedded.');
      return null;
    }
  } catch (error: any) {
    console.error('Error searching YouTube:', error?.response?.data?.error || error.message || error);
    console.error('Due to YouTube search error, no video will be embedded.');
    return null;
  }
}

/**
 * Generates the standard YouTube iframe embed code.
 * @param videoId The YouTube video ID.
 * @returns The HTML iframe embed code string.
 */
export function generateYoutubeEmbedCode(videoId: string): string {
  // Use lightweight embed to reduce JS execution time. The lite-youtube web component
  // defers loading heavy YouTube scripts until user interaction.
  // return `<div class="youtube-video-container">
  //   <lite-youtube videoid="${videoId}"></lite-youtube>
  // </div>`;

  // Return standard YouTube iframe embed code
  return `<div class="youtube-video-container">
    <iframe 
      width="560" 
      height="315" 
      src="https://www.youtube.com/embed/${videoId}" 
      title="YouTube video player" 
      frameborder="0" 
      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" 
      allowfullscreen
    ></iframe>
  </div>`;
}