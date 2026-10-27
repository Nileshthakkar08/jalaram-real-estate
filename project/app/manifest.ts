import type { MetadataRoute } from 'next';

/** Lets the site be added to the home screen — required for web notifications on iPhone/iPad. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Jalaram Real Estate',
    short_name: 'Jalaram',
    description: 'Homes for sale and rent in Ahmedabad.',
    start_url: '/',
    display: 'standalone',
    background_color: '#FAF8F5',
    theme_color: '#173C32',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
  };
}
