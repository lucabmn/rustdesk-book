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
import { PWA_HEAD_LINKS, PWA_HEAD_META } from '#/lib/pwa'
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
      // No `theme-color` here on purpose: the app's theme comes from
      // `data-theme`, not the OS, so the tag is written by `themeInitScript`
      // below from the same source of truth and updated by `applyTheme`.
      { title: m.meta_title() },
      { name: 'description', content: m.meta_description() },
      ...PWA_HEAD_META,
    ],
    links: [
      { rel: 'stylesheet', href: appCss },
      { rel: 'icon', href: '/favicon.svg', type: 'image/svg+xml' },
      ...PWA_HEAD_LINKS,
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
