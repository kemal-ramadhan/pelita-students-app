import { defineStore } from 'pinia'
import api from '@/utils/api'
import type { AppNotification, Paginated } from '@/types/api'

const PAGE_SIZE = 20

interface NotificationState {
  items: AppNotification[]
  page: number
  totalPages: number
  total: number
  loading: boolean
  loaded: boolean
  unread: number
}

/** Notifikasi siswa: /instantion/student/notifications (§10.5). */
export const useNotificationStore = defineStore('notifications', {
  state: (): NotificationState => ({
    items: [],
    page: 0,
    totalPages: 1,
    total: 0,
    loading: false,
    loaded: false,
    unread: 0,
  }),

  getters: {
    hasMore: (s) => s.page < s.totalPages,
  },

  actions: {
    async fetchUnreadCount() {
      const { data } = await api.get<{ data: { count: number } }>('/instantion/student/notifications/unread-count')
      this.unread = data.data?.count ?? 0
      return this.unread
    },

    async loadPage(page: number) {
      this.loading = true
      try {
        const { data } = await api.get<Paginated<AppNotification>>('/instantion/student/notifications', {
          params: { page, limit: PAGE_SIZE },
        })
        const list = data.data ?? []
        if (page === 1) this.items = list
        else {
          const seen = new Set(this.items.map((n) => n.id))
          this.items = [...this.items, ...list.filter((n) => !seen.has(n.id))]
        }
        this.page = data.meta?.page ?? page
        this.totalPages = Math.max(1, data.meta?.total_pages ?? 1)
        this.total = data.meta?.total ?? this.items.length
        this.loaded = true
      } finally {
        this.loading = false
      }
    },

    async refresh() {
      await Promise.all([this.loadPage(1), this.fetchUnreadCount().catch(() => undefined)])
    },

    async loadMore() {
      if (this.loading || !this.hasMore) return
      await this.loadPage(this.page + 1)
    },

    async markRead(id: string) {
      const n = this.items.find((x) => x.id === id)
      if (!n || n.read_at) return
      const prev = n.read_at
      n.read_at = new Date().toISOString()
      this.unread = Math.max(0, this.unread - 1)
      try {
        await api.post(`/instantion/student/notifications/${encodeURIComponent(id)}/read`)
      } catch (err) {
        n.read_at = prev
        this.unread++
        throw err
      }
    },

    async markAllRead() {
      await api.post('/instantion/student/notifications/read-all')
      const now = new Date().toISOString()
      for (const n of this.items) if (!n.read_at) n.read_at = now
      this.unread = 0
    },
  },
})
