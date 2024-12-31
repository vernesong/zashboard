<template>
  <div
    ref="parentRef"
    class="h-full overflow-y-auto p-2"
  >
    <div :style="{ height: `${totalSize}px` }">
      <table :class="`table table-zebra bg-base-100 ${sizeOfTable} rounded-none shadow-md`">
        <thead class="sticky -top-2 z-10 bg-base-100">
          <tr
            v-for="headerGroup in table.getHeaderGroups()"
            :key="headerGroup.id"
          >
            <th
              v-for="header in headerGroup.headers"
              :key="header.id"
              :colSpan="header.colSpan"
              :class="header.column.getCanSort() ? 'cursor-pointer select-none' : ''"
              @click="header.column.getToggleSortingHandler()?.($event)"
            >
              <div class="flex items-center gap-1">
                <button
                  v-if="header.column.getCanGroup()"
                  class="cursor-pointer"
                  @click.stop="() => header.column.getToggleGroupingHandler()()"
                >
                  <MagnifyingGlassMinusIcon
                    v-if="header.column.getIsGrouped()"
                    class="h-4 w-4"
                  />
                  <MagnifyingGlassPlusIcon
                    v-else
                    class="h-4 w-4"
                  />
                </button>
                <FlexRender
                  v-if="!header.isPlaceholder"
                  :render="header.column.columnDef.header"
                  :props="header.getContext()"
                >
                </FlexRender>
                <ArrowUpCircleIcon
                  class="h-4 w-4"
                  v-if="header.column.getIsSorted() === 'asc'"
                />
                <ArrowDownCircleIcon
                  class="h-4 w-4"
                  v-if="header.column.getIsSorted() === 'desc'"
                />
              </div>
            </th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="(virtualRow, index) in virtualRows"
            :key="virtualRow.key.toString()"
            :style="{
              height: `${virtualRow.size}px`,
              transform: `translateY(${virtualRow.start - index * virtualRow.size}px)`,
            }"
            class="hover:!bg-primary hover:text-primary-content"
          >
            <td
              v-for="cell in rows[virtualRow.index].getVisibleCells()"
              :key="cell.id"
              :class="
                twMerge(
                  'whitespace-nowrap text-sm',
                  [
                    CONNECTIONS_TABLE_ACCESSOR_KEY.Download,
                    CONNECTIONS_TABLE_ACCESSOR_KEY.DlSpeed,
                    CONNECTIONS_TABLE_ACCESSOR_KEY.Upload,
                    CONNECTIONS_TABLE_ACCESSOR_KEY.UlSpeed,
                  ].includes(cell.column.id as CONNECTIONS_TABLE_ACCESSOR_KEY) && 'min-w-20',
                  [CONNECTIONS_TABLE_ACCESSOR_KEY.Host].includes(
                    cell.column.id as CONNECTIONS_TABLE_ACCESSOR_KEY,
                  ) && 'max-w-[32rem] truncate',
                )
              "
            >
              <template v-if="cell.column.getIsGrouped()">
                <template v-if="rows[virtualRow.index].getCanExpand()">
                  <button
                    @click="() => rows[virtualRow.index].getToggleExpandedHandler()()"
                    class="relative top-1 cursor-pointer"
                  >
                    <MagnifyingGlassMinusIcon
                      v-if="rows[virtualRow.index].getIsExpanded()"
                      class="h-4 w-4"
                    />
                    <MagnifyingGlassPlusIcon
                      v-else
                      class="h-4 w-4"
                    />
                  </button>
                  <FlexRender
                    :render="cell.column.columnDef.cell"
                    :props="cell.getContext()"
                  />
                  <span> ({{ rows[virtualRow.index].subRows.length }}) </span>
                </template>
              </template>
              <FlexRender
                v-else
                :render="
                  cell.getIsAggregated()
                    ? cell.column.columnDef.aggregatedCell
                    : cell.column.columnDef.cell
                "
                :props="cell.getContext()"
              />
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup lang="ts">
import { disconnectByIdAPI } from '@/api'
import { useConnections } from '@/composables/connections'
import { CONNECTIONS_TABLE_ACCESSOR_KEY, TABLE_SIZE } from '@/config'
import { fromNow, getIPLabelFromMap, getProcessFromConnection, prettyBytesHelper } from '@/helper'
import { renderConnections } from '@/store/connections'
import { connectionTableColumns, tableSize } from '@/store/settings'
import type { Connection } from '@/types'
import {
  ArrowDownCircleIcon,
  ArrowUpCircleIcon,
  InformationCircleIcon,
  MagnifyingGlassMinusIcon,
  MagnifyingGlassPlusIcon,
  XMarkIcon,
} from '@heroicons/vue/24/outline'
import {
  FlexRender,
  getCoreRowModel,
  getExpandedRowModel,
  getGroupedRowModel,
  getSortedRowModel,
  isFunction,
  useVueTable,
  type ColumnDef,
  type ExpandedState,
  type GroupingState,
  type SortingState,
} from '@tanstack/vue-table'
import { useVirtualizer } from '@tanstack/vue-virtual'
import { useStorage } from '@vueuse/core'
import dayjs from 'dayjs'
import { twMerge } from 'tailwind-merge'
import { computed, h, ref } from 'vue'
import { useI18n } from 'vue-i18n'

