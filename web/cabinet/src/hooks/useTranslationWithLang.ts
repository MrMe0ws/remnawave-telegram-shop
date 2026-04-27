import { useTranslation } from 'react-i18next'

/** Хук-хелпер: возвращает t() + текущий язык (для форматирования дат). */
export function useTranslationWithLang() {
  const { t, i18n } = useTranslation()
  return { t, lang: i18n.language }
}
