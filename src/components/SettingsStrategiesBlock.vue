<script setup lang="ts">
import { SpaceStrategy } from '@/helpers/interfaces';
import { clone } from '@snapshot-labs/snapshot.js/src/utils';
import schemas from '@snapshot-labs/snapshot.js/src/schemas';
import { STRATEGIES_LIMITS } from '@/helpers/constants';

const spaceSchema = schemas.space;

const props = defineProps<{
  context: 'setup' | 'settings';
  title?: string;
  showErrors?: boolean;
  isViewOnly?: boolean;
  spaceType?: string;
}>();

const { form, validationErrors } = useFormSpaceSettings(props.context, {
  spaceType: props.spaceType
});

const strategiesLimit = computed(
  () => STRATEGIES_LIMITS[props.spaceType || 'default']
);
const strategies = computed(() => form.value.strategies);

const strategyObj = {
  name: '',
  network: '',
  params: {}
};

const modalStrategyOpen = ref(false);
const currentStrategyIndex = ref<number | null>(null);
const currentStrategy = ref<SpaceStrategy>(clone(strategyObj));

function handleRemoveStrategy(i) {
  form.value.strategies = strategies.value.filter(
    (strategy, index) => index !== i
  );
}

function handleEditStrategy(i) {
  currentStrategyIndex.value = i;
  currentStrategy.value = clone(strategies.value[i]);
  modalStrategyOpen.value = true;
}

function handleAddStrategy() {
  if (props.isViewOnly) return;
  currentStrategyIndex.value = null;
  currentStrategy.value = strategyObj;
  modalStrategyOpen.value = true;
}

function handleSubmitStrategy(strategy) {
  if (currentStrategyIndex.value !== null) {
    const strategiesClone = clone(strategies.value);
    strategiesClone[currentStrategyIndex.value] = strategy;
    form.value.strategies = strategiesClone;
  } else {
    form.value.strategies = strategies.value.concat(strategy);
  }
}
</script>

<template>
  <div>
    <BaseBlock :title="title || $t('settings.strategies.label')">
      <ContainerParallelInput class="mb-4 w-full">
        <ComboboxNetwork
          :network="form.network"
          :hint="$t('settings.network.information')"
          :disabled="isViewOnly"
          :error="validationErrors?.network"
          :show-errors="showErrors"
          @select="value => (form.network = value)"
        />
        <TuneInput
          v-model="form.symbol"
          :label="$t(`settings.symbol.label`)"
          :hint="$t(`settings.symbol.information`)"
          placeholder="e.g. BAL"
          :error="validationErrors?.symbol"
          :max-length="schemas.space.properties.symbol.maxLength"
          :disabled="isViewOnly"
          autofocus
        />
      </ContainerParallelInput>

      <div class="flex justify-between">
        <div>
          <div class="flex items-center gap-1">
            <h4>
              {{ $tc('settings.strategiesList', [strategiesLimit]) }}
            </h4>
            <IconInformationTooltip
              class="text-sm"
              :information="$t('settings.strategies.information')"
            />
          </div>
          <div class="-mt-[3px] text-sm">
            ({{ $t('settings.votingPowerIsCumulative') }})
          </div>
        </div>
        <div>
          <TuneButton
            class="flex w-full items-center gap-1"
            :disabled="isViewOnly"
            @click="handleAddStrategy"
          >
            <i-ho-plus class="text-sm" />
            {{ $t('add') }}
          </TuneButton>
        </div>
      </div>
      <div class="mt-3 space-y-3">
        <StrategiesListItem
          v-for="(strategy, i) in strategies"
          :key="i"
          :strategy="strategy"
          :show-delete="!isViewOnly"
          :show-edit="!isViewOnly"
          @edit="handleEditStrategy(i)"
          @delete="handleRemoveStrategy(i)"
        />
      </div>

      <StrategiesBlockWarning
        v-if="showErrors"
        :error="validationErrors?.strategies"
        :context="context"
      />
    </BaseBlock>

    <teleport to="#modal">
      <ModalStrategy
        :open="modalStrategyOpen"
        :strategy="currentStrategy"
        :default-network="form.network"
        @close="modalStrategyOpen = false"
        @add="handleSubmitStrategy"
      />
    </teleport>
  </div>
</template>
