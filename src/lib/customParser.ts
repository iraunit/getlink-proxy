import axios, { AxiosRequestConfig } from 'axios';
import puppeteer from 'puppeteer';
import { JSDOM } from 'jsdom';
import { MetaResult } from '../types';

interface Meta {
  [key: string]: string;
}

interface ParsedData {
  metadata: {
    meta: Meta;
    og: Meta;
    images: { src: string }[];
  };
}

const readMT = (el: Element, name: string) => {
  return el.getAttribute('property') === name || el.getAttribute('name') === name
    ? el.getAttribute('content')
    : null;
};

// Use Puppeteer for JavaScript-rendered content
const fetchWithPuppeteer = async (url: string): Promise<ParsedData> => {
  const browser = await puppeteer.launch();
  try {
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: 'networkidle2' });

    const data = await page.evaluate(() => {
      const meta: Meta = {}, og: Meta = {}, images: { src: string }[] = [];

      // Fetch standard meta tags
      const title = document.querySelector('title');
      if (title) meta.title = title.innerText;

      const description = document.querySelector('meta[name="description"]');
      if (description) meta.description = description.getAttribute('content') || '';

      const metas = document.querySelectorAll('meta');
      metas.forEach((el) => {
        ['og:title', 'og:description', 'og:image'].forEach((s) => {
          const val = el.getAttribute('content');
          if (val && el.getAttribute('property') === s) {
            og[s.split(':')[1]] = val;
          }
        });
      });

      // Fetch all image sources
      document.querySelectorAll('img').forEach((img) => {
        const src = img.getAttribute('src');
        if (src) {
          images.push({ src: new URL(src, document.baseURI).href });
        }
      });

      return { meta, og, images };
    });

    return { metadata: data };
  } catch (error) {
    console.log('Puppeteer failed:', error);
    return { metadata: { meta: {}, og: {}, images: [] } };
  } finally {
    await browser.close();
  }
};

// Use axios for static HTML
const fetchWithAxios = async (url: string, config?: AxiosRequestConfig): Promise<ParsedData> => {
  const { data } = await axios.get(url, config);
  const dom = new JSDOM(data);
  const $ = dom.window.document;
  const og: Meta = {}, meta: Meta = {}, images: { src: string }[] = [];

  const title = $.querySelector('title');
  if (title) meta.title = title.textContent || '';

  const description = $.querySelector('meta[name="description"]');
  if (description) meta.description = description.getAttribute('content') || '';

  const metas = $.querySelectorAll('meta');
  metas.forEach((el) => {
    ['og:title', 'og:description', 'og:image'].forEach((s) => {
      const val = readMT(el, s);
      if (val) og[s.split(':')[1]] = val;
    });
  });

  // Fetch images
  $.querySelectorAll('img').forEach((el) => {
    let src: string | null = el.getAttribute('src');
    if (src) {
      src = new URL(src, url).href;
      images.push({ src });
    }
  });

  return { metadata: { meta, og, images } };
};

// Main function to parse URL
const customParserParsedData = async (url: string, config?: AxiosRequestConfig): Promise<ParsedData> => {
  if (!/^https?:\/\/[^\s$.?#].[^\s]*$/i.test(url)) {
    return { metadata: { meta: {}, og: {}, images: [] } };
  }

  try {
    // Try axios first
    const data = await fetchWithAxios(url, config);
    if (data.metadata.meta && Object.keys(data.metadata.meta).length > 0) {
      return data; // Return if static metadata is available
    }
  } catch (err) {
    console.log('Axios failed, attempting Puppeteer:', err);
  }

  // If axios fails or no meta found, fall back to Puppeteer for JS-rendered content
  return await fetchWithPuppeteer(url);
};

const customparserMetaResult = async (url: string, config?: AxiosRequestConfig): Promise<MetaResult> => {
  if (!/^https?:\/\/[^\s$.?#].[^\s]*$/i.test(url)) {
    return { meta: {}, og: {}, images: [] };
  }

  try {
    const data = await fetchWithAxios(url, config);
    if (data.metadata.meta && Object.keys(data.metadata.meta).length > 0) {
      return formatMetadata(data.metadata);
    }
  } catch (err) {
    console.log('Axios failed, attempting Puppeteer:', err);
  }

  const puppeteerData = await fetchWithPuppeteer(url);
  return formatMetadata(puppeteerData.metadata);
};

const formatMetadata = (data: ParsedData['metadata']): MetaResult => {
  return {
    images: data.images,
    meta: {
      description: data.meta.description,
      title: data.meta.title
    },
    og: {
      image: data.og.image,
      description: data.og.description,
      title: data.og.title,
      site_name: data.og.site_name,
      type: data.og.type,
      url: data.og.url
    }
  };
};


export { customparserMetaResult, customParserParsedData };