const { handlerInfo } = useConnections()
const { t } = useI18n()
const columns: ColumnDef<Connection>[] = [
  {
    header: () => t('details'),
    enableSorting: false,
    id: CONNECTIONS_TABLE_ACCESSOR_KEY.Details,
    cell: ({ row }) => {
      return h(
        'button',
        {
          class: 'btn btn-xs btn-circle',
          onClick: () => {
            const connection = row.original

            handlerInfo(connection)
          },
        },
        [
          h(InformationCircleIcon, {
            class: 'h-4 w-4',
          }),
        ],
      )
    },
  },
  {
    header: () => t('close'),
    enableSorting: false,
    id: CONNECTIONS_TABLE_ACCESSOR_KEY.Close,
    cell: ({ row }) => {
      return h(
        'button',
        {
          class: 'btn btn-xs btn-circle',
          onClick: () => {
            const connection = row.original

            disconnectByIdAPI(connection.id)
          },
        },
        [
          h(XMarkIcon, {
            class: 'h-4 w-4',
          }),
        ],
      )
    },
  },
  {
    header: () => t('type'),
    id: CONNECTIONS_TABLE_ACCESSOR_KEY.Type,
    accessorFn: (original) => `${original.metadata.type} | ${original.metadata.network}`,
  },
  {
    header: () => t('process'),
    id: CONNECTIONS_TABLE_ACCESSOR_KEY.Process,
    accessorFn: (original) => getProcessFromConnection(original),
  },
  {
    header: () => t('host'),
    id: CONNECTIONS_TABLE_ACCESSOR_KEY.Host,
    accessorFn: (original) =>
      `${
        original.metadata.host ? original.metadata.host : original.metadata.destinationIP
      }:${original.metadata.destinationPort}`,
  },
  {
    header: () => t('rule'),
    id: CONNECTIONS_TABLE_ACCESSOR_KEY.Rule,
    accessorFn: (original) =>
      !original.rulePayload ? original.rule : `${original.rule} -> ${original.rulePayload}`,
  },
  {
    header: () => t('chains'),
    id: CONNECTIONS_TABLE_ACCESSOR_KEY.Chains,
    accessorFn: (original) => original.chains.slice().reverse().join(' -> '),
  },
  {
    header: () => t('connectTime'),
    enableGrouping: false,
    id: CONNECTIONS_TABLE_ACCESSOR_KEY.ConnectTime,
    accessorFn: (original) => fromNow(original.start),
    sortingFn: (prev, next) =>
      dayjs(next.original.start).valueOf() - dayjs(prev.original.start).valueOf(),
  },
  {
    header: () => t('dlSpeed'),
    enableGrouping: false,
    enableSorting: true,
    id: CONNECTIONS_TABLE_ACCESSOR_KEY.DlSpeed,
    accessorFn: (original) => `${prettyBytesHelper(original.downloadSpeed)}/s`,
    sortingFn: (prev, next) => prev.original.downloadSpeed - next.original.downloadSpeed,
  },
  {
    header: () => t('ulSpeed'),
    enableGrouping: false,
    id: CONNECTIONS_TABLE_ACCESSOR_KEY.UlSpeed,
    accessorFn: (original) => `${prettyBytesHelper(original.uploadSpeed)}/s`,
    sortingFn: (prev, next) => prev.original.uploadSpeed - next.original.uploadSpeed,
  },
  {
    header: () => t('dl'),
    enableGrouping: false,
    id: CONNECTIONS_TABLE_ACCESSOR_KEY.Download,
    accessorFn: (original) => prettyBytesHelper(original.download),
    sortingFn: (prev, next) => prev.original.download - next.original.download,
  },
  {
    header: () => t('ul'),
    enableGrouping: false,
    id: CONNECTIONS_TABLE_ACCESSOR_KEY.Upload,
    accessorFn: (original) => prettyBytesHelper(original.upload),
    sortingFn: (prev, next) => prev.original.upload - next.original.upload,
  },
  {
    header: () => t('sourceIP'),
    id: CONNECTIONS_TABLE_ACCESSOR_KEY.SourceIP,
    accessorFn: (original) => {
      return getIPLabelFromMap(original.metadata.sourceIP)
    },
  },
  {
    header: () => t('sourcePort'),
    id: CONNECTIONS_TABLE_ACCESSOR_KEY.SourcePort,
    accessorFn: (original) => original.metadata.sourcePort,
  },
  {
    header: () => t('destination'),
    id: CONNECTIONS_TABLE_ACCESSOR_KEY.Destination,
    accessorFn: (original) => original.metadata.destinationIP || original.metadata.host,
  },
]

