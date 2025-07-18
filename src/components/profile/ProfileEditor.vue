<template>
  <div
    v-if="isVisible"
    class="bg-base-100 profile-editor fixed top-0 left-0 z-50 flex h-full w-full flex-col gap-2 overflow-hidden p-4"
    @keydown.ctrl.s.prevent="handleProfileSave"
  >
    <div class="flex items-center justify-between">
      <div class="flex items-center gap-2">
        <span class="text-lg font-bold">
          {{ props.isPreviewMode ? $t('runtimeConfig') : $t('editProfile') }}
        </span>
        <template v-if="!props.isPreviewMode">
          <input
            v-model="profile.name"
            class="input input-sm w-48 font-normal"
          />
          <span
            v-if="isModified"
            class="text-info text-xs opacity-75"
          >
            ({{ $t('unsaved') }})
          </span>
        </template>
        <!-- JSON一级节点按钮 -->
        <div class="flex max-w-128 items-center gap-1">
          <button
            v-for="node in jsonTopLevelNodes"
            :key="node"
            class="btn btn-xs btn-outline"
            @click="scrollToNode(node)"
          >
            {{ node }}
          </button>
        </div>
      </div>
      <div class="flex items-center gap-2">
        <template v-if="!props.isPreviewMode">
          <button
            class="btn btn-sm btn-primary"
            @click="handleProfileSave"
          >
            {{ $t('save') }}
          </button>
          <button
            class="btn btn-sm btn-neutral"
            @click="handleProfileReset"
          >
            {{ $t('reset') }}
          </button>
        </template>
        <button
          class="btn btn-sm"
          @click="isVisible = false"
        >
          {{ $t('close') }}
        </button>
      </div>
    </div>

    <!-- Monaco Editor容器 -->
    <div
      ref="editorContainerRef"
      class="min-h-0 flex-1"
    ></div>

    <div
      v-if="profile.type === 'remote' && !props.isPreviewMode"
      class="flex items-center justify-end gap-2 text-sm"
    >
      <span> URL </span>
      <input
        v-model="profile.url"
        class="input input-sm w-108"
      />
      <div class="flex-1"></div>
      <span>
        {{ $t('autoUpdate') }}
      </span>
      <input
        type="checkbox"
        v-model="profile.autoUpdate"
        class="toggle toggle-sm"
      />
      <template v-if="profile.autoUpdate">
        <span>
          {{ $t('updateInterval') }}
        </span>
        <input
          v-model="profile.interval"
          class="input input-sm w-24"
          type="number"
          min="60"
        />
        s
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Profile } from '@/shared/type'
import { useNotification } from '@renderer/composables/notification'
import { isDarkTheme } from '@renderer/helper/utils'
import * as monaco from 'monaco-editor'
import { nextTick, onUnmounted, ref, watch } from 'vue'
import {
  getProfileContentAPI,
  getRuntimeProfileContentAPI,
  writeProfileContentAPI,
} from '../../api/ipc-invoke'
import { profileList, updateProfile } from '../../store/profiles'

interface Props {
  profileUuid?: string
  isPreviewMode?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  profileUuid: '',
  isPreviewMode: false,
})

const isVisible = defineModel<boolean>('modelValue', { required: true })

const { showNotification } = useNotification()
const profile = ref<Profile>({
  name: '',
  type: 'remote',
  uuid: '',
  isActive: false,
  autoUpdate: true,
  updatedAt: 0,
  interval: 3600,
  url: '',
})
const profileContent = ref('')
const isModified = ref(false)
const originalProfile = ref('')
const editorContainerRef = ref<HTMLElement>()
const jsonTopLevelNodes = ref<string[]>([])
let editor: monaco.editor.IStandaloneCodeEditor | null = null

// 解析JSON一级节点
const parseJsonTopLevelNodes = (jsonContent: string) => {
  try {
    const parsed = JSON.parse(jsonContent)
    if (typeof parsed === 'object' && parsed !== null) {
      jsonTopLevelNodes.value = Object.keys(parsed)
    } else {
      jsonTopLevelNodes.value = []
    }
  } catch {
    jsonTopLevelNodes.value = []
  }
}

// 跳转到指定节点
const scrollToNode = (nodeName: string) => {
  if (!editor) return

  try {
    const model = editor.getModel()
    if (!model) return

    // 查找节点位置
    const searchText = `"${nodeName}":`
    const findMatch = model.findMatches(searchText, false, false, true, null, false)

    if (findMatch.length > 0) {
      const position = findMatch[0].range.getStartPosition()
      editor.revealLineInCenter(position.lineNumber)
      editor.setPosition(position)
      editor.focus()
    }
  } catch (error) {
    console.error('跳转到节点失败:', error)
  }
}

// 初始化Monaco Editor
const initEditor = async () => {
  if (!editorContainerRef.value) return

  // 销毁现有编辑器
  if (editor) {
    editor.dispose()
    editor = null
  }

  // 创建新编辑器
  editor = monaco.editor.create(editorContainerRef.value, {
    value: profileContent.value,
    language: 'json',
    theme: isDarkTheme.value ? 'vs-dark' : 'vs',
    readOnly: props.isPreviewMode,
    automaticLayout: true,
    minimap: {
      enabled: true,
    },
    scrollBeyondLastLine: false,
    fontSize: 14,
    tabSize: 2,
    insertSpaces: true,
    wordWrap: 'on',
  })

  // 监听内容变化
  editor.onDidChangeModelContent(() => {
    if (editor) {
      profileContent.value = editor.getValue()
      handleProfileChange()
    }
  })
}

const initProfile = async () => {
  if (props.isPreviewMode) {
    // 在预览模式下加载运行时配置
    profileContent.value = await getRuntimeProfileContentAPI()
    originalProfile.value = profileContent.value
    isModified.value = false
    parseJsonTopLevelNodes(profileContent.value)
    return
  }

  const targetProfile = profileList.value.find((p) => p.uuid === props.profileUuid) as Profile

  if (!targetProfile) return

  profile.value = { ...targetProfile }
  profileContent.value = await getProfileContentAPI(props.profileUuid)
  originalProfile.value = profileContent.value
  isModified.value = false
  parseJsonTopLevelNodes(profileContent.value)
}

const handleProfileChange = () => {
  if (originalProfile.value !== '') {
    isModified.value = profileContent.value !== originalProfile.value
  }
  // 更新JSON节点列表
  parseJsonTopLevelNodes(profileContent.value)
}

const handleProfileReset = () => {
  initProfile()
}

const handleProfileSave = async () => {
  if (!props.profileUuid) return

  profileContent.value = profileContent.value.trim()
  await writeProfileContentAPI(props.profileUuid, profileContent.value)
  await updateProfile({
    ...profile.value,
    uuid: props.profileUuid,
  })
  showNotification({
    content: 'saveSuccess',
    type: 'alert-success',
    timeout: 2000,
  })
  isModified.value = false
  isVisible.value = false
}

// 监听可见性变化
watch(
  () => isVisible.value,
  async (val) => {
    if (val) {
      await initProfile()
      await nextTick()
      await initEditor()
    } else {
      // 隐藏时销毁编辑器
      if (editor) {
        editor.dispose()
        editor = null
      }
    }
  },
  { immediate: true },
)

// 监听主题变化
watch(
  () => isDarkTheme.value,
  (isDark) => {
    if (editor) {
      monaco.editor.setTheme(isDark ? 'vs-dark' : 'vs')
    }
  },
)

// 组件卸载时清理编辑器
onUnmounted(() => {
  if (editor) {
    editor.dispose()
    editor = null
  }
})
</script>
