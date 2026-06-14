import type { TFunction } from 'i18next'

import { ApiError } from '@/lib/api'

const BODY_KEY_MAP: Record<string, string> = {
  'panel not configured': 'admin.errors.panelUnavailable',
  'not found': 'admin.errors.notFound',
  'not implemented': 'admin.errors.notImplemented',
  'sync already in progress': 'admin.errors.syncInProgress',
  'recalc already in progress': 'admin.errors.recalcInProgress',
  'broadcast already in progress': 'admin.errors.broadcastInProgress',
  'method not allowed': 'admin.errors.methodNotAllowed',
  'invalid id': 'admin.errors.invalidId',
  'no valid fields': 'admin.errors.noValidFields',
  'code and type are required': 'admin.errors.promoCodeRequired',
  'slug is required': 'admin.errors.slugRequired',
}

function normalizeBody(body: string): string {
  return body.trim().toLowerCase()
}

function mapBodyToKey(body: string): string | null {
  const norm = normalizeBody(body)
  if (!norm) return null
  for (const [needle, key] of Object.entries(BODY_KEY_MAP)) {
    if (norm.includes(needle)) return key
  }
  return null
}

export function formatAdminApiError(err: unknown, t: TFunction): string {
  if (err instanceof ApiError) {
    const bodyKey = mapBodyToKey(err.body)
    if (bodyKey) return t(bodyKey)

    switch (err.status) {
      case 400:
        return t('admin.errors.badRequest')
      case 401:
        return t('admin.errors.unauthorized')
      case 403:
        return t('admin.errors.forbidden')
      case 404:
        return t('admin.errors.notFound')
      case 409:
        return t('admin.errors.conflict')
      case 429:
        return t('admin.errors.tooManyRequests')
      case 501:
        return t('admin.errors.notImplemented')
      case 503:
        return t('admin.errors.serviceUnavailable')
      default:
        if (err.status >= 500) return t('admin.errors.serverError')
        return t('admin.errors.requestFailed')
    }
  }
  return t('admin.errors.unknown')
}