const grouping = ref<GroupingState>([])
const expanded = ref<ExpandedState>({})
const sorting = useStorage<SortingState>('config/table-sorting', [])

const table = useVueTable({
  get data() {
    return renderConnections.value
  },
  columns,
  state: {
    get columnOrder() {
      return connectionTableColumns.value
    },
    get columnVisibility() {
      return {
        ...Object.fromEntries(
          Object.values(CONNECTIONS_TABLE_ACCESSOR_KEY).map((key) => [key, false]),
        ),
        ...Object.fromEntries(connectionTableColumns.value.map((key) => [key, true])),
      }
    },
    get grouping() {
      return grouping.value
    },
    get expanded() {
      return expanded.value
    },
    get sorting() {
      return sorting.value
    },
  },
  onGroupingChange: (updater) => {
    if (isFunction(updater)) {
      grouping.value = updater(grouping.value)
    } else {
      grouping.value = updater
    }
  },
  onExpandedChange: (updater) => {
    if (isFunction(updater)) {
      expanded.value = updater(expanded.value)
    }
  },
  onSortingChange: (updater) => {
    if (isFunction(updater)) {
      sorting.value = updater(sorting.value)
    } else {
      sorting.value = updater
    }
  },
  getSortedRowModel: getSortedRowModel(),
  getGroupedRowModel: getGroupedRowModel(),
  getExpandedRowModel: getExpandedRowModel(),
  getCoreRowModel: getCoreRowModel(),
})

const rows = computed(() => {
  return table.getRowModel().rows
})

const parentRef = ref<HTMLElement | null>(null)
const rowVirtualizerOptions = computed(() => {
  return {
    count: rows.value.length,
    getScrollElement: () => parentRef.value,
    estimateSize: () => 36,
    overscan: 48,
  }
})

const rowVirtualizer = useVirtualizer(rowVirtualizerOptions)
const virtualRows = computed(() => rowVirtualizer.value.getVirtualItems())
const totalSize = computed(() => rowVirtualizer.value.getTotalSize() + 24)

const classMap = {
  [TABLE_SIZE.SMALL]: 'table-xs',
  [TABLE_SIZE.LARGE]: 'table-sm',
}
const sizeOfTable = computed(() => {
  return classMap[tableSize.value]
})
</script>
