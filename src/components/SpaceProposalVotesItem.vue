<script lang="ts" setup>
import { ExtendedSpace, Proposal, Vote, Profile } from '@/helpers/interfaces';
import { shorten, getIpfsUrl } from '@/helpers/utils';

const props = defineProps<{
  space: ExtendedSpace;
  proposal: Proposal;
  vote: Vote;
  profiles: Record<string, Profile>;
  isSmall: boolean;
}>();

defineEmits(['openReceiptModal']);

const relayerIpfsHash = ref('');

const titles = computed(() =>
  props.proposal.strategies.map(strategy => strategy.params.symbol || '')
);

const { formatCompactNumber } = useIntl();

const balanceFormatted = computed(() => {
  const balance = formatCompactNumber(props.vote.balance);
  return balance.length >= 8 ? shorten(balance) : balance;
});
</script>

<template>
  <div class="py-[12px]" :class="{ 'py-[8px]': isSmall }">
    <div
      class="flex items-center gap-4"
      :class="{ 'justify-between': isSmall }"
    >
      <BaseUser
        :key="vote.voter"
        :profile="profiles[vote.voter]"
        :address="vote.voter"
        :space="{ network: props.space.network }"
        :proposal="proposal"
        :width-class="
          isSmall
            ? 'w-[136px] min-w-[136px] text-left'
            : 'w-[200px] min-w-[200px] text-left'
        "
      />

      <SpaceProposalVotesListItemChoice
        v-if="!isSmall"
        :proposal="proposal"
        :vote="vote"
      />
      <div
        class="flex w-[130px] min-w-[130px] items-center justify-end whitespace-nowrap text-right text-skin-link"
      >
        <span
          v-tippy="{
            content: vote.scores
              ?.map(
                (score, index) =>
                  `${formatCompactNumber(score)} ${titles[index]}`
              )
              .join(' + ')
          }"
          class="truncate"
        >
          {{
            `${balanceFormatted} ${shorten(
              proposal.symbol || space.symbol,
              'symbol'
            )}`
          }}
        </span>
        <BasePopover>
          <template #button>
            <BaseButtonIcon class="!p-0 ml-1">
              <BaseIcon name="signature" />
            </BaseButtonIcon>
          </template>
          <template #content>
            <div class="m-4 space-y-4">
              <h3 class="text-center">{{ $t('receipt') }}</h3>
              <BaseBlock slim class="p-4 text-skin-link">
                <div class="flex">
                  <span
                    class="mr-1 flex-auto text-skin-text"
                    v-text="$t('author')"
                  />
                  <BaseLink
                    :link="getIpfsUrl(vote.ipfs)"
                    class="text-skin-link"
                  >
                    #{{ vote.ipfs.slice(0, 7) }}
                  </BaseLink>
                </div>
                <div v-if="relayerIpfsHash" class="flex">
                  <span
                    class="mr-1 flex-auto text-skin-text"
                    v-text="$t('relayer')"
                  />
                  <BaseLink
                    :link="getIpfsUrl(relayerIpfsHash)"
                    class="text-skin-link"
                  >
                    #{{ relayerIpfsHash.slice(0, 7) }}
                  </BaseLink>
                </div>
              </BaseBlock>
              <BaseLink
                :link="`https://signator.io/ipfs/${vote.ipfs}`"
                class="mb-2 block"
                hide-external-icon
              >
                <TuneButton class="w-full" tabindex="-1">
                  {{ $t('verifyOnSignatorio') }}
                  <i-ho-external-link
                    class="mb-[2px] ml-1 inline-block text-xs"
                  />
                </TuneButton>
              </BaseLink>
            </div>
          </template>
        </BasePopover>
      </div>
    </div>

    <SpaceProposalVotesListItemChoice
      v-if="isSmall"
      :proposal="proposal"
      :vote="vote"
      class="mt-1"
    />
  </div>
</template>
