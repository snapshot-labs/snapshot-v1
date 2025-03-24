<script setup lang="ts">
import { debouncedWatch } from '@vueuse/core';
import { getAddress, isAddress } from '@ethersproject/address';
import networks from '@snapshot-labs/snapshot.js/src/networks.json';
import {
  getScores,
  getDelegatesBySpace
} from '@snapshot-labs/snapshot.js/src/utils';
import { getDelegates, getDelegators } from '@/helpers/delegation';
import { shorten } from '@/helpers/utils';
import { SPACE_DELEGATE_QUERY } from '@/helpers/queries';

const route = useRoute();
const { t } = useI18n();
const { web3Account } = useWeb3();
const { formatCompactNumber } = useIntl();
const { modalAccountOpen } = useModal();
const { delegateTo, delegationLoading, networkSupportsDelegate, networkKey } =
  useDelegate();

const modalOpen = ref(false);
const currentId = ref('');
const currentDelegate = ref('');
const loaded = ref(false);
const delegatesLoading = ref(false);
const delegates = ref<any[]>([]);
const delegatesWithScore = ref<any[]>([]);
const delegators = ref<any[]>([]);
const specifySpaceChecked = ref(false);
const space = ref();
const form = ref({
  address: (route.params.to as string) || '',
  id: (route.params.key as string) || ''
});
const delegationLoadingError = ref(false);

const { profiles, loadProfiles } = useProfiles();

const { loadOwnedEnsDomains, ownedEnsDomains, validEnsTlds, isValidEnsDomain } =
  useEns();

const isEnsOwnedByWeb3Account = computed(() =>
  ownedEnsDomains.value.map(d => d.name).includes(form.value.address)
);

const validateSpaceInput = computed(() => {
  if (space.value === null) return t('delegate.noValidSpaceId');
  return '';
});

const validateToInput = computed(() => {
  if (form.value.address === '') return '';
  const address = form.value.address;
  if (!isValidEnsDomain(address) && !isAddress(address)) {
    if (address.includes('.'))
      return `${t('delegate.noValidEns')} ${t(
        'setup.supportedEnsTLDs'
      )}: ${validEnsTlds.join(', ')}`;
    else return t('delegate.noValidAddress');
  }
  if (address.toLowerCase() === web3Account.value.toLowerCase())
    return t('delegate.delegateToSelf');
  if (isEnsOwnedByWeb3Account.value) return t('delegate.delegateToSelfAddress');
  return '';
});

watch(
  web3Account,
  () => {
    loadOwnedEnsDomains(web3Account.value);
  },
  { immediate: true }
);

const isValidForm = computed(() => {
  const address = form.value.address;
  return (
    (isValidEnsDomain(address) || isAddress(address)) &&
    address.toLowerCase() !== web3Account.value.toLowerCase() &&
    (!specifySpaceChecked.value || space.value?.id === form.value.id) &&
    !isEnsOwnedByWeb3Account.value
  );
});

function revokeDelegate(id, delegate) {
  currentId.value = id;
  currentDelegate.value = delegate;
  modalOpen.value = true;
}

watch([networkKey, web3Account], ([valN, valA], [prevN, prevA]) => {
  if (valN !== prevN || valA?.toLowerCase() !== prevA)
    getDelegationsAndDelegates();
});

const getDelegationsAndDelegatesLoading = ref(false);

async function getDelegationsAndDelegates() {
  if (web3Account.value) {
    try {
      delegationLoadingError.value = false;
      getDelegationsAndDelegatesLoading.value = true;
      const [delegatesObj, delegatorsObj] = await Promise.all([
        getDelegates(networkKey.value, web3Account.value),
        getDelegators(networkKey.value, web3Account.value)
      ]);
      delegates.value = delegatesObj.delegations;
      delegators.value = delegatorsObj.delegations;
    } catch (error) {
      delegates.value = [];
      delegators.value = [];
      console.log(error);
      delegationLoadingError.value = true;
    } finally {
      getDelegationsAndDelegatesLoading.value = false;
    }
  } else {
    // user logged out
    delegates.value = [];
    delegators.value = [];
  }
}

const delegationStrategies = [
  'delegation',
  'erc20-balance-of-delegation',
  'delegation-with-cap',
  'delegation-with-overrides',
  'with-delegation',
  'erc20-balance-of-delegation-with-delegation'
];

