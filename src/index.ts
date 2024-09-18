require('dotenv').config();
import express, { Response } from 'express';
import { getMetadata } from './lib';
import { checkForCache, createCache } from './lib/cache';
import { APIOutput } from './types';
import morgan from 'morgan';
import cors from 'cors';

const app = express();
app.use(morgan('dev'));

const corsOrigins = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(';')
  : [];

app.use(cors({
  origin: (origin: string | undefined, callback: (error: Error | null, allow?: boolean) => void) => {
    if (!origin || corsOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  }
}));

app.use((req, res, next) => {
  res.set({
    'Cache-Control': 'public'
  });
  next();
});

const port = Number(process.env.PORT || 8080);

if (process.env.REDIS_URL) {
  var rtg = require('url').parse(process.env.REDIS_URL);
  var redis = require('redis').createClient(rtg.port, rtg.hostname);

  redis.auth(rtg.auth.split(':')[1]);
} else {
  var redis = require('redis').createClient();
}

const limiter = require('express-limiter')(app, redis);

limiter({
  path: '/v2',
  method: 'get',
  lookup: ['connection.remoteAddress'],
  total: 300,
  expire: 1000 * 60
});

const sendResponse = (res: Response, output: APIOutput | null) => {
  if (!output) {
    return res
      .status(404)
      .json({ metadata: null });
  }

  return res
    .status(200)
    .json({ metadata: output });
};

app.listen(port, () => {
  console.log(`Server started on port ${port}`);
});

app.use(express.static('public'));

app.get('/', async (req, res) => {
  const url = req.query.url as unknown as string;
  const metadata = await getMetadata(url);
  return res
    .status(200)
    .json({ metadata });
});

app.get('/v2', async (req, res) => {
  try {
    let url = req.query.url as unknown as string;

    if (!url) {
      return res
        .status(400)
        .json({ error: 'Invalid URL' });
    }

    url = url.indexOf('://') === -1 ? 'http://' + url : url;

    const isUrlValid =
      /[(http(s)?):\/\/(www\.)?a-zA-Z0-9@:%._\+~#=]{2,256}\.[a-z]{2,6}\b([-a-zA-Z0-9@:%_\+.~#?&//=]*)/gi.test(
        url
      );

    if (!url || !isUrlValid) {
      return res
        .status(400)
        .json({ error: 'Invalid URL' });
    }

    if (url && isUrlValid) {
      const { hostname } = new URL(url);

      let output: APIOutput;

      // optional - you'll need a supabase key if you want caching. highly recommended.
      const cached = await checkForCache(url);

      if (cached) {
        return res
          .status(200)
          .json({ metadata: cached });
      }

      const metadata = await getMetadata(url);
      if (!metadata) {
        return sendResponse(res, null);
      }
      const { images, og, meta } = metadata!;

      let image = og.image
        ? og.image
        : images.length > 0
          ? images[0].src
          : null;
      const description = og.description
        ? og.description
        : meta.description
          ? meta.description
          : null;
      const title = (og.title ? og.title : meta.title) || '';
      const siteName = og.site_name || '';

      output = {
        title,
        description,
        image,
        siteName,
        hostname
      };

      if (!cached && output) {
        await createCache({
          url: url,
          createdAt: new Date(),
          title: output.title,
          description: output.description,
          image: output.image,
          siteName: output.siteName,
          hostname: output.hostname
        });
      }
      sendResponse(res, output);

    }
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      error:
        'Internal server error. Please open a Github issue or contact me on Twitter @dhaiwat10 if the issue persists.'
    });
  }
});
