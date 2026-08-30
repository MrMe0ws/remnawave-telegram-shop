/**
 * Строка истории: на телефоне разворачивается вертикально.
 *
 * Ряд «контент слева, статус справа» на 360 точках сжимал текст до
 * нечитаемого обрезка ради девяноста точек под подпись статуса. Ниже sm
 * статус уходит на свою строку во всю ширину — он и отвечает на вопрос
 * «чем всё кончилось», а контенту достаётся вся ширина карточки.
 */
export const PARTNER_MOBILE_ROW =
  'flex flex-col items-start gap-2 px-3 py-2.5 sm:flex-row sm:items-start sm:justify-between sm:gap-3'

export const PARTNER_MOBILE_BADGE =
  'w-full justify-center rounded-lg py-1.5 sm:w-auto sm:justify-start sm:rounded-full sm:py-0.5'
