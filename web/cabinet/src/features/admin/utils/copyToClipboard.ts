/**
 * Реализация переехала в `@/lib/clipboard` — она нужна и пользовательской части
 * кабинета, где раньше вызывался голый `navigator.clipboard.writeText`.
 * Реэкспорт оставлен, чтобы не трогать импорты в админке.
 */
export { copyToClipboard } from '@/lib/clipboard'
