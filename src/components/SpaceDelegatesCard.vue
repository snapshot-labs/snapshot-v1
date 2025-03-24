<script setup lang="ts">
import { explorerUrl } from '@/helpers/utils';
import {
  DelegateWithPercent,
  Profile,
  ExtendedSpace
} from '@/helpers/interfaces';

const props = defineProps<{
  delegate: DelegateWithPercent;
  profiles: Record<string, Profile>;
  space: ExtendedSpace;
  stats?: {
    votes: number;
    proposals: number;
  };
  about?: string;
}>();

const emit = defineEmits(['clickDelegate', 'clickUser']);

const { getUsername } = useUsername();
const { formatCompactNumber, formatNumber } = useIntl();
const { formatPercentageNumber } = useStatement();
const router = useRouter();

const dropdownItems = computed(() => [
  {
    text: 'View profile',
    action: 'viewProfile'
  },
  {
    text: 'See explorer',
    action: 'seeExplorer'
  }
]);

function handleDropdownAction(action: string) {
  if (action === 'viewProfile') {
    router.push({
      name: 'profileActivity',
      params: {
        address: props.delegate.id
      }
    });
  }
  if (action === 'seeExplorer') {
    window.open(
      explorerUrl(props.space.network, props.delegate.id),
      '_blank',
      'noopener,noreferrer'
    );
  }
}
</script>

<template>
  <button
    type="button"
    class="flex h-full w-full flex-col justify-between rounded-xl border border-skin-border px-3 pb-3 pt-[12px] md:px-3 md:pb-3 md:pt-[12px]"
    @click="emit('clickUser')"
  >
    <div class="flex w-full">
      <div class="flex items-center text-left gap-3 flex-auto min-w-0">
        <AvatarUser :address="delegate.id" size="40" class="shrink-0" />
        <div class="flex flex-col truncate grow">
          <div class="flex truncate gap-1">
            <div class="font-semibold text-skin-heading truncate flex-auto">
              {{ getUsername(delegate.id, profiles[delegate.id]) }}
            </div>
            <BaseMenu
              :items="dropdownItems"
              @select="handleDropdownAction($event)"
              @click.stop
            >
              <template #button>
                <BaseButtonIcon class="-mr-[6px] !h-[24px]">
                  <i-ho-dots-horizontal class="text-[17px]" />
                </BaseButtonIcon>
              </template>
              <template #item="{ item }">
                <div class="w-[170px] text-skin-link">
                  <span class="flex items-center gap-1">
                    {{ item.text }}
                    <i-ho-external-link
                      v-if="item.action === 'seeExplorer'"
                      class="text-sm"
                    />
                  </span>
                </div>
              </template>
            </BaseMenu>
          </div>
          <div class="flex gap-x-[6px] flex-wrap">
            <div
              v-tippy="{
                content: `${formatNumber(
                  Number(delegate.delegatedVotes)
                )} (${formatPercentageNumber(delegate.votesPercentage)})`
              }"
              class="cursor-help text-skin-text"
            >
              {{ formatCompactNumber(Number(delegate.delegatedVotes)) }}
              {{ space.symbol }}
            </div>
            ·
            <div
              v-tippy="{
                content: formatPercentageNumber(delegate.delegatorsPercentage)
              }"
              class="cursor-help"
            >
              {{
                formatCompactNumber(
                  Number(delegate.tokenHoldersRepresentedAmount)
                )
              }}
              delegators
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="mt-3 h-[48px] cursor-pointer">
      <template v-if="about">
        <span class="line-clamp-2 break-words text-left">
          {{ about }}
        </span>
      </template>
    </div>

    <div class="mt-3 flex gap-[6px]">
      <div>
        {{ formatCompactNumber(stats?.votes || 0) }}
        votes
      </div>
      ·
      <div>
        {{ formatCompactNumber(stats?.proposals || 0) }}
        proposals
      </div>
    </div>

    <TuneButton
      class="mt-3 w-full text-skin-link"
      @click.stop="emit('clickDelegate')"
    >
      Delegate
    </TuneButton>
  </button>
</template>
