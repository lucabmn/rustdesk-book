import { DropdownMenu } from 'radix-ui'

import { cn } from '#/lib/utils'

/** Dropdown menu with the app's popover surface. Thin wrapper over Radix. */

export const Menu = DropdownMenu.Root
export const MenuTrigger = DropdownMenu.Trigger

export function MenuContent({
  align = 'end',
  sideOffset = 6,
  className,
  children,
}: {
  align?: 'start' | 'center' | 'end'
  sideOffset?: number
  className?: string
  children: React.ReactNode
}) {
  return (
    <DropdownMenu.Portal>
      <DropdownMenu.Content
        align={align}
        sideOffset={sideOffset}
        className={cn(
          'z-70 min-w-48 rounded-lg border border-line bg-elevated p-1 shadow-pop',
          'data-[state=closed]:animate-out data-[state=open]:animate-in data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95',
          className,
        )}
      >
        {children}
      </DropdownMenu.Content>
    </DropdownMenu.Portal>
  )
}

export function MenuItem({
  destructive,
  className,
  ...props
}: React.ComponentProps<'button'> & { destructive?: boolean }) {
  return (
    <DropdownMenu.Item asChild>
      <button
        type="button"
        className={cn(
          'flex w-full cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-left text-text text-xs outline-none transition-colors',
          'data-[highlighted]:bg-hover [&_svg]:size-3.5 [&_svg]:text-faint',
          destructive &&
            'text-danger data-[highlighted]:bg-danger-soft [&_svg]:text-danger',
          className,
        )}
        {...props}
      />
    </DropdownMenu.Item>
  )
}

export function MenuSeparator() {
  return <DropdownMenu.Separator className="-mx-1 my-1 h-px bg-line" />
}

/** Non-interactive header inside a menu, e.g. the signed-in account. */
export function MenuLabel({ children }: { children: React.ReactNode }) {
  return <div className="px-2 py-1.5">{children}</div>
}
