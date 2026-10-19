<script setup lang="ts">
import { computed } from 'vue'
import { RIASEC_ID, RIASEC_LABELS, type BarDatum } from '@/utils/assessment'

/** Heksagon Holland (R-I-A-S-E-C searah jarum jam); nilai juga tersedia sebagai daftar untuk pembaca layar. */
const props = defineProps<{ data: BarDatum[]; code?: string | null }>()

const ORDER = ['R', 'I', 'A', 'S', 'E', 'C']
const C = 120
const R = 78

function point(i: number, ratio: number) {
  const a = ((i * 60 - 90) * Math.PI) / 180
  return { x: C + R * ratio * Math.cos(a), y: C + R * ratio * Math.sin(a) }
}
const byKey = computed(() => new Map(props.data.map((d) => [d.key, d])))
const rings = [0.25, 0.5, 0.75, 1].map((r) =>
  ORDER.map((_, i) => point(i, r))
    .map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`)
    .join(' '),
)
const shape = computed(() =>
  ORDER.map((k, i) => {
    const d = byKey.value.get(k)
    const ratio = d ? Math.max(0.02, Math.min(1, d.value / (d.max || 1))) : 0
    return point(i, ratio)
  }),
)
const labels = ORDER.map((k, i) => ({ k, ...point(i, 1.28) }))
const top = computed(() => (props.code ?? '').toUpperCase().split(''))
</script>

<template>
  <figure class="card p-4">
    <figcaption>
      <p class="text-[15px] font-semibold text-fg">Profil RIASEC</p>
      <p class="text-xs text-fg-subtle">
        Semakin jauh dari tengah, semakin kuat minat pada tipe tersebut.
      </p>
    </figcaption>
    <svg
      viewBox="0 0 240 240"
      class="mx-auto mt-2 w-full max-w-[280px]"
      role="img"
      aria-hidden="true"
    >
      <polygon
        v-for="(r, i) in rings"
        :key="i"
        :points="r"
        fill="none"
        stroke="var(--border)"
        stroke-width="1"
      />
      <line
        v-for="(_, i) in ORDER"
        :key="`ax-${i}`"
        :x1="C"
        :y1="C"
        :x2="point(i, 1).x"
        :y2="point(i, 1).y"
        stroke="var(--border)"
        stroke-width="1"
      />
      <polygon
        :points="shape.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')"
        class="fill-primary-500/20 stroke-primary-600 dark:stroke-primary-400"
        stroke-width="2"
        stroke-linejoin="round"
      />
      <circle
        v-for="(p, i) in shape"
        :key="`pt-${i}`"
        :cx="p.x"
        :cy="p.y"
        r="4"
        class="fill-primary-600 dark:fill-primary-400"
        stroke="var(--surface)"
        stroke-width="2"
      />
      <text
        v-for="l in labels"
        :key="l.k"
        :x="l.x"
        :y="l.y"
        text-anchor="middle"
        dominant-baseline="middle"
        class="text-[13px]"
        :class="top.includes(l.k) ? 'fill-fg font-bold' : 'fill-fg-muted font-medium'"
      >
        {{ l.k }}
      </text>
    </svg>
    <ul class="mt-2 grid grid-cols-2 gap-x-4 gap-y-1.5 text-[13px]">
      <li v-for="k in ORDER" :key="k" class="flex items-baseline justify-between gap-2">
        <span :class="top.includes(k) ? 'font-semibold text-fg' : 'text-fg-muted'">
          {{ k }} · {{ RIASEC_ID[k] }}<span class="sr-only"> ({{ RIASEC_LABELS[k] }})</span>
        </span>
        <span class="tabular-nums text-fg">{{ byKey.get(k)?.display ?? '—' }}</span>
      </li>
    </ul>
  </figure>
</template>