async function getDelegatesWithScore() {
  const delegationStrategy = space.value.strategies.filter(strategy =>
    delegationStrategies.includes(strategy.name)
  );
  if (delegationStrategy.length === 0) return;

  delegationLoadingError.value = false;
  delegatesLoading.value = true;
  try {
    const delegations: any = await getDelegatesBySpace(
      space.value.network,
      space.value.id,
      'latest'
    );

    const uniqueDelegators = Array.from(
      new Set(delegations.map(d => d.delegate))
    )
      .map(delegate => {
        return delegations.find(a => a.delegate === delegate);
      })
      .map(delegation => {
        return {
          ...delegation,
          delegate: getAddress(delegation.delegate),
          delegator: getAddress(delegation.delegator)
        };
      });

    const delegatesAddresses = uniqueDelegators.map(d => d.delegate);

    const scores = await getScores(
      space.value.id,
      delegationStrategy,
      space.value.network,
      delegatesAddresses,
      'latest',
      `${import.meta.env.VITE_SCORES_URL}/api/scores`
    );

    uniqueDelegators.forEach(delegate => {
      delegate.score = 0;
      scores.forEach(delegationScore => {
        Object.entries(delegationScore).forEach(([address, score]) => {
          if (address === delegate.delegate) {
            delegate.score += score;
          }
        });
      });
    });

    const sortedDelegates = uniqueDelegators
      .filter(delegate => delegate.score > 0)
      .sort((a, b) => b.score - a.score);

    delegatesWithScore.value = sortedDelegates;
    delegatesLoading.value = false;
  } catch (e) {
    delegatesLoading.value = false;
    delegationLoadingError.value = true;
    console.log(e);
    return e;
  }
}

async function handleSubmit() {
  await delegateTo(form.value.address, form.value.id);
  getDelegationsAndDelegates();
}

watch(
  delegates,
  () => {
    loadProfiles(
      delegates.value
        .map(delegate => delegate.delegate)
        .concat(delegators.value.map(delegator => delegator.delegator))
        .concat(delegatesWithScore.value.map(delegate => delegate.delegate))
    );
  },
  { immediate: true }
);

const { apolloQuery, queryLoading: spaceLoading } = useApolloQuery();

debouncedWatch(
  () => form.value.id,
  async () => {
    if (!form.value.id) return;
    space.value = await apolloQuery(
      {
        query: SPACE_DELEGATE_QUERY,
        variables: {
          id: form.value.id
        }
      },
      'space'
    );
    if (space.value?.id === form.value?.id) {
      delegatesWithScore.value = [];
      getDelegatesWithScore();
    } else delegatesWithScore.value = [];
  },
  { immediate: true, debounce: 500 }
);

onMounted(async () => {
  if (route.params.key) specifySpaceChecked.value = true;
  await getDelegationsAndDelegates();
  loaded.value = true;
});
</script>

