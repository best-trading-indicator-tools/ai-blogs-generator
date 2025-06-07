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
*   `generate-inline-blog-images.ts`: Generates inline images for blog posts by detecting placeholders in blog content and creating images using the Ideogram API.
*   `optimize-existing-blog-images.js`: Optimizes all existing blog images and updates blog post JSON files to reference the optimized versions.

## Getting Started

Before running any scripts or starting development, install all required dependencies by running:

```
npm install
```

(User: Please add instructions here if you want to specify how to set up and run the project, e.g., environment variables, API keys needed, and common script commands from `package.json` like `npm run daily-blog` or `npm run full-blog-generation`.)

### Environment Setup

You must create a `.env` file at the root of the project. This file should contain all required environment variables for the project to function. (The specific variables required depend on the scripts and integrations you use, such as API keys for Google or OpenAI. Please refer to the documentation for each script or integration to determine the exact variables needed.)

A template file named `.env_model` is provided. Update this file with your own API keys and settings, then rename it to `.env` at the root of the project.

## Script Commands

Below is an explanation of each command in the `package.json` and how to run them. To run any command, use:

```
npm run <script-name>
```

Replace `<script-name>` with the name of the script you want to execute.

| Script Name                      | Command/Script                                      | What It Does                                                                                   |
|----------------------------------|-----------------------------------------------------|------------------------------------------------------------------------------------------------|
| dev                              | vite                                                | Starts the Vite development server for local development.                                      |
| build                            | vite build                                          | Builds the project for production using Vite.                                                  |
| lint                             | eslint .                                            | Runs ESLint to check for code quality and style issues.                                        |
| preview                          | vite preview                                        | Serves the production build locally for previewing.                                            |
| generate:blog-images             | tsx scripts/generate-blog-images.ts                 | Runs the script to generate blog images.                                                       |
| generate:inline-images           | tsx scripts/generate-inline-blog-images.ts          | Runs the script to generate inline images for blog posts.                                      |
| test:image-generation            | tsx scripts/test-image-generation.ts                | Runs tests for image generation functionality.                                                 |
| generate:topics                  | tsx scripts/topic-generator.ts                      | Runs the script to generate blog post topics.                                                  |
| daily-blog                       | tsx scripts/daily-blog-generation.ts                | Automates the creation of blog posts on a daily basis.                                         |
| full-blog-generation             | bash scripts/generate-full-blogs.sh                 | Runs a shell script to generate complete blog articles.                                        |
| optimize:existing-blog-images    | node scripts/optimize-existing-blog-images.js       | Optimizes existing blog images.                                                                |
| optimize-and-generate            | npm run optimize:existing-blog-images && npm run full-blog-generation 1 | Optimizes existing images, then generates full blogs.                                          |
| optimize-images                  | tsx scripts/optimize-images.js                      | Optimizes image files (likely new or all images).                                              |

**How to run a script:**

For example, to generate blog images:

```
npm run generate:blog-images
```

Or to start the development server:

```
npm run dev
```

## Utility Modules Overview

The `src/utils/` directory contains utility modules used throughout the project:

*   `aiBlogGenerator.ts`: Generates full blog content using the Anthropic Claude API, manages internal linking, and handles looksmaxxing keyword detection.
*   `aiTextGenerator.ts`: Generates catchy text overlays for blog images and AI-generated blog titles using the Anthropic Claude API.
*   `youtubeApi.ts`: Finds relevant YouTube videos for embedding in blog posts using the YouTube Data API.
*   `ideogramApi.ts`: Interfaces with the Ideogram API to generate and upscale blog images for use in posts.

This `README.md` provides a high-level overview of the AI Blog Generation project based on the repository structure and file names. 