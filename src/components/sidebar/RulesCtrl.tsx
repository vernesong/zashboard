import { ArrowPathIcon, WrenchScrewdriverIcon } from '@heroicons/vue/24/outline'
import { updateRuleProviderAPI } from '@renderer/api'
import { RULE_TAB_TYPE } from '@renderer/constant'
import { showNotification } from '@renderer/helper/notification'
import {
  fetchRules,
  ruleProviderList,
  rules,
  rulesFilter,
  rulesTabShow,
} from '@renderer/store/rules'
import { displayLatencyInRule, displayNowNodeInRule } from '@renderer/store/settings'
import { computed, defineComponent, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import DialogWrapper from '../common/DialogWrapper.vue'
import TextInput from '../common/TextInput.vue'

export default defineComponent({
  name: 'RulesCtrl',
  props: {
    isLargeCtrlsBar: {
      type: Boolean,
      default: true,
    },
  },
  setup(props) {
    const { t } = useI18n()
    const settingsModel = ref(false)
    const isUpgrading = ref(false)
    const hasProviders = computed(() => {
      return ruleProviderList.value.length > 0
    })

    const handlerClickUpgradeAllProviders = async () => {
      if (isUpgrading.value) return
      isUpgrading.value = true
      try {
        let updateCount = 0

        await Promise.all(
          ruleProviderList.value.map((provider) =>
            updateRuleProviderAPI(provider.name).then(() => {
              updateCount++

              const isFinished = updateCount === ruleProviderList.value.length

              showNotification({
                key: 'updateFinishedTip',
                content: 'updateFinishedTip',
                params: {
                  number: `${updateCount}/${ruleProviderList.value.length}`,
                },
                type: isFinished ? 'alert-success' : 'alert-info',
                timeout: isFinished ? 2000 : 0,
              })
            }),
          ),
        )
        await fetchRules()
        isUpgrading.value = false
      } catch {
        await fetchRules()
        isUpgrading.value = false
      }
    }

    const tabsWithNumbers = computed(() => {
      return Object.values(RULE_TAB_TYPE).map((type) => {
        return {
          type,
          count: type === RULE_TAB_TYPE.RULES ? rules.value.length : ruleProviderList.value.length,
        }
      })
    })

    return () => {
      const tabs = (
        <div
          role="tablist"
          class="tabs-box tabs tabs-xs"
        >
          {tabsWithNumbers.value.map(({ type, count }) => {
            return (
              <a
                role="tab"
                key={type}
                class={['tab', rulesTabShow.value === type && 'tab-active']}
                onClick={() => (rulesTabShow.value = type)}
              >
                {t(type)} ({count})
              </a>
            )
          })}
        </div>
      )
      const upgradeAllIcon = rulesTabShow.value === RULE_TAB_TYPE.PROVIDER && (
        <button
          class="btn btn-circle btn-sm"
          onClick={handlerClickUpgradeAllProviders}
        >
          <ArrowPathIcon class={['h-4 w-4', isUpgrading.value && 'animate-spin']} />
        </button>
      )

      const searchInput = (
        <TextInput
          class={props.isLargeCtrlsBar ? 'w-80' : 'w-32 flex-1'}
          v-model={rulesFilter.value}
          placeholder={`${t('search')} | ${t('searchMultiple')}`}
          clearable={true}
        />
      )

      const settingsModal = (
        <>
          <button
            class={'btn btn-circle btn-sm'}
            onClick={() => (settingsModel.value = true)}
          >
            <WrenchScrewdriverIcon class="h-4 w-4" />
          </button>
          <DialogWrapper v-model={settingsModel.value}>
            <div class="flex flex-col gap-4 p-2 text-sm">
              <div class="flex items-center gap-2">
                {t('displaySelectedNode')}
                <input
                  class="toggle"
                  type="checkbox"
                  v-model={displayNowNodeInRule.value}
                />
              </div>
              <div class="flex items-center gap-2">
                {t('displayLatencyNumber')}
                <input
                  class="toggle"
                  type="checkbox"
                  v-model={displayLatencyInRule.value}
                />
              </div>
            </div>
          </DialogWrapper>
        </>
      )

      if (!props.isLargeCtrlsBar) {
        return (
          <div class="flex flex-col gap-2 p-2">
            {hasProviders.value && (
              <div class="flex gap-2">
                {tabs}
                {upgradeAllIcon}
              </div>
            )}
            <div class="flex w-full gap-2">
              {searchInput}
              {settingsModal}
            </div>
          </div>
        )
      }
      return (
        <div class="flex flex-wrap gap-2 p-2">
          {hasProviders.value && tabs}
          {searchInput}
          <div class="flex-1"></div>
          {upgradeAllIcon}
          {settingsModal}
        </div>
      )
    }
  },
})
