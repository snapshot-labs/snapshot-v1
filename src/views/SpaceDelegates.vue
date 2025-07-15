<script setup lang="ts">
import { SNAPSHOT_HELP_LINK } from '@/helpers/constants';
import { ExtendedSpace } from '@/helpers/interfaces';
import { useInfiniteScroll, refDebounced } from '@vueuse/core';
import { DelegationTypes } from '@/helpers/delegationV2';
import SpaceDelegatesSplitDelegationModal from '@/components/SpaceDelegatesSplitDelegationModal.vue';
import SpaceDelegatesDelegateModal from '@/components/SpaceDelegatesDelegateModal.vue';

const props = defineProps<{
  space: ExtendedSpace;
}>();

const {
  loadDelegate,
  loadDelegates,
  fetchMoreDelegates,
  delegate,
  delegates,
  isLoadingDelegates,
  isLoadingDelegate,
  hasMoreDelegates,
  delegatesStats,
  hasDelegatesLoadFailed,
  hasDelegationPortal
} = useDelegates(props.space);
const { profiles, loadProfiles } = useProfiles();
const { modalAccountOpen } = useModal();
const route = useRoute();
const router = useRouter();
const { t } = useI18n();
const { isFollowing } = useFollowSpace(props.space.id);
const { web3Account } = useWeb3();
const { getStatement, loadStatements } = useStatement();

const searchInput = ref((route.query.search as string) || '');
const searchInputDebounced = refDebounced(searchInput, 300);
const selectedFilter = ref(route.query.filter || 'mostVotingPower');

const isSplitDelegation = computed(() => {
  return (
    props.space.delegationPortal.delegationType ===
    DelegationTypes.SPLIT_DELEGATION
  );
});

const matchFilter = computed(() => {
  switch (selectedFilter.value) {
    case 'mostDelegators':
      return 'tokenHoldersRepresentedAmount';
    case 'mostProposals':
      return 'proposalsCount';
    case 'mostVotes':
      return 'votesCount';
    default:
      return 'delegatedVotes';
  }
});

const filterItems = computed(() => {
  return [
    {
      action: 'mostVotingPower',
      text: t('delegates.filters.mostVotingPower')
    },
    {
      action: 'mostDelegators',
      text: t('delegates.filters.mostDelegators')
    }
  ];
});

function handleSearchInput(value: string) {
  searchInput.value = value;
  router.push({
    query: {
      ...route.query,
      search: value || undefined
    }
  });
}

function handleSelectFilter(e: string) {
  selectedFilter.value = e;
  router.push({
    query: {
      ...route.query,
      filter: e
    }
  });
}

function handleClickDelegate(id = '') {
  if (!web3Account.value) {
    modalAccountOpen.value = true;
    return;
  }

  router.push({
    query: {
      ...route.query,
      delegate: id
    }
  });
}

function handleCloseModalDelegate() {
  router.push({
    query: {
      ...route.query,
      delegate: undefined
    }
  });
}

function handleClickProfile(id: string) {
  router.push({
    name: 'spaceDelegate',
    params: {
      address: id.toLowerCase()
    }
  });
}

useInfiniteScroll(
  document,
  () => {
    if (hasMoreDelegates.value && !searchInput.value)
      fetchMoreDelegates(matchFilter.value);
  },
  { distance: 500 }
);

watch(searchInputDebounced, async () => {
  await loadDelegate(searchInput.value);
});

watch(matchFilter, () => {
  loadDelegates(matchFilter.value);
});

watch(delegates, delegates => {
  const ids = delegates.map(d => d.id);
  loadStatements(props.space.id, ids);
  loadProfiles(ids);
});

onMounted(() => {
  if (!hasDelegationPortal) return;

  if (searchInput.value) loadDelegate(searchInput.value);
  loadDelegates(matchFilter.value);
});
</script>

