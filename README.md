# AI Blog Generation Project

This project is a comprehensive toolset for automating the generation of blog content. It leverages AI and various web technologies to streamline the process from topic ideation to publishing full blog posts.

## Core Features

The primary capabilities of this project include:

*   **Topic Generation**: Scripts like `topic-generator.ts` and `enhanced-topic-generator.ts` suggest and develop blog post topics.
*   **Keyword Analysis**: Utilizes `keyword-trend-discovery.ts` (likely integrating with services like Google Trends via `google-trends-api`) to identify relevant and trending keywords for content optimization.
*   **Content Generation**:
    *   Automated generation of full blog posts, as indicated by `generate-full-blogs.sh` and `daily-blog-generation.ts`.
    *   Likely supports Markdown (`marked` dependency).
*   **Image Management**:
    *   Generation of blog images (`generate-blog-images.ts`) and inline images (`generate-inline-blog-images.ts`).
    *   Optimization of images (`optimize-images.js`, `optimize-existing-blog-images.js`), possibly using `sharp`.
*   **Automation & Scheduling**: Capabilities for daily blog generation (`daily-blog-generation.ts`), suggesting an automated content pipeline.
*   **SEO & Indexing**:
    *   Manages `sitemap.xml` for search engine visibility.
    *   Includes `llms.txt`, potentially to guide AI crawlers.
    *   A script `rebuild-index.js` suggests functionality related to updating search indexes or site data.

## Technical Stack

The project appears to be built with:

*   **Backend/Scripting**: Node.js and TypeScript (`.ts` files, `tsx` script runner).
*   **Frontend**: Vite, React, and Tailwind CSS (though the primary focus of this README is the generation toolset).
*   **APIs & Services**: Likely integrates with Google APIs (`googleapis`) for data like trends and potentially other AI services for content/image generation.

## Scripts Overview

The `scripts/` directory contains the core logic for the blog generation process. Key scripts include:

*   `daily-blog-generation.ts`: Automates the creation of blog posts on a daily basis.
*   `enhanced-topic-generator.ts`: Advanced topic ideation and development.
*   `generate-blog-images.ts`: Creates images for blog posts.
*   `generate-full-blogs.sh`: A shell script orchestrating the generation of complete blog articles.
*   `keyword-trend-discovery.ts`: Discovers trending keywords.
*   `optimize-images.js`: Optimizes image files.
*   `rebuild-index.js`: Potentially updates a search index or site map.
*   `topic-generator.ts`: Generates blog post topics.

## Getting Started

(User: Please add instructions here if you want to specify how to set up and run the project, e.g., environment variables, API keys needed, and common script commands from `package.json` like `npm run daily-blog` or `npm run full-blog-generation`.)

This `README.md` provides a high-level overview of the AI Blog Generation project based on the repository structure and file names. 