import { useEffect, useState } from 'react'

export type Route =
  | { name: 'clash'; search: URLSearchParams }
  | { name: 'railway'; search: URLSearchParams }
  | { name: 'not-found'; path: string }

export type Path = '/' | '/railway'

function trimBase(base: string): string {
  return base.replace(/\/$/, '')
}

export function parseRoute(pathname: string, search: string, base: string = import.meta.env.BASE_URL): Route {
  const prefix = trimBase(base)
  const rel = prefix && pathname.startsWith(prefix) ? pathname.slice(prefix.length) : pathname
  const path = rel.replace(/\/+$/, '') || '/'
  const params = new URLSearchParams(search)
  if (path === '/') return { name: 'clash', search: params }
  if (path === '/railway') return { name: 'railway', search: params }
  return { name: 'not-found', path }
}

export function href(path: Path, search?: URLSearchParams, base: string = import.meta.env.BASE_URL): string {
  const query = search && [...search.keys()].length > 0 ? `?${search.toString()}` : ''
  const prefix = trimBase(base)
  return `${prefix}${path === '/' && prefix ? '/' : path}${query}`
}

/** Push (or replace) a URL and notify every `useRoute` subscriber. */
export function navigate(to: string, replace = false): void {
  if (replace) history.replaceState(null, '', to)
  else history.pushState(null, '', to)
  dispatchEvent(new PopStateEvent('popstate'))
}

export function useRoute(): Route {
  const read = () => parseRoute(location.pathname, location.search)
  const [route, setRoute] = useState<Route>(read)
  useEffect(() => {
    const onChange = () => setRoute(read())
    addEventListener('popstate', onChange)
    return () => removeEventListener('popstate', onChange)
  }, [])
  return route
}

/** Left-click handler for internal links: same-tab navigation without a reload. */
export function onLinkClick(event: { button: number; metaKey: boolean; ctrlKey: boolean; shiftKey: boolean; altKey: boolean; preventDefault(): void; currentTarget: { href: string } }): void {
  if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
  event.preventDefault()
  navigate(new URL(event.currentTarget.href).pathname + new URL(event.currentTarget.href).search)
}