<template>
  <TheLayout>
    <template #sidebar-left>
      <SpaceSidebar :space="space" />
    </template>
    <template #content-right>
      <div class="mb-[80px] md:mb-0">
        <h1 class="hidden lg:mb-3 lg:block">
          {{ $t('delegates.header') }}
        </h1>

        <div class="mb-4">
          <div class="justify-between px-[20px] md:flex md:px-0">
            <div class="flex gap-2 sm:gap-[12px]">
              <div
                class="flex w-full rounded-full border pl-3 pr-0 focus-within:border-skin-text md:w-[250px] lg:w-[280px]"
              >
                <BaseSearch
                  :model-value="searchInput"
                  :placeholder="$t('searchPlaceholderVotes')"
                  class="flex-auto pr-2"
                  :is-disabled="!hasDelegationPortal"
                  @update:model-value="handleSearchInput"
                />
              </div>
              <BaseMenu
                :items="filterItems"
                :disabled="!hasDelegationPortal"
                @select="handleSelectFilter"
              >
                <template #button>
                  <div>
                    <TuneButton
                      class="hidden items-center sm:flex"
                      :disabled="!hasDelegationPortal"
                    >
                      <div class="whitespace-nowrap">
                        {{
                          filterItems.find(i => i.action === selectedFilter)
                            ?.text
                        }}
                      </div>
                      <i-ho-chevron-down
                        class="-mr-1 ml-1 text-xs"
                        :class="{ 'text-skin-link': hasDelegationPortal }"
                      />
                    </TuneButton>

                    <BaseButtonRound class="sm:hidden">
                      <i-ho-sort-descending class="text-skin-text" />
                    </BaseButtonRound>
                  </div>
                </template>
                <template #item="{ item }">
                  <div class="flex items-center">
                    {{ item.text }}
                    <i-ho-check
                      v-if="item.action === selectedFilter"
                      class="ml-2 shrink-0 !text-green text-skin-text"
                    />
                  </div>
                </template>
              </BaseMenu>
            </div>
            <div class="flex justify-center gap-[12px]">
              <TheActionbar break-point="md">
                <div
                  class="flex h-full items-center gap-[12px] px-[20px] py-[16px] md:py-0 md:px-0"
                >
                  <SpaceDelegatesAccount
                    v-if="web3Account"
                    @click="handleClickProfile(web3Account)"
                  />
                  <TuneButton
                    :disabled="!hasDelegationPortal"
                    :primary="isFollowing"
                    class="w-full md:w-auto"
                    @click="handleClickDelegate()"
                  >
                    Delegate
                  </TuneButton>
                </div>
              </TheActionbar>
            </div>
          </div>
        </div>
        <BaseMessageBlock v-if="!hasDelegationPortal" level="warning-red">
          This space has misconfigured or not setup their delegation portal
        </BaseMessageBlock>
        <BaseMessageBlock
          v-else-if="hasDelegatesLoadFailed"
          level="warning-red"
        >
          An error occurred while loading delegates. Please try again later. If
          the problem persists, consider contacting our support team on
          <BaseLink :link="SNAPSHOT_HELP_LINK">Help Center</BaseLink>
        </BaseMessageBlock>
        <template v-else-if="searchInputDebounced">
          <div
            class="mx-[20px] grid grid-cols-1 gap-3 md:mx-0 lg:grid-cols-2"
            :class="{ 'opacity-40': isLoadingDelegate }"
          >
            <SpaceDelegatesSkeleton v-if="isLoadingDelegate" />
            <SpaceDelegatesCard
              v-else-if="delegate"
              :delegate="delegate"
              :profiles="profiles"
              :space="space"
              :about="getStatement(delegate.id).about"
              :stats="delegatesStats[delegate.id]"
              class="border-b"
              @click-delegate="handleClickDelegate(delegate.id)"
              @click-user="handleClickProfile(delegate.id)"
            />
          </div>
          <BaseNoResults v-if="!delegate" use-block />
        </template>
        <template v-else>
          <div
            class="mx-[20px] grid grid-cols-1 gap-3 md:mx-0 lg:grid-cols-2"
            :class="{ 'opacity-40': isLoadingDelegates }"
          >
            <SpaceDelegatesSkeleton v-if="isLoadingDelegates" />
            <template v-else>
              <div
                v-for="(d, i) in delegates"
                :key="i"
                class="last:border-b md:last:border-b-0"
              >
                <SpaceDelegatesCard
                  :delegate="d"
                  :profiles="profiles"
                  :space="space"
                  :about="getStatement(d.id).about"
                  :stats="delegatesStats[d.id]"
                  @click-delegate="handleClickDelegate(d.id)"
                  @click-user="handleClickProfile(d.id)"
                />
              </div>
            </template>
          </div>
          <div v-if="hasMoreDelegates" class="mt-4 flex">
            <LoadingSpinner class="mx-auto" big />
          </div>
          <BaseNoResults
            v-else-if="!delegates.length && !isLoadingDelegates"
            use-block
          />
        </template>
      </div>
    </template>
    <Teleport to="#modal">
      <component
        :is="
          isSplitDelegation
            ? SpaceDelegatesSplitDelegationModal
            : SpaceDelegatesDelegateModal
        "
        v-if="hasDelegationPortal"
        :open="route.query.delegate !== undefined"
        :space="space"
        :address="(route.query.delegate as string) || ''"
        @close="handleCloseModalDelegate"
        @reload="loadDelegates(matchFilter)"
      />
    </Teleport>
  </TheLayout>
</template>
