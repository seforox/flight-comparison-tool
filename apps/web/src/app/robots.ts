import type { MetadataRoute } from 'next';

export const dynamic = 'force-dynamic';

export default function robots(): MetadataRoute.Robots {
  const blockSearchEngines =
    process.env.BLOCK_SEARCH_ENGINES === 'true' ||
    (process.env.BLOCK_SEARCH_ENGINES !== 'false' &&
      process.env.PRIVATE_ACCESS_ENABLED === 'true');

  if (blockSearchEngines) {
    return {
      rules: {
        userAgent: '*',
        disallow: '/',
      },
    };
  }

  return {
    rules: {
      userAgent: '*',
      allow: '/',
    },
  };
}
