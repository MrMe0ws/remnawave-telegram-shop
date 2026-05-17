import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import bundledRu from './ru.json'
import bundledEn from './en.json'

const STORAGE_KEY = 'cab_lang'
const SUPPORTED_LANGS = ['ru', 'en'] as const

type Lang = (typeof SUPPORTED_LANGS)[number]
type I18nBundle = { translation: Record<string, unknown> }

const bundled: Record<Lang, I18nBundle> = {
  ru: bundledRu as I18nBundle,
  en: bundledEn as I18nBundle,
}

function resolveDefaultLang(): Lang {
  const savedLang = localStorage.getItem(STORAGE_KEY)
  if (savedLang === 'en' || savedLang === 'ru') {
    return savedLang
  }
  const browserLang = navigator.language.split('-')[0]
  return browserLang === 'en' ? 'en' : 'ru'
}

async function fetchRuntimeBundle(lang: Lang): Promise<I18nBundle | null> {
  try {
    const res = await fetch(`/cabinet/api/content/i18n/${lang}`, {
      method: 'GET',
      cache: 'no-store',
      headers: { Accept: 'application/json' },
    })
    if (!res.ok) {
      return null
    }
    return (await res.json()) as I18nBundle
  } catch {
    return null
  }
}

async function loadResources(): Promise<Record<Lang, I18nBundle>> {
  const resources = { ...bundled }
  await Promise.all(
    SUPPORTED_LANGS.map(async (lang) => {
      const runtime = await fetchRuntimeBundle(lang)
      if (runtime?.translation) {
        resources[lang] = runtime
      }
    }),
  )
  return resources
}

export async function initCabinetI18n(): Promise<typeof i18n> {
  const defaultLang = resolveDefaultLang()
  const resources = await loadResources()

  await i18n.use(initReactI18next).init({
    resources,
    lng: defaultLang,
    fallbackLng: 'ru',
    interpolation: {
      escapeValue: false,
    },
  })

  return i18n
}

export function setLanguage(lang: string) {
  i18n.changeLanguage(lang)
  localStorage.setItem(STORAGE_KEY, lang)
}

export { i18n }
export default i18n
