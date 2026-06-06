import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { Loader2, Send, X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { SupportMessageDTO } from '@/lib/api'
import { useSupportChat } from '@/features/support/useSupportChat'
import { SupportAvatar } from '@/features/support/SupportAvatar'
import { ensureSupportChatAudio, playSupportReplyChime } from '@/features/support/supportChatAudio'

const MODAL_Z = 2500

function inMessageBubbleClass(status?: SupportMessageDTO['delivery_status']): string {
  switch (status) {
    case 'sent':
      return 'bg-emerald-600 text-white dark:bg-emerald-600 dark:text-white'
    case 'failed':
      return 'bg-destructive text-destructive-foreground'
    default:
      return 'bg-primary text-primary-foreground'
  }
}

type SupportChatModalProps = {
  open: boolean
  enabled: boolean
  onClose: () => void
}

function formatDayLabel(iso: string, todayLabel: string, yesterdayLabel: string): string {
  const d = new Date(iso)
  const now = new Date()
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const startMsg = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  const diffDays = Math.round((startToday.getTime() - startMsg.getTime()) / 86_400_000)
  if (diffDays === 0) return todayLabel
  if (diffDays === 1) return yesterdayLabel
  return d.toLocaleDateString()
}

function groupByDay(messages: SupportMessageDTO[], todayLabel: string, yesterdayLabel: string) {
  const groups: { day: string; items: SupportMessageDTO[] }[] = []
  for (const m of messages) {
    const day = formatDayLabel(m.created_at, todayLabel, yesterdayLabel)
    const last = groups[groups.length - 1]
    if (last?.day === day) last.items.push(m)
    else groups.push({ day, items: [m] })
  }
  return groups
}

export function SupportChatModal({ open, enabled, onClose }: SupportChatModalProps) {
  const { t } = useTranslation()
  const [text, setText] = useState('')
  const [entered, setEntered] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const lastOutMsgIdRef = useRef(0)
  const { conversation, sendMutation, markReadMutation } = useSupportChat(enabled, open)

  useEffect(() => {
    if (!open) {
      setEntered(false)
      return
    }
    const id = window.requestAnimationFrame(() => setEntered(true))
    return () => window.cancelAnimationFrame(id)
  }, [open])

  useEffect(() => {
    if (!open || typeof document === 'undefined') return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [open])

  useEffect(() => {
    if (!open || !enabled) return
    if ((conversation.data?.unread_count ?? 0) <= 0) return
    void markReadMutation.mutate()
  }, [open, enabled, conversation.data?.unread_count])

  useEffect(() => {
    if (!open) {
      lastOutMsgIdRef.current = 0
      return
    }
    const msgs = conversation.data?.messages ?? []
    const maxOutId = msgs.filter((m) => m.direction === 'out').reduce((max, m) => Math.max(max, m.id), 0)
    if (maxOutId === 0) {
      return
    }
    if (lastOutMsgIdRef.current === 0) {
      lastOutMsgIdRef.current = maxOutId
      return
    }
    if (maxOutId > lastOutMsgIdRef.current) {
      void ensureSupportChatAudio().then((ctx) => {
        if (ctx) playSupportReplyChime(ctx)
      })
    }
    lastOutMsgIdRef.current = maxOutId
  }, [open, conversation.data?.messages])

  useEffect(() => {
    if (!open) return
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [open, conversation.data?.messages.length])

  const messages = conversation.data?.messages ?? []
  const lastMessage = messages[messages.length - 1]
  const waitingForSupport =
    Boolean(lastMessage?.direction === 'in' && lastMessage.delivery_status === 'sent')

  const groups = useMemo(
    () => groupByDay(conversation.data?.messages ?? [], t('supportChat.today'), t('supportChat.yesterday')),
    [conversation.data?.messages, t],
  )

  async function handleSend() {
    const value = text.trim()
    if (!value || sendMutation.isPending) return
    setText('')
    try {
      await sendMutation.mutateAsync(value)
    } catch {
      setText(value)
    }
  }

  if (!open || !enabled) return null
  if (typeof document === 'undefined') return null

  return createPortal(
    <div
      className="fixed inset-0 flex flex-col justify-end md:items-center md:justify-center md:p-6"
      style={{ zIndex: MODAL_Z }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="support-chat-title"
    >
      <button
        type="button"
        className="absolute inset-0 bg-neutral-950/65 backdrop-blur-sm"
        aria-label={t('common.close')}
        onClick={onClose}
      />
      <div
        className={cn(
          'relative z-[1] flex w-full max-h-[min(88dvh,640px)] flex-col border border-border bg-card shadow-2xl transition-[transform,opacity] duration-300 ease-out md:max-h-[min(720px,90vh)] md:w-full md:max-w-md md:rounded-2xl',
          'rounded-t-3xl pb-[max(0px,env(safe-area-inset-bottom))]',
          entered ? 'translate-y-0 opacity-100 md:scale-100' : 'translate-y-full opacity-95 md:translate-y-2 md:scale-[0.97] md:opacity-0',
        )}
      >
        <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
          <div className="min-w-0">
            <h2 id="support-chat-title" className="text-base font-semibold">
              {t('supportChat.title')}
            </h2>
            {waitingForSupport ? (
              <p className="text-xs text-muted-foreground">{t('supportChat.waitingHint')}</p>
            ) : null}
          </div>
          <Button type="button" variant="ghost" size="icon" className="size-9 shrink-0" onClick={onClose} aria-label={t('common.close')}>
            <X className="size-4" />
          </Button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
          {conversation.isLoading ? (
            <p className="py-8 text-center text-sm text-muted-foreground">{t('common.loading')}</p>
          ) : groups.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">{t('supportChat.emptyHint')}</p>
          ) : (
            <div className="space-y-4">
              {groups.map((g) => (
                <div key={g.day} className="space-y-3">
                  <div className="flex items-center gap-2 px-1">
                    <div className="h-px flex-1 bg-border" />
                    <span className="text-[11px] text-muted-foreground">{g.day}</span>
                    <div className="h-px flex-1 bg-border" />
                  </div>
                  {g.items.map((m) =>
                    m.direction === 'out' ? (
                      <div key={m.id} className="flex gap-2">
                        <SupportAvatar />
                        <div className="min-w-0 max-w-[85%]">
                          <div className="rounded-2xl rounded-tl-md border border-border/80 bg-muted/50 px-3 py-2 text-sm shadow-sm">
                            {m.text}
                          </div>
                          <p className="mt-1 text-[11px] text-muted-foreground">{t('supportChat.supportLabel')}</p>
                        </div>
                      </div>
                    ) : (
                      <div key={m.id} className="flex flex-col items-end gap-1">
                        <div
                          className={cn(
                            'max-w-[85%] rounded-2xl rounded-tr-md px-3 py-2 text-sm shadow-sm',
                            inMessageBubbleClass(m.delivery_status),
                          )}
                        >
                          {m.text}
                        </div>
                        {m.delivery_status === 'failed' ? (
                          <p className="text-[11px] text-destructive">{t('supportChat.notDelivered')}</p>
                        ) : null}
                      </div>
                    ),
                  )}
                </div>
              ))}
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        <div className="border-t border-border p-3">
          {sendMutation.isError ? (
            <p className="mb-2 text-xs text-destructive">{t('supportChat.sendError')}</p>
          ) : null}
          <div className="flex items-end gap-2 rounded-xl border border-primary/35 bg-background px-2 py-2 focus-within:ring-2 focus-within:ring-primary/30">
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={2}
              placeholder={t('supportChat.inputPlaceholder')}
              className="min-h-[44px] max-h-32 flex-1 resize-none bg-transparent px-1 py-1 text-sm outline-none"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  void handleSend()
                }
              }}
            />
            <Button
              type="button"
              size="icon"
              className="size-9 shrink-0"
              disabled={!text.trim() || sendMutation.isPending}
              onClick={() => void handleSend()}
              aria-label={t('supportChat.send')}
            >
              {sendMutation.isPending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
            </Button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}
