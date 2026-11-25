<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://ai.google.dev/static/site-assets/images/share-ais-513315318.png" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/941ae923-77ab-4cd2-8e88-32a2906441e6

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

## ImageKit image uploads

New cover and gallery uploads are sent to the server-side `POST /api/upload` endpoint. The server uploads the image to ImageKit and returns the hosted URL; the ImageKit private key is never included in browser code.

Configure the following server-side secret in the deployment environment (Google AI Studio / Cloud Run Secrets):

- `IMAGEKIT_PRIVATE_KEY`: the active ImageKit **Private Key**. Do not put it in `VITE_*` variables, source files, or the browser.

The ImageKit URL endpoint for this account is `https://ik.imagekit.io/nbti6i8nh4`. The endpoint currently returns ImageKit's hosted URL directly, so no public key is needed for server-side uploads.

Uploads require the authenticated platform admin session, accept PNG/JPG/WebP/GIF, and are limited to 5 MB. Files are organized under `/vyrn/covers` and `/vyrn/gallery` in ImageKit. Existing content records and their image URLs are not migrated or modified by this change.
