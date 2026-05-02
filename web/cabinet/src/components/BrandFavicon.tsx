import { useEffect } from 'react'
import { useAuthBootstrap } from '@/hooks/useAuthBootstrap'

const defaultHref = '/cabinet/favicon.svg'

function faviconType(href: string): string {
  const path = href.split('?')[0].toLowerCase()
  if (path.endsWith('.svg')) return 'image/svg+xml'
  if (path.endsWith('.png')) return 'image/png'
  if (path.endsWith('.jpg') || path.endsWith('.jpeg')) return 'image/jpeg'
  if (path.endsWith('.webp')) return 'image/webp'
  if (path.endsWith('.ico')) return 'image/x-icon'
  // /cabinet/api/public/brand-logo без расширения — сервер отдаёт image/png и т.д.
  if (path.includes('brand-logo')) return 'image/png'
  return 'image/png'
}

/** Подменяет rel=icon и заголовок вкладки из bootstrap (логотип + имя бренда с бэкенда). */
export function BrandFavicon() {
  const { data } = useAuthBootstrap()
  const href = (data?.brand_logo_url?.trim() || defaultHref).trim() || defaultHref
  const rawName = data?.brand_name?.trim()

  useEffect(() => {
    let link = document.querySelector<HTMLLinkElement>('link[rel="icon"]')
    if (!link) {
      link = document.createElement('link')
      link.rel = 'icon'
      document.head.appendChild(link)
    }
    link.href = href
    link.type = faviconType(href)
  }, [href])

  useEffect(() => {
    // Совпадает с <title> в index.html, пока бэкенд не отдал имя; API по умолчанию шлёт "Cabinet".
    if (!rawName || rawName === 'Cabinet') {
      document.title = 'Кабинет'
    } else {
      document.title = rawName
    }
  }, [rawName])

  return null
}
