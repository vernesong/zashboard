import { fetchSmartGroupWeightsAPI, fetchSmartWeightsAPI } from '@/api'
import { ref } from 'vue'

export const smartWeightsMap = ref<Record<string, { Name: string; Rank: string }[]>>({})

// deprecated
const fetchSmartGroupWeights = async (proxyName: string) => {
  const { data } = await fetchSmartGroupWeightsAPI(proxyName)
  smartWeightsMap.value[proxyName] = data.weights || []
}

export const initSmartWeights = async (smartGroups: string[]) => {
  const { status, data: smartWeights } = await fetchSmartWeightsAPI()

  if (status !== 200) {
    // deprecated fallback
    smartGroups.forEach((name) => {
      fetchSmartGroupWeights(name)
    })
    return
  }

  const result: Record<string, { Name: string; Rank: string }[]> = {}
  for (const group in smartWeights.weights) {
    result[group] = smartWeights.weights[group] || []
  }

  smartWeightsMap.value = result
}