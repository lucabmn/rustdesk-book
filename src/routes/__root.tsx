import {
  HeadContent,
  Scripts,
  createRootRouteWithContext,
} from '@tanstack/react-router'
import { TanStackRouterDevtoolsPanel } from '@tanstack/react-router-devtools'
import { TanStackDevtools } from '@tanstack/react-devtools'

import TanStackQueryDevtools from '../integrations/tanstack-query/devtools'

import { getLocale } from '#/paraglide/runtime'
import { m } from '#/paraglide/messages'
import { themeInitScript } from '#/lib/theme'
import { LocaleProvider } from '#/lib/i18n'

import appCss from '../styles.css?url'

import type { QueryClient } from '@tanstack/react-query'

interface MyRouterContext {
  queryClient: QueryClient
}

export const Route = createRootRouteWithContext<MyRouterContext>()({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      // `viewport-fit=cover` is what makes `env(safe-area-inset-*)` resolve to
      // anything but zero, so the app can paint under a notch and still keep
      // its controls clear of it.
      {
        name: 'viewport',
        content: 'width=device-width, initial-scale=1, viewport-fit=cover',
      },
      // Colours the browser's own chrome to match each theme's `--canvas`, so
      // the app doesn't sit in a white bar in dark mode. Kept in sync by hand
      // with styles.css — a meta tag can't read a custom property.
      {
        name: 'theme-color',
        media: '(prefers-color-scheme: light)',
        content: '#f9fafb',
      },
      {
        name: 'theme-color',
        media: '(prefers-color-scheme: dark)',
        content: '#111315',
      },
      { title: m.meta_title() },
      { name: 'description', content: m.meta_description() },
    ],
    links: [
      { rel: 'stylesheet', href: appCss },
      { rel: 'icon', href: '/favicon.svg', type: 'image/svg+xml' },
      { rel: 'apple-touch-icon', href: '/icon.svg' },
    ],
  }),
  shellComponent: RootDocument,
})

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang={getLocale()} data-theme="dark">
      <head>
        {/* Applies the stored theme before first paint; the content is a
            module-local constant, never user input.
            biome-ignore lint/security/noDangerouslySetInnerHtml: static, build-time constant */}
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
        <HeadContent />
      </head>
      <body>
        <LocaleProvider>{children}</LocaleProvider>
        <TanStackDevtools
          config={{ position: 'bottom-right' }}
          plugins={[
            {
              name: 'Tanstack Router',
              render: <TanStackRouterDevtoolsPanel />,
            },
            TanStackQueryDevtools,
          ]}
        />
        <Scripts />
      </body>
    </html>
  )
}
