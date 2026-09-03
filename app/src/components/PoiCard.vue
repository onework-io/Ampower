<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { usePoiStore } from '@/stores/poi'
import { toEmbed } from '@/lib/embedUrl'
import { formatTimecode, isValidRange, parseTimecode } from '@/lib/timecode'
import { PARTS } from '@/data/parts'

const props = defineProps<{ screen: { x: number; y: number } | null }>()
const store = usePoiStore()

const poi = computed(() => (store.activeId ? (store.byId.get(store.activeId) ?? null) : null))
const editing = computed(() => !!poi.value && store.editingId === poi.value.id)

const embed = computed(() =>
  poi.value?.url
    ? toEmbed(poi.value.url, { startSec: poi.value.startSec, endSec: poi.value.endSec })
    : null,
)

/** 只有影音平台吃得到區間設定，一般網址不顯示這兩個欄位 */
const supportsRange = computed(() => embed.value?.kind === 'youtube' || embed.value?.kind === 'vimeo')

const partName = computed(
  () => PARTS.find((p) => p.id === poi.value?.partId)?.name ?? poi.value?.partId ?? '',
)

const rangeLabel = computed(() => {
  const r = embed.value?.range
  if (!r?.startSec && !r?.endSec) return null
  const from = formatTimecode(r.startSec ?? 0)
  return r.endSec === undefined ? `${from} 起` : `${from} – ${formatTimecode(r.endSec)}`
})

/** 時間欄位維持使用者輸入的原字串，離開欄位或送出時才轉成秒數 */
const startText = ref('')
const endText = ref('')
const rangeError = ref<string | null>(null)

watch(
  () => [poi.value?.id, editing.value] as const,
  () => {
    startText.value = poi.value?.startSec !== undefined ? formatTimecode(poi.value.startSec) : ''
    endText.value = poi.value?.endSec !== undefined ? formatTimecode(poi.value.endSec) : ''
    rangeError.value = null
  },
  { immediate: true },
)

function commitRange() {
  if (!poi.value) return
  const rawStart = startText.value.trim()
  const rawEnd = endText.value.trim()
  const start = rawStart ? parseTimecode(rawStart) : null
  const end = rawEnd ? parseTimecode(rawEnd) : null

  if ((rawStart && start === null) || (rawEnd && end === null)) {
    rangeError.value = '時間格式看不懂，可用 90、1:30 或 1h2m3s'
    return
  }
  if (!isValidRange(start ?? undefined, end ?? undefined)) {
    rangeError.value = '結束時間必須晚於開始時間'
    return
  }
  rangeError.value = null
  store.update(poi.value.id, {
    startSec: start ?? undefined,
    endSec: end ?? undefined,
  })
}

function patch(field: 'title' | 'url' | 'note', e: Event) {
  if (!poi.value) return
  store.update(poi.value.id, { [field]: (e.target as HTMLInputElement).value })
}

function done() {
  commitRange()
  if (!rangeError.value) store.editingId = null
}

/** 卡片開在標記右上方 */
const style = computed(() => {
  if (!props.screen) return { display: 'none' }
  return { left: `${props.screen.x + 14}px`, top: `${props.screen.y - 12}px` }
})
</script>

