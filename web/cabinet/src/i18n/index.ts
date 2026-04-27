import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import ru from './ru'
import en from './en'

const STORAGE_KEY = 'cab_lang'

const savedLang = localStorage.getItem(STORAGE_KEY)
const browserLang = navigator.language.split('-')[0]
const defaultLang = savedLang || (browserLang === 'en' ? 'en' : 'ru')

i18n.use(initReactI18next).init({
  resources: {
    ru,
    en,
  },
  lng: defaultLang,
  fallbackLng: 'ru',
  interpolation: {
    escapeValue: false,
  },
})

export function setLanguage(lang: string) {
  i18n.changeLanguage(lang)
  localStorage.setItem(STORAGE_KEY, lang)
}

export { i18n }
export default i18n
