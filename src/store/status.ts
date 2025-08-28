import {
  CORE_START_LOG,
  IS_AUTO_LAUNCH_ENABLED,
  IS_CORE_RUNNING,
  IS_SYSTEM_PROXY_ENABLED,
} from '@/shared/event'
import { addMessageListener } from '@renderer/api/ipc-message'
import { ref, watch } from 'vue'
import { ROUTE_NAME } from '../constant'
import router from '../router'
import { activeProfileUuid } from './profiles'
import { addBackend, backendList } from './setup'

export const isCoreRunning = ref(false)
export const isSystemProxyEnabled = ref(false)
export const isAutoLaunchEnabled = ref(false)
export const coreLogs = ref<string[]>([])
export const showCoreStartupModal = ref(false)

watch(showCoreStartupModal, (val) => {
  if (!val) {
    resetCoreLogs()
  }
})

export const resetCoreLogs = () => {
  coreLogs.value = []
}

addMessageListener<boolean>(IS_CORE_RUNNING, async (isRunning) => {
  backendList.value = []
  if (isRunning) {
    addBackend({
      host: '127.0.0.1',
      port: '9999',
      protocol: 'http',
      secondaryPath: '',
      password: activeProfileUuid.value,
    })
  } else {
    router.push({ name: ROUTE_NAME.profiles })
  }
  isCoreRunning.value = isRunning
})

addMessageListener<boolean>(IS_SYSTEM_PROXY_ENABLED, (isEnabled) => {
  isSystemProxyEnabled.value = isEnabled
})

addMessageListener<boolean>(IS_AUTO_LAUNCH_ENABLED, (isEnabled) => {
  isAutoLaunchEnabled.value = isEnabled
})

addMessageListener<string>(CORE_START_LOG, (log) => {
  if (!showCoreStartupModal.value) {
    showCoreStartupModal.value = true
  }
  coreLogs.value.unshift(log)
})
