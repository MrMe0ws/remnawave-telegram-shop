import { useTranslation } from 'react-i18next'
import { AlertTriangle } from 'lucide-react'

import { detectUnsupportedMarkdown } from '../utils/telegramMarkup'
import { TelegramHtmlEditor, type TelegramHtmlCommand } from './TelegramHtmlEditor'

interface Props {
  value: string
  onChange: (value: string) => void
  /** Меняется при открытии другого тарифа — поле перечитывает значение. */
  resetKey: number
  placeholder?: string
}

/**
 * Описание тарифа: одно поле, в котором сразу видно итоговый вид.
 *
 * Раньше здесь стояли два окна рядом — textarea с тегами и предпросмотр под
 * ней. Приходилось держать в голове соответствие между `<b>Тариф</b>` слева и
 * жирной строкой справа, а на узком экране предпросмотр уезжал под форму, и
 * смысл его терялся вовсе.
 *
 * Формат описания — HTML Telegram: тот же текст уходит в бот с
 * parse_mode=HTML, поэтому редактор здесь ровно тот же, что у рассылки
 * (см. TelegramHtmlEditor). Разметку кабинет рендерит через ReactMarkdown,
 * который эти теги тоже понимает, — см. TariffDescription.
 */
/*
 * Набор инструментов урезан.
 *
 * Описание кабинет рендерит через ReactMarkdown с санитайзером (см.
 * TariffDescription), и часть тегов Telegram до пользователя не доезжает:
 * подчёркивание, моноширинный, скрытый текст и сворачиваемая цитата остаются
 * обычным текстом. Кнопка, которая по нажатию ничего не меняет, хуже
 * отсутствующей — она выглядит как поломка.
 */
const TARIFF_TOOLS: TelegramHtmlCommand[] = ['bold', 'italic', 'strikeThrough', 'quote', 'link', 'clear']

export function TariffDescriptionEditor({ value, onChange, resetKey, placeholder }: Props) {
  const { t } = useTranslation()

  /*
   * Markdown в описании остаётся ловушкой: `**жирный**` кабинет отрисует
   * жирным (там ReactMarkdown), а в Telegram придёт звёздочками как есть.
   * Редактор такого не создаёт, но текст часто вставляют из заметок.
   */
  const unsupported = detectUnsupportedMarkdown(value)

  return (
    <div className="overflow-hidden rounded-lg border border-border/60 bg-card">
      <TelegramHtmlEditor
        initialHtml={value}
        resetKey={resetKey}
        onChange={onChange}
        tools={TARIFF_TOOLS}
        placeholder={placeholder ?? t('admin.tariffs.descriptionSource')}
        className="min-h-[120px]"
      />

      {unsupported.length > 0 && (
        <p className="flex items-start gap-2 border-t border-border/60 px-3 py-2 text-[11px] leading-relaxed text-amber-600 dark:text-amber-400">
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
          <span>
            {t('admin.tariffs.markup.unsupportedWarning', {
              items: unsupported.map((id) => t(`admin.tariffs.markup.unsupported.${id}`)).join(', '),
            })}
          </span>
        </p>
      )}
    </div>
  )
}
