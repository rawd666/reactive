import { useEffect } from "react";

// Per-page SEO tags for a client-rendered SPA. There is no react-helmet here:
// this hook updates the tags that already exist in index.html (by selector) so
// each route ends up with exactly one <title>, description, canonical, etc.
// Google renders JS and picks these up on the crawl; non-JS scrapers fall back
// to the defaults baked into index.html.

const SITE_NAME = "Reactive";
export const BASE_URL = "https://reactiveweb.dev";
const DEFAULT_IMAGE = `${BASE_URL}/og-image.png`;
const DEFAULT_TITLE = `${SITE_NAME} — Custom React Websites for Small Businesses`;

function upsert(selector, tagName, attrs) {
  let el = document.head.querySelector(selector);
  if (!el) {
    el = document.createElement(tagName);
    document.head.appendChild(el);
  }
  for (const [key, value] of Object.entries(attrs)) {
    if (value == null) el.removeAttribute(key);
    else el.setAttribute(key, value);
  }
}

function Seo({ title, description, path = "", image = DEFAULT_IMAGE, noindex = false }) {
  const fullTitle = title ? `${title} | ${SITE_NAME}` : DEFAULT_TITLE;
  const url = `${BASE_URL}${path}`;

  useEffect(() => {
    document.title = fullTitle;

    upsert('meta[name="description"]', "meta", { name: "description", content: description });
    upsert('meta[name="robots"]', "meta", {
      name: "robots",
      content: noindex ? "noindex, nofollow" : "index, follow, max-image-preview:large",
    });
    upsert('link[rel="canonical"]', "link", { rel: "canonical", href: url });

    upsert('meta[property="og:type"]', "meta", { property: "og:type", content: "website" });
    upsert('meta[property="og:title"]', "meta", { property: "og:title", content: fullTitle });
    upsert('meta[property="og:description"]', "meta", { property: "og:description", content: description });
    upsert('meta[property="og:url"]', "meta", { property: "og:url", content: url });
    upsert('meta[property="og:image"]', "meta", { property: "og:image", content: image });

    upsert('meta[name="twitter:title"]', "meta", { name: "twitter:title", content: fullTitle });
    upsert('meta[name="twitter:description"]', "meta", { name: "twitter:description", content: description });
    upsert('meta[name="twitter:image"]', "meta", { name: "twitter:image", content: image });
  }, [fullTitle, description, url, image, noindex]);

  return null;
}

export default Seo;
