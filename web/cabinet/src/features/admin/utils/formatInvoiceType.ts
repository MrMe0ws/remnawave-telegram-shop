import type { TFunction } from 'i18next'

const INVOICE_TYPE_KEYS: Record<string, string> = {
  crypto: 'admin.users.invoiceTypes.crypto',
  yookasa: 'admin.users.invoiceTypes.yookasa',
  telegram: 'admin.users.invoiceTypes.telegram',
  tribute: 'admin.users.invoiceTypes.tribute',
  plt_sbp: 'admin.users.invoiceTypes.pltSbp',
  plt_cards: 'admin.users.invoiceTypes.pltCards',
  plt_acq: 'admin.users.invoiceTypes.pltAcq',
  plt_ww: 'admin.users.invoiceTypes.pltWw',
  plt_crypto: 'admin.users.invoiceTypes.pltCrypto',
}

export function formatInvoiceType(type: string, t: TFunction): string {
  const key = INVOICE_TYPE_KEYS[type]
  return key ? t(key) : type
}