<template>
  <div v-if="poi" class="poicard" :style="style">
    <header class="poicard__head">
      <span class="poicard__part">{{ partName }}</span>
      <button class="poicard__x" title="關閉" @click="store.activeId = null">✕</button>
    </header>

    <template v-if="editing">
      <input class="poicard__field" :value="poi.title" placeholder="標題" @input="patch('title', $event)" />
      <input
        class="poicard__field"
        :value="poi.url"
        placeholder="YouTube 或其他網址"
        @input="patch('url', $event)"
      />

      <div v-if="supportsRange" class="poicard__range">
        <label>
          開始
          <input v-model="startText" placeholder="0:30" @blur="commitRange()" />
        </label>
        <span class="poicard__dash">–</span>
        <label>
          結束
          <input
            v-model="endText"
            :placeholder="embed?.kind === 'vimeo' ? 'Vimeo 不支援' : '1:45'"
            :disabled="embed?.kind === 'vimeo'"
            @blur="commitRange()"
          />
        </label>
      </div>
      <p v-if="rangeError" class="poicard__error">{{ rangeError }}</p>

      <textarea
        class="poicard__field poicard__note"
        :value="poi.note ?? ''"
        placeholder="備註（選填）"
        @input="patch('note', $event)"
      />
      <div class="poicard__row">
        <button @click="done()">完成</button>
        <button class="is-danger" @click="store.remove(poi.id)">刪除</button>
      </div>
    </template>

    <template v-else>
      <h3 class="poicard__title">
        {{ poi.title || '未命名' }}
        <span v-if="rangeLabel" class="poicard__range-tag">{{ rangeLabel }}</span>
      </h3>

      <div v-if="embed && embed.kind !== 'invalid'" class="poicard__media">
        <!--
          不要設 referrerpolicy="no-referrer"：YouTube 需要 referer 驗證嵌入來源，
          少了它播放器會回報 Error 153。這裡沿用瀏覽器預設值。
        -->
        <iframe
          :src="embed.embedUrl!"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; picture-in-picture"
          allowfullscreen
        />
      </div>
      <p v-else-if="poi.url" class="poicard__warn">網址格式無法辨識</p>
      <p v-else class="poicard__warn">尚未填入網址</p>

      <p v-if="embed && !embed.reliable" class="poicard__hint">
        這個網站可能拒絕被嵌入。若上方是空白，請用下面的連結開啟。
      </p>

      <p v-if="poi.note" class="poicard__note-text">{{ poi.note }}</p>

      <div class="poicard__row">
        <a
          v-if="embed?.openUrl"
          class="poicard__link"
          :href="embed.openUrl"
          target="_blank"
          rel="noopener noreferrer"
        >
          在新分頁開啟
        </a>
        <button @click="store.editingId = poi.id">編輯</button>
      </div>
    </template>
  </div>
</template>

<style scoped>
.poicard {
  position: absolute;
  z-index: 5;
  width: 320px;
  transform: translateY(-100%);
  background: var(--panel-solid);
  border: 1px solid var(--line);
  border-radius: 10px;
  padding: 10px 12px 12px;
  box-shadow: 0 12px 32px #0009;
}

.poicard__head { display: flex; align-items: center; gap: 8px; margin-bottom: 4px; }
.poicard__part { flex: 1; color: var(--muted); font-size: 11px; }
.poicard__x { border: 0; padding: 0 4px; color: var(--muted); }
.poicard__x:hover { color: var(--text); background: transparent; }

.poicard__title {
  margin: 0 0 8px;
  font-size: 14px;
  display: flex;
  align-items: baseline;
  gap: 8px;
}
.poicard__range-tag {
  font-size: 11px;
  font-weight: 400;
  color: var(--accent);
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.poicard__media {
  aspect-ratio: 16 / 9;
  background: #000;
  border-radius: 6px;
  overflow: hidden;
  margin-bottom: 8px;
}
.poicard__media iframe { width: 100%; height: 100%; border: 0; display: block; }

.poicard__warn { margin: 4px 0 8px; color: var(--muted); }
.poicard__hint { margin: -4px 0 8px; color: var(--muted); font-size: 11px; line-height: 1.4; }
.poicard__error { margin: -2px 0 6px; color: var(--danger); font-size: 11px; }
.poicard__note-text { margin: 0 0 8px; white-space: pre-wrap; }

.poicard__field,
.poicard__range input {
  font: inherit;
  color: var(--text);
  background: #0b1322;
  border: 1px solid var(--line);
  border-radius: 5px;
  padding: 5px 7px;
}
.poicard__field { display: block; width: 100%; margin-bottom: 6px; }
.poicard__note { resize: vertical; min-height: 52px; }

.poicard__range { display: flex; align-items: center; gap: 6px; margin-bottom: 6px; }
.poicard__range label {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 5px;
  color: var(--muted);
  font-size: 11px;
}
.poicard__range input { width: 100%; min-width: 0; font-variant-numeric: tabular-nums; }
.poicard__range input:disabled { opacity: 0.45; }
.poicard__dash { color: var(--muted); }

.poicard__row { display: flex; gap: 8px; align-items: center; }
.poicard__row button { flex: 1; }
.poicard__row .is-danger:hover { border-color: var(--danger); color: var(--danger); }

.poicard__link {
  flex: 1;
  text-align: center;
  padding: 4px 10px;
  border: 1px solid var(--line);
  border-radius: 6px;
  color: var(--accent);
  text-decoration: none;
}
.poicard__link:hover { border-color: var(--accent); }
</style>
