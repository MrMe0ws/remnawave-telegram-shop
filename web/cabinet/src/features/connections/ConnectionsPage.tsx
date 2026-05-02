import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import {
  Download,
  Plus,
  TriangleAlert,
  Power,
  Check,
  ExternalLink,
  ArrowLeft,
  ChevronDown,
  Monitor,
  Smartphone,
  Tv,
  Laptop,
  Globe,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'

import { AppLayout } from '@/components/AppLayout'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { api } from '@/lib/api'

type Lang = 'ru' | 'en'
type PlatformKey = string

type LText = Partial<Record<Lang, string>> & Record<string, string>
type LinkButton = { buttonLink: string; buttonText: LText }
type GuideStep = { title?: LText; description?: LText; buttons?: LinkButton[] }
type AppGuide = {
  id: string
  name: string
  isFeatured?: boolean
  urlScheme?: string
  installationStep: GuideStep
  addSubscriptionStep: GuideStep
  additionalAfterAddSubscriptionStep?: GuideStep
  connectAndUseStep: GuideStep
  isNeedBase64Encoding?: boolean
}
type AppConfig = {
  config: { branding?: { name?: string; logoUrl?: string; supportUrl?: string } }
  platforms: Partial<Record<PlatformKey, AppGuide[]>>
}

const uiText = {
  ru: {
    pageTitle: 'Установка',
    installTitle: 'Установка приложения',
    addTitle: 'Добавление подписки',
    usageTitle: 'Подключение и использование',
    troubleTitleFallback: 'Предупреждение',
    addSubscription: 'Добавить подписку',
    configError: 'Не удалось загрузить конфиг приложений',
    noSubscription: 'Подписка не найдена. Сначала оформите тариф.',
  },
  en: {
    pageTitle: 'Setup',
    installTitle: 'Install app',
    addTitle: 'Add subscription',
    usageTitle: 'Connect and use',
    troubleTitleFallback: 'Warning',
    addSubscription: 'Add subscription',
    configError: 'Could not load app config',
    noSubscription: 'Subscription not found. Purchase a plan first.',
  },
} as const

const platformLabel: Record<PlatformKey, string> = {
  ios: 'iOS',
  android: 'Android',
  macos: 'macOS',
  windows: 'Windows',
  linux: 'Linux',
  androidTV: 'Android TV',
  appleTV: 'Apple TV',
}

const platformIcon: Record<string, ReactNode> = {
  windows: <Monitor size={14} />,
  ios: <Smartphone size={14} />,
  android: <Smartphone size={14} />,
  macos: <Laptop size={14} />,
  linux: <Laptop size={14} />,
  androidTV: <Tv size={14} />,
  appleTV: <Tv size={14} />,
}

function normalizeAppKey(app: Pick<AppGuide, 'id' | 'name'>): string {
  return `${app.id} ${app.name}`.toLowerCase().replace(/\s+/g, ' ').trim()
}

function AppGlyph({ app }: { app: Pick<AppGuide, 'id' | 'name'> }) {
  const key = normalizeAppKey(app)
  const cls = 'size-6 text-white/70 dark:text-white/70'

  if (key.includes('happ')) {
    return (
      <svg className={cls} viewBox="0 0 50 50" fill="none" aria-hidden>
        <path d="M22.3264 3H12.3611L9.44444 20.1525L21.3542 8.22034L22.3264 3Z" fill="currentColor" />
        <path d="M10.9028 20.1525L22.8125 8.22034L20.8681 21.1469H28.4028L27.9167 21.6441L20.8681 28.8531H19.4097V30.5932L7.5 42.5254L10.9028 20.1525Z" fill="currentColor" />
        <path d="M41.0417 8.22034L28.8889 20.1525L31.684 3H41.7708L41.0417 8.22034Z" fill="currentColor" />
        <path d="M30.3472 20.1525L42.5 8.22034L38.6111 30.3446L26.9444 42.5254L29.0104 28.8531H22.3264L29.6181 21.1469H30.3472V20.1525Z" fill="currentColor" />
        <path d="M40.0694 30.3446L28.4028 42.5254L27.9167 47H37.8819L40.0694 30.3446Z" fill="currentColor" />
        <path d="M18.6806 47H8.47222L8.95833 42.5254L20.8681 30.5932L18.6806 47Z" fill="currentColor" />
      </svg>
    )
  }

  if (key.includes('shadowrocket') || key.includes('stash')) {
    return (
      <svg className={cls} viewBox="0 0 50 50" fill="none" aria-hidden>
        <path d="M21.2394 36.832L16.5386 39.568C16.5386 39.568 13.7182 36.832 11.8379 33.184C9.95756 29.536 16.5386 23.152 16.5386 23.152M21.2394 36.832H28.7606M21.2394 36.832C21.2394 36.832 15.5985 24.064 17.4788 16.768C19.3591 9.472 25 4 25 4C25 4 30.6409 9.472 32.5212 16.768C34.4015 24.064 28.7606 36.832 28.7606 36.832M28.7606 36.832L33.4614 39.568C33.4614 39.568 36.2818 36.832 38.1621 33.184C40.0424 29.536 33.4614 23.152 33.4614 23.152M25 46L26.8803 40.528H23.1197L25 46ZM25.9402 17.68C26.4594 18.1837 26.4594 19.0003 25.9402 19.504C25.4209 20.0077 24.5791 20.0077 24.0598 19.504C23.5406 19.0003 23.5406 18.1837 24.0598 17.68C24.5791 17.1763 25.4209 17.1763 25.9402 17.68Z" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    )
  }

  if (key.includes('streisand')) {
    return (
      <svg className={cls} viewBox="0 0 50 50" fill="none" aria-hidden>
        <path d="M25 46L6.14773 32.1591V19.9886L25 6.625L43.6136 19.9886V32.1591L25 46ZM4 39.5568L12.5909 33.1136M9.72727 43.8523L18.3182 37.4091M46 39.5568L37.4091 33.1136M40.2727 43.8523L31.6818 37.4091M45.5227 8.29545L36.9318 14.7386M39.7955 4L31.2045 10.4432M4.95455 8.29545L13.5455 14.7386M10.6818 4L19.2727 10.4432" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    )
  }

  if (key.includes('flclashx')) {
    return (
      <svg className={cls} viewBox="0 0 50 50" fill="none" aria-hidden>
        <rect x="16.1458" y="47" width="6.66417" height="46.9593" rx="3.33209" transform="rotate(-150 16.1458 47)" fill="currentColor" />
        <path d="M38.1165 40.751C39.0362 42.3446 38.4902 44.3827 36.8967 45.3027C35.3031 46.2228 33.2652 45.6764 32.345 44.083L25.6887 32.5537L29.5364 25.8896L38.1165 40.751ZM13.4163 4.63477C15.01 3.71464 17.0479 4.26078 17.968 5.85449L24.5334 17.2266L20.6868 23.8906L12.1975 9.18652C11.2775 7.59298 11.8229 5.55504 13.4163 4.63477Z" fill="currentColor" />
      </svg>
    )
  }

  if (key.includes('koala clash')) {
    return (
      <svg className={cls} viewBox="0 0 50 50" fill="none" aria-hidden>
        <path
          fillRule="evenodd"
          clipRule="evenodd"
          d="M9.89914 12.0988C8.76625 12.3109 7.40023 12.9154 6.4671 13.6175C4.88097 14.8109 3.43945 16.9431 3.43945 18.0958C3.43945 18.5921 3.7749 18.897 4.32087 18.897C4.54535 18.897 4.56025 18.9067 4.52245 19.0284C4.49995 19.1006 4.4677 19.5801 4.45075 20.0939C4.42358 20.9148 4.43504 21.0917 4.54506 21.5535C4.77726 22.5281 5.36121 23.5213 6.10823 24.2123C7.0261 25.0612 8.09752 25.5287 9.47582 25.6819C10.0706 25.748 10.1056 25.7591 10.0711 25.8713C9.98977 26.1363 9.96722 28.7692 10.0409 29.3936C10.2707 31.3407 11.0434 33.2014 12.3129 34.8649C12.9693 35.7251 14.245 36.9013 15.2422 37.5658C17.8436 39.2992 21.8949 40.176 26.3591 39.9715C28.2677 39.8841 29.5744 39.695 31.0475 39.2929C34.981 38.2194 38.1435 35.3868 39.367 31.8411C39.8477 30.4483 39.9953 29.291 39.9344 27.3918C39.9128 26.7175 39.8806 26.0712 39.8628 25.9556L39.8304 25.7456L40.3178 25.705C42.8281 25.496 44.777 23.973 45.4062 21.7286C45.5595 21.1815 45.6046 19.9667 45.4944 19.3495L45.4136 18.897L45.6511 18.8969C46.1008 18.8968 46.5605 18.518 46.5605 18.1477C46.5605 17.6975 46.2365 16.8334 45.8015 16.1238C43.7587 12.7907 39.7682 11.1824 36.59 12.4113C36.027 12.6289 35.3838 13.0062 34.6993 13.5202C34.1087 13.9638 32.7678 15.2974 32.479 15.7285C32.3378 15.9393 32.2474 16.0228 32.1869 15.9983C31.0329 15.5301 28.8717 15.0268 27.045 14.8008C26.2485 14.7023 23.7063 14.701 22.8673 14.7988C21.2192 14.9908 19.7141 15.3186 18.4414 15.7624L17.6965 16.0221L17.4227 15.6351C17.0693 15.1358 15.9297 13.9978 15.3287 13.5442C14.4248 12.8621 13.614 12.4273 12.7882 12.1822C12.211 12.0108 10.6148 11.9648 9.89914 12.0988ZM25.8049 24.9694C26.7666 25.3068 27.3845 26.0745 27.8608 27.5239C28.5272 29.5517 28.8276 32.0738 28.5196 33.055C28.3591 33.5664 28.1983 33.8307 27.8071 34.2255C27.4325 34.6037 26.8449 34.9031 26.1978 35.0456C25.5992 35.1774 24.3828 35.1807 23.793 35.0522C22.0734 34.6774 21.2382 33.507 21.3472 31.6246C21.4385 30.0455 21.9862 27.7393 22.5465 26.5745C22.931 25.775 23.553 25.1993 24.2849 24.9655C24.7443 24.8187 25.3799 24.8204 25.8049 24.9694Z"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinejoin="round"
        />
        <ellipse cx="17.2999" cy="27.0342" rx="1.54004" ry="1.54004" fill="currentColor" />
        <ellipse cx="32.9243" cy="27.0342" rx="1.54004" ry="1.54004" fill="currentColor" />
      </svg>
    )
  }

  if (key.includes('v2ray')) {
    return (
      <svg className={cls} viewBox="0 0 50 50" fill="none" aria-hidden>
        <path d="M7.17 8.24503H2V3H15.16V20.9497L34.5475 3H49L7.17 47V8.24503Z" fill="currentColor" />
      </svg>
    )
  }

  if (key.includes('clash mi') || key.includes('clash meta') || key.includes('clash')) {
    return (
      <svg className={cls} viewBox="0 0 50 50" fill="none" aria-hidden>
        <path d="M4.99239 5.21742C4.0328 5.32232 3.19446 5.43999 3.12928 5.47886C2.94374 5.58955 2.96432 33.4961 3.14997 33.6449C3.2266 33.7062 4.44146 34.002 5.84976 34.3022C7.94234 34.7483 8.60505 34.8481 9.47521 34.8481C10.3607 34.8481 10.5706 34.8154 10.7219 34.6541C10.8859 34.479 10.9066 33.7222 10.9338 26.9143L10.9638 19.3685L11.2759 19.1094C11.6656 18.7859 12.1188 18.7789 12.5285 19.0899C12.702 19.2216 14.319 20.624 16.1219 22.2061C17.9247 23.7883 19.5136 25.1104 19.6527 25.144C19.7919 25.1777 20.3714 25.105 20.9406 24.9825C22.6144 24.6221 23.3346 24.5424 24.9233 24.5421C26.4082 24.5417 27.8618 24.71 29.2219 25.0398C29.6074 25.1333 30.0523 25.1784 30.2107 25.1399C30.369 25.1016 31.1086 24.5336 31.8543 23.8777C33.3462 22.5653 33.6461 22.3017 35.4359 20.7293C36.1082 20.1388 36.6831 19.6313 36.7137 19.6017C37.5681 18.7742 38.0857 18.6551 38.6132 19.1642L38.9383 19.478V34.5138L39.1856 34.6809C39.6343 34.9843 41.2534 34.9022 43.195 34.4775C44.1268 34.2737 45.2896 34.0291 45.779 33.9339C46.2927 33.8341 46.7276 33.687 46.8079 33.5861C47.0172 33.3228 47.0109 5.87708 46.8014 5.6005C46.6822 5.4431 46.2851 5.37063 44.605 5.1996C43.477 5.08482 42.2972 5.00505 41.983 5.02223L41.4121 5.05368L35.4898 10.261C27.3144 17.4495 27.7989 17.0418 27.5372 16.9533C27.4148 16.912 26.1045 16.8746 24.6253 16.8702C22.0674 16.8626 21.9233 16.8513 21.6777 16.6396C21.0693 16.115 17.2912 12.8028 14.5726 10.4108C12.9548 8.98729 10.9055 7.18761 10.0186 6.41134L8.40584 5L7.5715 5.01331C7.11256 5.02072 5.95198 5.11252 4.99239 5.21742Z" fill="currentColor" />
      </svg>
    )
  }

  return <Globe className="size-5 text-muted-foreground/70" />
}

function pickText(text: LText | undefined, lang: Lang): string {
  if (!text) return ''
  return text[lang] || text.ru || text.en || Object.values(text)[0] || ''
}

function encodeBase64UrlSafe(value: string): string {
  const utf8 = unescape(encodeURIComponent(value))
  return btoa(utf8)
}

/** Часть deep link после urlScheme: base64, сырая ссылка или component-encoding. */
function subscriptionPayloadForScheme(scheme: string, subscriptionLink: string, isNeedBase64Encoding: boolean | undefined): string {
  if (isNeedBase64Encoding) {
    return encodeBase64UrlSafe(subscriptionLink)
  }
  const s = scheme.trim().toLowerCase()
  // Deep link: префикс + полный URL подписки без encodeURIComponent (иначе https:// и точки «ломаются»).
  const rawUrlPrefixes = ['happ://add/', 'v2raytun://import/', 'v2rayn://import/'] as const
  if (rawUrlPrefixes.some((p) => s.startsWith(p))) {
    return subscriptionLink
  }
  return encodeURIComponent(subscriptionLink)
}

function detectPlatformFromUA(): PlatformKey | '' {
  if (typeof navigator === 'undefined') return ''
  const ua = navigator.userAgent.toLowerCase()

  if (ua.includes('android') && ua.includes('tv')) return 'androidTV'
  if (ua.includes('appletv') || ua.includes('apple tv')) return 'appleTV'
  if (ua.includes('android')) return 'android'
  if (ua.includes('iphone') || ua.includes('ipad') || ua.includes('ipod')) return 'ios'
  if (ua.includes('windows')) return 'windows'
  if (ua.includes('mac os x') || ua.includes('macintosh')) return 'macos'
  if (ua.includes('linux')) return 'linux'
  return ''
}

export default function ConnectionsPage() {
  const { i18n } = useTranslation()
  const navigate = useNavigate()
  const currentLanguage: Lang = i18n.language?.toLowerCase().startsWith('en') ? 'en' : 'ru'
  const [selectedPlatform, setSelectedPlatform] = useState<PlatformKey>('')
  const [selectedAppId, setSelectedAppId] = useState<string>('')
  const [platformOpen, setPlatformOpen] = useState(false)
  const platformMenuRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!platformOpen) return
    function onPointerDown(e: PointerEvent) {
      const root = platformMenuRef.current
      if (!root) return
      const target = e.target as Node | null
      if (target && !root.contains(target)) {
        setPlatformOpen(false)
      }
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [platformOpen])

  const { data: config, isLoading: configLoading, error: configError } = useQuery<AppConfig>({
    queryKey: ['app-config'],
    queryFn: async () => {
      const resp = await fetch('/cabinet/api/content/app-config', { cache: 'no-store' })
      if (!resp.ok) throw new Error(`config status ${resp.status}`)
      return (await resp.json()) as AppConfig
    },
    staleTime: 0,
    refetchOnMount: 'always',
    retry: 1,
  })

  const { data: subscription, isLoading: subLoading } = useQuery({
    queryKey: ['subscription'],
    queryFn: () => api.subscription(),
    staleTime: 0,
    refetchOnMount: 'always',
    retry: 1,
  })

  const subscriptionLink = (subscription?.subscription_link || '').trim()
  const text = uiText[currentLanguage]

  const availablePlatforms = useMemo(() => {
    const keys = Object.keys(config?.platforms || {})
    const ordered: PlatformKey[] = []
    for (const key of keys) {
      if (config?.platforms?.[key]?.length) ordered.push(key)
    }
    return ordered
  }, [config])

  const detectedPlatform = useMemo(() => detectPlatformFromUA(), [])

  useEffect(() => {
    if (!availablePlatforms.length) return
    if (selectedPlatform && availablePlatforms.includes(selectedPlatform)) return

    if (!selectedPlatform && detectedPlatform && availablePlatforms.includes(detectedPlatform)) {
      setSelectedPlatform(detectedPlatform)
      return
    }

    setSelectedPlatform(availablePlatforms[0])
  }, [availablePlatforms, selectedPlatform, detectedPlatform])

  const apps = config?.platforms?.[selectedPlatform] || []

  useEffect(() => {
    if (!apps.length) return
    const featured = apps.find((a) => a.isFeatured)
    const fallback = featured || apps[0]
    if (!fallback) return
    if (!apps.some((a) => a.id === selectedAppId)) setSelectedAppId(fallback.id)
  }, [apps, selectedAppId])

  const selectedApp = useMemo(
    () => apps.find((a) => a.id === selectedAppId) || apps[0],
    [apps, selectedAppId],
  )

  function openAddSubscription() {
    if (!selectedApp || !subscriptionLink) return
    const scheme = (selectedApp.urlScheme || '').trim()
    if (!scheme) return
    const payload = subscriptionPayloadForScheme(scheme, subscriptionLink, selectedApp.isNeedBase64Encoding)
    const href = `${scheme}${payload}`
    window.open(href, '_blank', 'noopener,noreferrer')
  }

  return (
    <AppLayout>
      <div className="mx-auto w-full max-w-5xl space-y-4">
        <Card className="overflow-visible border-border/80 bg-card dark:bg-[linear-gradient(180deg,#0e1b34d6,#0a1428d1)]">
          <CardContent className="space-y-5 p-4 sm:p-6">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => navigate(-1)}
                  aria-label="Назад"
                  className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-background/70 text-foreground hover:bg-muted/60 dark:border-white/10 dark:bg-white/5 dark:text-slate-100"
                >
                  <ArrowLeft size={15} />
                </button>
                <h1 className="text-2xl font-semibold tracking-tight text-foreground dark:text-slate-100">
                  {text.pageTitle}
                </h1>
              </div>
              <div className="flex items-center gap-2">
                <div className="relative" ref={platformMenuRef}>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-8 border-border bg-background/80 text-foreground dark:border-white/15 dark:bg-white/5 dark:text-slate-200"
                    onClick={() => setPlatformOpen((v) => !v)}
                  >
                    {platformIcon[selectedPlatform] || <Globe size={14} />}
                    {platformLabel[selectedPlatform] || selectedPlatform}
                    <ChevronDown size={14} className={`transition-transform ${platformOpen ? 'rotate-180' : ''}`} />
                  </Button>
                  {platformOpen && (
                    <div className="absolute left-0 top-full z-[120] mt-1 w-44 max-w-[calc(100vw-2rem)] overflow-hidden rounded-lg border border-border bg-card shadow-xl ring-1 ring-border/70 sm:left-auto sm:right-0 dark:border-white/10 dark:bg-[#1b2435] dark:ring-white/10">
                      {availablePlatforms.map((platform) => (
                        <button
                          key={platform}
                          type="button"
                          className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors ${
                            platform === selectedPlatform
                              ? 'bg-primary/15 text-primary dark:bg-primary/30 dark:text-cyan-200'
                              : 'text-popover-foreground hover:bg-muted dark:text-slate-100 dark:hover:bg-white/10'
                          }`}
                          onClick={() => {
                            setSelectedPlatform(platform)
                            setPlatformOpen(false)
                          }}
                        >
                          {platformIcon[platform] || <Globe size={14} />}
                          {platformLabel[platform] || platform}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="flex w-full flex-wrap gap-2">
              {apps.map((app) => (
                <button
                  key={app.id}
                  type="button"
                  onClick={() => setSelectedAppId(app.id)}
                  className={`relative min-w-0 flex-[1_1_160px] sm:flex-[1_1_220px] rounded-xl border px-3 py-2 pr-12 text-left transition-all ${
                    app.id === selectedApp?.id
                      ? 'border-cyan-400/45 bg-cyan-500/15 shadow-[0_8px_18px_rgba(14,169,241,0.18)] dark:border-cyan-400/45 dark:bg-cyan-500/15'
                      : 'border-border bg-muted/30 hover:border-border/80 dark:border-white/10 dark:bg-white/5 dark:hover:border-white/20'
                  }`}
                >
                  <p className="inline-flex items-center gap-2 text-sm font-medium text-foreground dark:text-slate-100">
                    {app.isFeatured ? <span className="size-2 rounded-full bg-amber-400" /> : null}
                    {app.name}
                  </p>
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 opacity-80">
                    <AppGlyph app={app} />
                  </span>
                </button>
              ))}
            </div>

            {configLoading || subLoading ? (
              <p className="text-sm text-muted-foreground dark:text-slate-300">Loading…</p>
            ) : configError || !selectedApp ? (
              <p className="text-sm text-destructive">{text.configError}</p>
            ) : (
              <div className="space-y-5">
                <GuideSection
                  icon={<Download size={16} />}
                  title={text.installTitle}
                  description={pickText(selectedApp.installationStep.description, currentLanguage)}
                  buttons={selectedApp.installationStep.buttons || []}
                  lang={currentLanguage}
                  tone="purple"
                />

                <GuideSection
                  icon={<Plus size={16} />}
                  title={text.addTitle}
                  description={pickText(selectedApp.addSubscriptionStep.description, currentLanguage)}
                  tone="success"
                  customAction={
                    <Button
                      type="button"
                      size="sm"
                      onClick={openAddSubscription}
                      disabled={!subscriptionLink || !(selectedApp.urlScheme || '').trim()}
                    >
                      <Plus size={14} />
                      {text.addSubscription}
                    </Button>
                  }
                  footerHint={!subscriptionLink ? text.noSubscription : ''}
                />

                {selectedApp.additionalAfterAddSubscriptionStep && (
                  <GuideSection
                    icon={<TriangleAlert size={16} />}
                    title={
                      pickText(selectedApp.additionalAfterAddSubscriptionStep.title, currentLanguage) || text.troubleTitleFallback
                    }
                    description={pickText(selectedApp.additionalAfterAddSubscriptionStep.description, currentLanguage)}
                    buttons={selectedApp.additionalAfterAddSubscriptionStep.buttons || []}
                    lang={currentLanguage}
                    tone="danger"
                  />
                )}

                <GuideSection
                  icon={<Check size={16} />}
                  title={text.usageTitle}
                  description={pickText(selectedApp.connectAndUseStep.description, currentLanguage)}
                  tone="success"
                />
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  )
}

function GuideSection({
  icon,
  title,
  description,
  buttons,
  lang,
  customAction,
  footerHint,
  tone = 'neutral',
}: {
  icon: ReactNode
  title: string
  description: string
  buttons?: LinkButton[]
  lang?: Lang
  customAction?: ReactNode
  footerHint?: string
  tone?: 'neutral' | 'purple' | 'success' | 'danger'
}) {
  const toneClasses: Record<NonNullable<typeof tone>, { iconWrap: string; icon: string }> = {
    neutral: {
      iconWrap: 'border-border bg-muted/40 dark:border-white/15 dark:bg-white/5',
      icon: 'text-primary dark:text-cyan-200',
    },
    purple: {
      iconWrap: 'border-violet-300/80 bg-violet-100 dark:border-violet-400/35 dark:bg-violet-500/15',
      icon: 'text-violet-700 dark:text-violet-300',
    },
    success: {
      iconWrap: 'border-emerald-300/80 bg-emerald-100 dark:border-emerald-400/35 dark:bg-emerald-500/15',
      icon: 'text-emerald-700 dark:text-emerald-300',
    },
    danger: {
      iconWrap: 'border-rose-300/80 bg-rose-100 dark:border-rose-400/35 dark:bg-rose-500/15',
      icon: 'text-rose-700 dark:text-rose-300',
    },
  }

  return (
    <section className="border-b border-border/70 pb-4 last:border-b-0 dark:border-white/10">
      <div className="mb-2 flex items-center gap-2 text-foreground dark:text-slate-100">
        <span className={`inline-flex size-8 items-center justify-center rounded-full border ${toneClasses[tone].iconWrap} ${toneClasses[tone].icon}`}>
          {icon}
        </span>
        <h2 className="text-lg font-semibold">{title}</h2>
      </div>
      {description && <p className="whitespace-pre-line text-sm leading-6 text-muted-foreground dark:text-slate-300">{description}</p>}
      {(buttons?.length || customAction) && (
        <div className="mt-3 flex flex-wrap gap-2">
          {buttons?.map((btn, idx) => (
            <Button key={`${btn.buttonLink}-${idx}`} size="sm" variant="outline" className="border-border bg-background/80 text-foreground dark:border-white/15 dark:bg-white/5 dark:text-slate-100" asChild>
              <a href={btn.buttonLink} target="_blank" rel="noopener noreferrer">
                <ExternalLink size={14} />
                {pickText(btn.buttonText, lang || 'ru')}
              </a>
            </Button>
          ))}
          {customAction}
        </div>
      )}
      {footerHint ? <p className="mt-2 text-xs text-amber-700 dark:text-amber-300/90">{footerHint}</p> : null}
    </section>
  )
}
