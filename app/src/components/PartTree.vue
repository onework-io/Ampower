<script setup lang="ts">
import { useViewerStore } from '@/stores/viewer'

const store = useViewerStore()

/** 群組勾選框的三態：全開 / 全關 / 部分 */
function groupState(parts: { id: string }[]): 'all' | 'none' | 'some' {
  const on = parts.filter((p) => store.isVisible(p.id)).length
  if (on === 0) return 'none'
  return on === parts.length ? 'all' : 'some'
}
</script>

<template>
  <div class="tree">
    <div v-for="g in store.groups" :key="g.name" class="tree__group">
      <div class="tree__ghead">
        <input
          type="checkbox"
          :checked="groupState(g.parts) === 'all'"
          :indeterminate="groupState(g.parts) === 'some'"
          :aria-label="`切換 ${g.name} 全部構件`"
          @change="store.setGroupVisible(g.name, ($event.target as HTMLInputElement).checked)"
        />
        <span class="tree__gname">{{ g.name }}</span>
        <span class="tree__count">{{ g.parts.length }}</span>
      </div>

      <ul class="tree__list">
        <li
          v-for="p in g.parts"
          :key="p.id"
          class="tree__item"
          :class="{
            'is-isolated': store.isolatedId === p.id,
            'is-failed': store.status[p.id] === 'failed',
            'is-pending': store.status[p.id] === 'pending',
          }"
        >
          <input
            type="checkbox"
            :checked="store.isVisible(p.id)"
            :aria-label="`顯示 ${p.name}`"
            @change="store.toggleVisible(p.id)"
          />
          <button
            class="tree__name"
            :title="store.status[p.id] === 'failed' ? '載入失敗' : `點擊隔離 ${p.name}`"
            @click="store.toggleIsolate(p.id)"
          >
            {{ p.name }}
          </button>
        </li>
      </ul>
    </div>
  </div>
</template>

<style scoped>
.tree { overflow-y: auto; flex: 1; padding: 8px 0 16px; }
.tree__group { margin-bottom: 4px; }

.tree__ghead {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 7px 14px 5px;
  font-size: 11px;
  letter-spacing: 0.08em;
  color: var(--muted);
}
.tree__gname { flex: 1; }
.tree__count { opacity: 0.6; }

.tree__list { list-style: none; margin: 0; padding: 0; }

.tree__item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 1px 14px 1px 26px;
}
.tree__item:hover { background: #ffffff0a; }

.tree__name {
  flex: 1;
  text-align: left;
  border: 0;
  padding: 3px 0;
  border-radius: 0;
}
.tree__name:hover { color: var(--accent); }

.is-isolated .tree__name { color: var(--accent); font-weight: 600; }
.is-failed .tree__name { color: var(--danger); text-decoration: line-through; }
.is-pending .tree__name { opacity: 0.45; }
</style>
