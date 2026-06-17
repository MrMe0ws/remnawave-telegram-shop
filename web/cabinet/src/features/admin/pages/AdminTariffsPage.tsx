import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Zap,
  Plus,
  Pencil,
  Trash2,
  ToggleLeft,
  ToggleRight,
  Server,
  Smartphone,
  Gauge,
} from 'lucide-react'

import { AdminLayout } from '../layout/AdminLayout'
import { useAdminPageMeta } from '../layout/useAdminPageMeta'
import { AdminPageHeader } from '../components/AdminPageHeader'
import { AdminFeedback } from '../components/AdminFeedback'
import { AdminTariffEditor } from '../components/AdminTariffEditor'
import { AdminConfirmModal } from '../components/AdminConfirmModal'
import { useAdminMutationFeedback } from '../hooks/useAdminMutationFeedback'
import { TariffDescription } from '@/components/TariffDescription'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import {
  useAdminTariffList,
  useAdminTariffCreate,
  useAdminTariffUpdate,
  useAdminTariffDelete,
  type AdminTariff,
  type CreateTariffInput,
} from '../hooks/useAdminTariffs'

const GB = 1024 * 1024 * 1024

function bytesToGB(bytes: number): string {
  if (!bytes || bytes <= 0) return '∞'
  return (bytes / GB).toFixed(1)
}

