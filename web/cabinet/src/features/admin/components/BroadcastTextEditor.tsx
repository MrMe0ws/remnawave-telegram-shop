import { useRef } from 'react'
import { Bold, Italic, Quote, Code, Link2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'

interface BroadcastTextEditorProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
}

function wrapSelection(
  textareaRef: React.RefObject<HTMLTextAreaElement | null>,
  before: string,
  after: string,
  onChange: (value: string) => void,
) {
  const textarea = textareaRef.current
  if (!textarea) return

  const start = textarea.selectionStart
  const end = textarea.selectionEnd
  const selectedText = textarea.value.substring(start, end)
  const before_text = textarea.value.substring(0, start)
  const after_text = textarea.value.substring(end)

  const newText = before_text + before + selectedText + after + after_text
  onChange(newText)

  setTimeout(() => {
    textarea.focus()
    textarea.setSelectionRange(start + before.length, end + before.length)
  }, 0)
}

export function BroadcastTextEditor({ value, onChange, placeholder }: BroadcastTextEditorProps) {
  const { t } = useTranslation()
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const formatters = [
    {
      id: 'bold',
      icon: Bold,
      label: t('admin.broadcast.editor.bold'),
      before: '<b>',
      after: '</b>',
    },
    {
      id: 'italic',
      icon: Italic,
      label: t('admin.broadcast.editor.italic'),
      before: '<i>',
      after: '</i>',
    },
    {
      id: 'code',
      icon: Code,
      label: t('admin.broadcast.editor.code'),
      before: '<code>',
      after: '</code>',
    },
    {
      id: 'quote',
      icon: Quote,
      label: t('admin.broadcast.editor.quote'),
      before: '<blockquote>',
      after: '</blockquote>',
    },
  ]

  const handleLink = () => {
    const url = prompt(t('admin.broadcast.editor.enterUrl') || 'Enter URL:')
    if (url) {
      wrapSelection(textareaRef, `<a href="${url}">`, '</a>', onChange)
    }
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        {formatters.map(({ id, icon: Icon, label, before, after }) => (
          <button
            key={id}
            type="button"
            onClick={() => wrapSelection(textareaRef, before, after, onChange)}
            title={label}
            className="rounded-md border border-border p-2 text-muted-foreground transition-colors hover:border-primary hover:bg-accent hover:text-primary"
            aria-label={label}
          >
            <Icon className="size-4" />
          </button>
        ))}
        <button
          type="button"
          onClick={handleLink}
          title={t('admin.broadcast.editor.link')}
          className="rounded-md border border-border p-2 text-muted-foreground transition-colors hover:border-primary hover:bg-accent hover:text-primary"
          aria-label={t('admin.broadcast.editor.link')}
        >
          <Link2 className="size-4" />
        </button>
      </div>
      <textarea
        ref={textareaRef}
        className="w-full resize-y rounded-md border border-border bg-background p-3 text-sm focus:border-primary focus:outline-none"
        rows={5}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      <p className="mt-2 text-xs text-muted-foreground">
        {t('admin.broadcast.editor.telegramHTML')}
      </p>
    </div>
  )
}