<template>
  <TheLayout v-bind="$attrs">
    <template #content-left>
      <div class="mb-3 px-4 md:px-0">
        <ButtonBack @click="$router.go(-1)" />
        <h1 v-if="loaded" v-text="$t('delegate.header')" />
      </div>
      <LoadingPage v-if="!loaded" />
      <BaseBlock v-else-if="!networkSupportsDelegate">
        <BaseIcon name="warning" class="mr-1" />
        {{
          $t('delegate.delegateNotSupported', {
            network:
              networks?.[networkKey]?.shortName ?? $t('theCurrentNetwork')
          })
        }}
        <BaseLink
          class="ml-1 whitespace-nowrap"
          :link="`https://docs.snapshot.org/guides/delegation#supported-networks`"
          @click.stop
        >
          {{ $t('learnMore') }}
        </BaseLink>
      </BaseBlock>
      <div v-else class="space-y-3">
        <BaseBlock>
          <div class="space-y-2">
            <BaseInput
              v-model.trim="form.address"
              :title="$t('delegate.to')"
              :placeholder="$t('delegate.addressPlaceholder')"
              :error="{ message: validateToInput }"
            />
            <div class="flex items-center space-x-2 px-2">
              <InputSwitch v-model="specifySpaceChecked" />
              <span>{{ $t('setDelegationToSpace') }}</span>
            </div>
            <BaseInput
              v-show="specifySpaceChecked"
              v-model.trim="form.id"
              :title="$t('space')"
              :loading="spaceLoading"
              placeholder="e.g. balancer.eth"
              :error="{ message: validateSpaceInput }"
            />
          </div>
        </BaseBlock>
        <BaseBlock
          v-if="
            delegates.length < 1 &&
            delegators.length < 1 &&
            !getDelegationsAndDelegatesLoading &&
            web3Account
          "
        >
          <BaseIcon name="warning" class="mr-1" />
          {{ $t('delegate.noDelegationsAndDelegates') }}
        </BaseBlock>
        <BaseBlock
          v-if="delegates.length > 0"
          :slim="true"
          :title="$t('delegate.delegations')"
        >
          <div
            v-for="(delegate, i) in delegates"
            :key="i"
            class="flex border-t px-4 py-3"
            :class="{ '!border-0': i === 0 }"
          >
            <BaseUser
              :address="delegate.delegate"
              :space="{ network: networkKey }"
              :profile="profiles[delegate.delegate]"
            />
            <div
              class="flex-auto text-right text-skin-link"
              v-text="shorten(delegate.space || $t('allSpaces'), 'choice')"
            />
            <a
              class="-mr-2 ml-2 px-2"
              @click="revokeDelegate(delegate.space, delegate.delegate)"
            >
              <BaseIcon name="close" size="12" class="mb-1" />
            </a>
          </div>
        </BaseBlock>
        <BaseBlock
          v-if="delegators.length > 0"
          :slim="true"
          :title="$t('delegate.delegated')"
        >
          <div
            v-for="(delegator, i) in delegators"
            :key="i"
            :class="{ '!border-0': i === 0 }"
            class="flex border-t px-4 py-3"
          >
            <BaseUser
              :address="delegator.delegator"
              :space="{ network: networkKey }"
              :profile="profiles[delegator.delegator]"
            />
            <div
              class="flex-auto text-right text-skin-link"
              v-text="shorten(delegator.space || '-', 'choice')"
            />
          </div>
        </BaseBlock>
        <BaseBlock
          v-if="space?.id && specifySpaceChecked"
          :title="$tc('delegate.topDelegates')"
          :loading="delegatesLoading"
          slim
        >
          <div
            v-for="(delegate, i) in delegatesWithScore"
            :key="i"
            :class="{ '!border-0': i === 0 }"
            class="flex border-t px-4 py-3"
          >
            <BaseUser
              :profile="profiles[delegate.delegate]"
              :space="{ network: networkKey }"
              :address="delegate.delegate"
              class="w-[160px]"
            />
            <div
              class="w-[160px] flex-auto text-right text-skin-link"
              v-text="
                `${
                  delegate.score >= 0.005
                    ? formatCompactNumber(delegate.score)
                    : '< 0.01'
                } ${space.symbol}`
              "
            />
          </div>

          <div
            v-if="delegationLoadingError"
            class="mx-4 flex items-center py-3 text-red"
          >
            <BaseIcon name="warning" class="mr-1" /> Error while retrieving the
            delegates list
          </div>
          <div
            v-else-if="!delegatesLoading && delegatesWithScore.length < 1"
            class="mx-4 flex items-center py-3"
          >
            {{ $tc('delegate.noDelegatesFoundFor', [space.id]) }}
          </div>
        </BaseBlock>
      </div>
    </template>
    <template v-if="networkSupportsDelegate" #sidebar-right>
      <BaseBlock class="mt-4 lg:mt-0">
        <TuneButton
          :disabled="!isValidForm && !!web3Account"
          :loading="delegationLoading"
          class="block w-full"
          primary
          @click="web3Account ? handleSubmit() : (modalAccountOpen = true)"
        >
          {{ $t('confirm') }}
        </TuneButton>
      </BaseBlock>
    </template>
  </TheLayout>
  <teleport
    v-if="networkSupportsDelegate && profiles[currentDelegate]"
    to="#modal"
  >
    <ModalRevokeDelegate
      v-if="loaded"
      :id="currentId"
      :open="modalOpen"
      :delegate="currentDelegate"
      :profile="profiles[currentDelegate]"
      @close="modalOpen = false"
      @reload="getDelegationsAndDelegates"
    />
  </teleport>
</template>