function TariffCard({ tariff, onEdit }: { tariff: AdminTariff; onEdit: () => void }) {
  const { t } = useTranslation()
  const update = useAdminTariffUpdate()
  const del = useAdminTariffDelete()
  const [deleteOpen, setDeleteOpen] = useState(false)

  const squadCount = tariff.active_internal_squad_uuids
    ? tariff.active_internal_squad_uuids.split(',').filter(Boolean).length
    : 0

  const title = tariff.name?.trim() || tariff.slug

  return (
    <Card
      className={cn(
        'cabinet-elevated-card overflow-hidden transition-shadow hover:shadow-md',
        tariff.is_active ? 'ring-1 ring-emerald-500/20' : 'opacity-90',
      )}
    >
      <div className="flex flex-col p-5">
        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 flex-1 items-start gap-2.5">
            <div
              className={cn(
                'flex size-9 shrink-0 items-center justify-center rounded-lg',
                tariff.is_active
                  ? 'bg-emerald-500/15 dark:bg-emerald-500/20'
                  : 'bg-red-500/15 dark:bg-red-500/20',
              )}
            >
              <Zap
                className={cn(
                  'size-4',
                  tariff.is_active
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-red-500 dark:text-red-400',
                )}
              />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="text-base font-semibold leading-snug break-words">{title}</h3>
              <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                <span
                  className={cn(
                    'rounded-full px-2 py-0.5 text-[11px] font-medium leading-none',
                    tariff.is_active
                      ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                      : 'bg-red-500/15 text-red-500 dark:text-red-400',
                  )}
                >
                  {tariff.is_active ? t('admin.tariffs.active') : t('admin.promos.inactive')}
                </span>
                {tariff.tier_level != null && (
                  <span className="rounded-full bg-violet-500/15 px-2 py-0.5 text-[11px] font-medium leading-none text-violet-600 dark:text-violet-400">
                    {t('admin.tariffs.tierLevel')} {tariff.tier_level}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-0.5 self-start">
            <button
              type="button"
              onClick={onEdit}
              className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
              title={t('admin.edit')}
            >
              <Pencil className="size-4" />
            </button>
            <button
              type="button"
              onClick={() => update.mutate({ id: tariff.id, fields: { is_active: !tariff.is_active } })}
              className="rounded-lg p-2 transition-opacity hover:opacity-70 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/30 active:opacity-50"
              title={t('admin.tariffs.toggleActive')}
            >
              {tariff.is_active ? (
                <ToggleRight className="size-5 text-emerald-500" />
              ) : (
                <ToggleLeft className="size-5 text-muted-foreground" />
              )}
            </button>
            <button
              type="button"
              onClick={() => setDeleteOpen(true)}
              className="rounded-lg p-2 text-destructive/80 transition-colors hover:bg-destructive/10 hover:text-destructive"
              title={t('admin.delete')}
            >
              <Trash2 className="size-4" />
            </button>
          </div>
        </div>

        <AdminConfirmModal
          open={deleteOpen}
          onClose={() => setDeleteOpen(false)}
          onConfirm={() => {
            del.mutate(tariff.id, { onSuccess: () => setDeleteOpen(false) })
          }}
          title={t('admin.tariffs.deleteTariff')}
          message={t('admin.tariffs.confirmDelete', { name: title })}
          confirmLabel={t('admin.delete')}
          variant="destructive"
          loading={del.isPending}
          icon={Trash2}
          iconAccent="rose"
        />

        {tariff.description?.trim() && (
          <div className="mt-4 rounded-xl border border-border/40 bg-muted/10 px-3 py-2.5">
            <TariffDescription text={tariff.description} className="text-sm text-muted-foreground" />
          </div>
        )}

        {/* Limits */}
        <div className="mt-4 grid grid-cols-3 gap-2">
          {[
            {
              icon: Smartphone,
              label: t('admin.tariffs.devices'),
              value: String(tariff.device_limit),
            },
            {
              icon: Gauge,
              label: t('admin.tariffs.traffic'),
              value: `${bytesToGB(tariff.traffic_limit_bytes)} ${t('admin.users.subscription.gbUnit')}`,
            },
            {
              icon: Server,
              label: t('admin.tariffs.squadsShort'),
              value: squadCount > 0 ? String(squadCount) : t('admin.tariffs.unlimited'),
            },
          ].map(({ icon: Icon, label, value }) => (
            <div
              key={label}
              className="flex flex-col items-center rounded-xl border border-border/40 bg-muted/15 px-2 py-2.5 text-center"
            >
              <Icon className="mb-1 size-4 text-muted-foreground" />
              <span className="text-sm font-semibold tabular-nums leading-none">{value}</span>
              <span className="mt-1 text-[10px] leading-tight text-muted-foreground">{label}</span>
            </div>
          ))}
        </div>
      </div>
    </Card>
  )
}

export default function AdminTariffsPage() {
  const { t } = useTranslation()
  const { data: tariffs, isLoading } = useAdminTariffList()
  const create = useAdminTariffCreate()
  const update = useAdminTariffUpdate()
  const { feedback, clear, showSuccess, showError } = useAdminMutationFeedback()

  const [editorOpen, setEditorOpen] = useState(false)
  const [editingTariff, setEditingTariff] = useState<AdminTariff | null>(null)

  useAdminPageMeta({
    breadcrumbTail: editorOpen
      ? (editingTariff
        ? t('admin.breadcrumb.tariffEdit', { name: editingTariff.name ?? editingTariff.slug })
        : t('admin.breadcrumb.tariffCreate'))
      : undefined,
  })

  const openCreate = () => { setEditingTariff(null); setEditorOpen(true) }
  const openEdit = (tariff: AdminTariff) => { setEditingTariff(tariff); setEditorOpen(true) }
  const closeEditor = () => { setEditorOpen(false); setEditingTariff(null) }

  const handleSave = (data: CreateTariffInput | Record<string, unknown>, isEdit: boolean) => {
    const savedMsg = t('admin.feedback.saved')
    if (isEdit && editingTariff) {
      update.mutate(
        { id: editingTariff.id, fields: data as Record<string, unknown> },
        {
          onSuccess: () => {
            showSuccess(savedMsg)
            closeEditor()
          },
          onError: showError,
        },
      )
    } else {
      create.mutate(data as CreateTariffInput, {
        onSuccess: () => {
          showSuccess(savedMsg)
          closeEditor()
        },
        onError: showError,
      })
    }
  }

  return (
    <AdminLayout>
      <AdminFeedback feedback={feedback} onDismiss={clear} />
      <div className="space-y-6">
        <AdminPageHeader
          icon={Zap}
          title={t('admin.tariffs.title')}
          subtitle={t('admin.tariffs.subtitle')}
          accent="emerald"
          actions={
            <button
              type="button"
              onClick={openCreate}
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              <Plus className="size-4" />
              {t('admin.tariffs.create')}
            </button>
          }
        />

        {isLoading ? (
          <div className="py-12 text-center text-muted-foreground">{t('admin.loading')}</div>
        ) : !tariffs || tariffs.length === 0 ? (
          <Card className="border-dashed p-12 text-center">
            <Zap className="mx-auto mb-3 size-10 text-muted-foreground/50" />
            <p className="text-muted-foreground">{t('admin.tariffs.empty')}</p>
            <button type="button" onClick={openCreate} className="mt-4 text-sm text-primary hover:underline">
              {t('admin.tariffs.createFirst')}
            </button>
          </Card>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {tariffs.map((tariff) => (
              <TariffCard key={tariff.id} tariff={tariff} onEdit={() => openEdit(tariff)} />
            ))}
          </div>
        )}
      </div>

      <AdminTariffEditor
        open={editorOpen}
        onClose={closeEditor}
        tariff={editingTariff}
        onSave={handleSave}
        saving={create.isPending || update.isPending}
      />
    </AdminLayout>
  )
}
