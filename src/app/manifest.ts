import type { MetadataRoute } from 'next';
import { SITE_DESCRIPTION, SITE_NAME, SITE_TAGLINE } from '@/server/seo';

/** Installable on a phone's home screen, in the app's own colours. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${SITE_NAME} · ${SITE_TAGLINE}`,
    short_name: SITE_NAME,
    description: SITE_DESCRIPTION,
    start_url: '/',
    display: 'standalone',
    background_color: '#040507',
    theme_color: '#040507',
    icons: [
      { src: '/icon.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/brand/peregrine-256.png', sizes: '256x256', type: 'image/png', purpose: 'any' },
    ],
  };
}
