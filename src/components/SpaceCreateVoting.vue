<script setup lang="ts">
import { ExtendedSpace } from '@/helpers/interfaces';
import draggable from 'vuedraggable';
import SpaceCreateLegacyOsnap from './SpaceCreateLegacyOsnap.vue';
import SpaceCreateOsnap from './SpaceCreateOsnap.vue';
import { BOOST_ENABLED_VOTING_TYPES } from '@/helpers/constants';

const props = defineProps<{
  space: ExtendedSpace;
  dateStart: number;
  dateEnd: number;
  hasOsnapPlugin: boolean;
  shouldUseOsnap: boolean;
  legacyOsnap: { enabled: boolean; selection: boolean };
  isEditing: boolean;
}>();

const {
  form,
  sourceProposalLoaded,
  userSelectedDateStart,
  userSelectedDateEnd
} = useFormSpaceProposal();

const disableChoiceEdit = computed(() => form.value.type === 'basic');

function addChoices(num) {
  for (let i = 1; i <= num; i++) {
    form.value.choices.push({ key: form.value.choices.length, text: '' });
  }
}

function setDateStart(ts) {
  form.value.start = ts;
  userSelectedDateStart.value = true;
}

function setDateEnd(ts) {
  form.value.end = ts;
  userSelectedDateEnd.value = true;
}

watch(
  () => form.value.type,
  (newType, oldType) => {
    if (newType !== 'basic' && oldType === 'basic') {
      form.value.choices = [
        { key: 0, text: '' },
        { key: 1, text: '' }
      ];
    }
    if (form.value.type === 'basic') {
      form.value.choices = [
        { key: 1, text: 'For' },
        { key: 2, text: 'Against' },
        { key: 3, text: 'Abstain' }
      ];
    }
  },
  { immediate: true }
);

watch(
  () => props.legacyOsnap.selection,
  () => {
    // If using osnap, we can only allow basic voting, for, against, abstain
    if (props.legacyOsnap.selection) {
      form.value.type = 'basic';
    } else if (props.space?.voting?.type) {
      form.value.type = props.space.voting.type;
    }
  }
);

watch(
  () => props.shouldUseOsnap,
  () => {
    if (props.shouldUseOsnap) {
      form.value.type = 'basic';
    }
  }
);

const { getSnapshot } = useSnapshot();

onMounted(async () => {
  // Initialize the start date to current
  if (!sourceProposalLoaded.value && !userSelectedDateStart.value)
    form.value.start = Number((Date.now() / 1e3).toFixed());
  // Initialize the proposal type if set in space
  if (props.space?.voting?.type) form.value.type = props.space.voting.type;
  form.value.snapshot = await getSnapshot(props.space.network);
});

defineEmits<{
  (event: 'legacyOsnapToggle'): void;
  (event: 'toggleShouldUseOsnap'): void;
}>();
</script>

<template>
  <SpaceCreateLegacyOsnap
    v-if="legacyOsnap.enabled"
    :space="space"
    :legacy-osnap="legacyOsnap"
    @legacy-osnap-toggle="$emit('legacyOsnapToggle')"
  />
  <SpaceCreateOsnap
    v-if="hasOsnapPlugin"
    :should-use-osnap="shouldUseOsnap"
    :legacy-osnap="legacyOsnap"
    @toggle-should-use-osnap="$emit('toggleShouldUseOsnap')"
  />
  <div class="mb-5 space-y-4">
    <BaseBlock :title="$t('create.voting')">
      <InputSelectVoteType
        :type="space.voting?.type || form.type"
        :disabled="
          !!space.voting?.type || legacyOsnap.selection || shouldUseOsnap
        "
        @update:type="value => (form.type = value)"
      />
      <template v-if="space.boost.enabled">
        <BaseMessage
          v-if="!BOOST_ENABLED_VOTING_TYPES.includes(form.type)"
          level="info"
          class="mt-2 border bg-[--border-color-subtle] p-3 rounded-xl"
        >
          Note that Boost is not available for this voting type.
        </BaseMessage>
      </template>

      <h4 class="mb-1 mt-3" v-text="$t('create.choices')" />
      <div class="flex">
        <div class="w-full overflow-hidden">
          <draggable
            v-model="form.choices"
            v-bind="{ animation: 200 }"
            :disabled="disableChoiceEdit"
            item-key="id"
            handle=".drag-handle"
            class="space-y-2"
          >
            >
            <template #item="{ element, index }">
              <UiInput
                v-model="element.text"
                maxlength="32"
                :disabled="disableChoiceEdit"
                :placeholder="index > 0 ? $t('optional') : ''"
                class="group"
                :focus-on-mount="index === 0"
                :data-testid="`input-proposal-choice-${index}`"
              >
                <template #label>
                  <div
                    class="drag-handle flex cursor-grab items-center active:cursor-grabbing"
                    :class="{
                      'cursor-not-allowed active:cursor-not-allowed':
                        disableChoiceEdit
                    }"
                  >
                    <BaseIcon name="draggable" size="16" class="mr-[12px]" />
                    {{ $tc('create.choice', [index + 1]) }}
                  </div>
                </template>
                <template #info>
                  <span
                    class="hidden text-xs text-skin-text whitespace-nowrap group-focus-within:block"
                  >
                    {{ `${element.text.length}/32` }}
                  </span>
                </template>
              </UiInput>
            </template>
          </draggable>
        </div>
        <div v-if="!disableChoiceEdit" class="ml-2 flex w-[48px] items-end">
          <BaseButtonRound
            v-if="!disableChoiceEdit"
            size="42px"
            @click="addChoices(1)"
          >
            <i-ho-plus-sm class="text-skin-link" />
          </BaseButtonRound>
        </div>
      </div>
    </BaseBlock>

    <BaseBlock
      :title="$t('create.period')"
      :information="$t('create.votingPeriodExplainer')"
    >
      <div class="space-y-2 md:flex md:space-x-3 md:space-y-0">
        <SpaceCreateVotingDateStart
          :delay="space.voting?.delay"
          :date="dateStart"
          :is-editing="isEditing"
          @select="value => setDateStart(value)"
        />

        <SpaceCreateVotingDateEnd
          :period="space.voting?.period"
          :date="dateEnd"
          :is-editing="isEditing"
          @select="value => setDateEnd(value)"
        />
      </div>
    </BaseBlock>

    <BaseBlock v-if="$route.query.snapshot" :title="$t('snapshot')">
      <UiInput
        v-model="form.snapshot"
        :number="true"
        :placeholder="$t('create.snapshotBlock')"
      >
        <template #label>
          {{ $t('snapshot') }}
        </template>
      </UiInput>
    </BaseBlock>
  </div>
</template>
