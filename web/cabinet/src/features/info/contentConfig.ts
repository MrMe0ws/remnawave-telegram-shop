import { useQuery } from '@tanstack/react-query'

export type ContentLink = {
  label: string
  link_key: string
}

export type InfoTab = {
  id: 'faq' | 'documents' | 'status' | 'useful_links'
  label: string
}

export type FAQItem = {
  id: string
  question: string
  answer_md: string
  link_key?: string
}

export type CabinetContentConfig = {
  support: {
    title: string
    description: string
    primary_button: string
    extra_links: ContentLink[]
  }
  info: {
    title: string
    tabs: InfoTab[]
    documents: ContentLink[]
    useful_links: ContentLink[]
    status: {
      title: string
      description: string
      button: string
    }
  }
  faq: FAQItem[]
}

async function fetchCabinetContent(): Promise<CabinetContentConfig> {
  const res = await fetch('/cabinet/api/content/faq', {
    method: 'GET',
    cache: 'no-store',
    headers: { Accept: 'application/json' },
  })
  if (res.ok) {
    return res.json() as Promise<CabinetContentConfig>
  }
  // Fallback для старых окружений/локальной сборки без нового API-роута.
  const fallback = await fetch('/translations/cabinet/FAQ.json', {
    method: 'GET',
    cache: 'no-store',
    headers: { Accept: 'application/json' },
  })
  if (!fallback.ok) {
    throw new Error(`content config load failed: ${res.status}/${fallback.status}`)
  }
  return fallback.json() as Promise<CabinetContentConfig>
}

export function useCabinetContentConfig() {
  return useQuery({
    queryKey: ['cabinet-content-config'],
    queryFn: fetchCabinetContent,
    staleTime: 120_000,
    retry: 1,
  })
}
