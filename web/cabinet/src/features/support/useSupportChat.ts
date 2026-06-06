import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { api } from '@/lib/api'
import { useAuthStore } from '@/store/auth'

const SUMMARY_KEY = ['support', 'summary'] as const
const CONVERSATION_KEY = ['support', 'conversation'] as const

export function useSupportSummary(enabled: boolean, pollMs = 60_000) {
  const hasToken = Boolean(useAuthStore((s) => s.accessToken))
  return useQuery({
    queryKey: SUMMARY_KEY,
    queryFn: () => api.supportSummary(),
    enabled: enabled && hasToken,
    refetchInterval: enabled && hasToken ? pollMs : false,
    staleTime: 5_000,
    retry: 1,
  })
}

export function useSupportChat(enabled: boolean, modalOpen: boolean) {
  const queryClient = useQueryClient()
  const summary = useSupportSummary(enabled, modalOpen ? 30_000 : 60_000)

  const conversation = useQuery({
    queryKey: CONVERSATION_KEY,
    queryFn: () => api.supportConversation(),
    enabled: enabled && modalOpen,
    refetchInterval: enabled && modalOpen ? 5_000 : false,
    staleTime: 0,
    retry: 1,
  })

  const sendMutation = useMutation({
    mutationFn: (text: string) => api.supportSendMessage(text),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: CONVERSATION_KEY })
      void queryClient.invalidateQueries({ queryKey: SUMMARY_KEY })
    },
  })

  const markReadMutation = useMutation({
    mutationFn: () => api.supportMarkRead(),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: CONVERSATION_KEY })
      void queryClient.invalidateQueries({ queryKey: SUMMARY_KEY })
    },
  })

  return {
    summary,
    conversation,
    sendMutation,
    markReadMutation,
  }
}
