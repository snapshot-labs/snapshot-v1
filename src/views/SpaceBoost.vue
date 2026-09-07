<script setup lang="ts">
import { BigNumber } from '@ethersproject/bignumber';
import { parseUnits, formatEther, formatUnits } from '@ethersproject/units';
import { getInstance } from '@snapshot-labs/lock/plugins/vue3';
import { ExtendedSpace } from '@/helpers/interfaces';
import {
  createBoost,
  SNAPSHOT_GUARD_ADDRESS,
  BOOST_CONTRACTS,
  BOOST_VERSION,
  getFees
} from '@/helpers/boost';
import { TWO_WEEKS, ONE_DAY, PROVIDER_OPTIONS } from '@/helpers/constants';
import getProvider from '@snapshot-labs/snapshot.js/src/utils/provider';
import { getProposal } from '@/helpers/snapshot';
import { Token } from '@/helpers/alchemy';
import { sendApprovalTransaction } from '@/helpers/transaction';
import { pinGraph } from '@/helpers/pin';
import { BoostStrategy } from '@/helpers/boost/types';
import { isExcludedToken } from '@/helpers/boost/tokens';

const DISTRIBUTION_TYPE_ITEMS = [
  {
    value: 'lottery' as const,
    name: 'Lottery',
    description: 'Randomly selected based on voting power.'
  },
  {
    value: 'weighted' as const,
    name: 'Proportional',
    description: 'Distributed to voters based on voting power.'
  }
];

const props = defineProps<{
  space: ExtendedSpace;
}>();

type Form = {
  eligibility: {
    choice: 'any' | 'prediction' | number;
  };
  distribution: {
    type: 'lottery' | 'weighted';
    hasWeightedLimit: boolean;
    weightedLimit: string;
    hasLotteryLimit: boolean;
    lotteryLimit: string;
    numWinners: string | undefined;
  };
  network: string;
  token?: Token;
  amount: string;
};

const route = useRoute();
const router = useRouter();
const auth = getInstance();
const { web3Account, web3 } = useWeb3();
const { account, updatingAccount, updateAccount } = useAccount();
const { modalAccountOpen } = useModal();
const { getRelativeProposalPeriod } = useIntl();
const { env } = useApp();
const { formatNumber, getNumberFormatter } = useIntl();
const { loadBalances, tokens, loading: loadingBalances } = useBalances();

const proposal = ref();
const createStatus = ref('');
const createTx = ref();
const approveTx = ref();
const modalWrongNetworkOpen = ref(false);
const showFormErrors = ref(false);
const ethFee = ref('');
const tokenFeePercent = ref('');
const loadingFees = ref(false);
const form = ref<Form>({
  eligibility: {
    choice: 'any'
  },
  distribution: {
    type: 'lottery',
    hasWeightedLimit: false,
    weightedLimit: '',
    hasLotteryLimit: false,
    lotteryLimit: '',
    numWinners: '1'
  },
  network: '1',
  token: undefined,
  amount: ''
});

const formToken = computed(() => form.value.token);

const isWrongNetwork = computed(() => {
  return form.value.network !== web3.value.network.key.toString();
});

const bribeEnabled = computed(() => {
  return (
    proposal.value.privacy !== 'shutter' &&
    props.space.boost.bribeEnabled &&
    ['basic', 'single-choice'].includes(proposal.value.type)
  );
});

const eligibilityOptions = computed(() => {
  const proposalChoices = proposal.value?.choices.map(
    (choice: string, index: number) => {
      return {
        value: index + 1,
        label: `Who votes '${choice}'`,
        extras: {
          disabled: !bribeEnabled.value
        }
      };
    }
  );

  return [
    {
      value: 'any',
      label: 'Anyone who votes'
    },
    {
      value: 'prediction',
      label: 'Anyone who votes for the winning choice'
    },
    ...proposalChoices
  ];
});

const isLoading = computed(() => {
  return loadingBalances.value || updatingAccount.value || loadingFees.value;
});

const isValidForm = computed(() => {
  if (Object.keys(formValidation.value).length > 0) return false;
  return true;
});

const createStatusModalConfig = computed(() => {
  switch (createStatus.value) {
    case 'approve':
      return {
        title: 'Approve spending token',
        subtitle: 'Please approve on your wallet.',
        variant: 'loading' as const
      };
    case 'confirm':
      return {
        title: 'Confirm token deposit',
        subtitle: 'Please confirm deposit on your wallet.',
        variant: 'loading' as const
      };
    case 'pending':
      return {
        title: 'Transaction pending',
        subtitle: createTx.value?.hash || approveTx.value?.hash || '',
        variant: 'loading' as const
      };
    case 'success':
      return {
        title: 'Well done! 🥳',
        subtitle: 'Your boost was successfully created.',
        variant: 'success' as const
      };
    case 'error':
      return {
        title: 'Transaction failed',
        subtitle:
          createTx.value?.hash ||
          approveTx.value?.hash ||
          'Oops... Your boost creation failed!',
        variant: 'error' as const
      };
    case 'pinning':
      return {
        title: 'Pinning boost',
        subtitle: 'Please wait while we pin the boost on IPFS.',
        variant: 'loading' as const
      };
    default:
      return undefined;
  }
});

const strategyDistributionLimit = computed(() => {
  if (
    form.value.distribution.type === 'lottery' &&
    form.value.distribution.lotteryLimit
  ) {
    const limitWithTwoDecimals = Number(
      Number(form.value.distribution.lotteryLimit).toFixed(2)
    );

    return ((limitWithTwoDecimals || 0) * 100).toString();
  }
  if (
    form.value.distribution.type === 'weighted' &&
    form.value.distribution.weightedLimit
  ) {
    return parseUnits(
      form.value.distribution.weightedLimit || '0',
      formToken.value?.decimals ?? '18'
    ).toString();
  }
  return undefined;
});

const strategy = computed<BoostStrategy>(() => {
  let choice;
  let eligibilityType;

  switch (form.value.eligibility.choice) {
    case 'any':
      eligibilityType = 'incentive';
      break;
    case 'prediction':
      eligibilityType = 'prediction';
      break;
    default:
      choice = form.value.eligibility.choice.toString();
      eligibilityType = 'bribe';
  }

  const numWinners =
    form.value.distribution.type === 'lottery'
      ? form.value.distribution.numWinners
      : undefined;

  return {
    name: 'Boost',
    description: 'Snapshot.org proposal boost',
    image: 'https://snapshot.org/boost.png',
    external_url: `https://snapshot.org/#/${props.space.id}/proposal/${proposal.value.id}`,
    strategyName: 'proposal',
    params: {
      version: BOOST_VERSION,
      env: env === 'demo' ? 'snapshot-testnet' : 'snapshot',
      proposal: proposal.value.id,
      eligibility: {
        type: eligibilityType,
        choice
      },
      distribution: {
        type: form.value.distribution.type,
        limit: strategyDistributionLimit.value,
        numWinners
      }
    }
  };
});

const isEndingSoon = computed(() => {
  if (!proposal.value) return false;
  const now = Math.floor(Date.now() / 1000);
  return proposal.value.end - now < ONE_DAY;
});

const amountParsed = computed(() => {
  try {
    return parseUnits(
      form.value.amount || '0',
      formToken.value?.decimals ?? '18'
    );
  } catch (e) {
    return BigNumber.from('0');
  }
});

const amountPerWinner = computed(() => {
  if (!amountParsed.value || !form.value.distribution.numWinners) return '0';
  const amountPer = amountParsed.value.div(
    Number(form.value.distribution.numWinners)
  );
  const formattedAmount = formatNumber(
    Number(formatUnits(amountPer, formToken.value?.decimals ?? '18')),
    getNumberFormatter({ maximumFractionDigits: 8 }).value
  );

  return formattedAmount;
});

const tokenFeeParsed = computed(() => {
  if (!tokenFeePercent.value || !amountParsed.value) return BigNumber.from('0');
  const feeAmount = amountParsed.value.div(100).mul(tokenFeePercent.value);
  return feeAmount.lte(0) ? BigNumber.from('0') : feeAmount;
});

const formValidation = computed(() => {
  const errors: Record<string, string> = {};

  if (form.value.distribution.hasWeightedLimit) {
    if (!form.value.distribution.weightedLimit) {
      errors.weightedLimit = 'Please enter a number or disable';
    } else if (Number(form.value.distribution.weightedLimit) <= 0) {
      errors.weightedLimit = 'Please enter a value greater than 0 or disable';
    }
  }

  if (form.value.distribution.hasLotteryLimit) {
    if (!form.value.distribution.lotteryLimit) {
      errors.lotteryLimit = 'Please enter a number or disable';
    } else if (Number(form.value.distribution.lotteryLimit) <= 0) {
      errors.lotteryLimit = 'Please enter a value greater than 0 or disable';
    } else if (Number(form.value.distribution.lotteryLimit) >= 100) {
      errors.lotteryLimit = 'Please enter a value less than 100%';
    } else if (Number(form.value.distribution.lotteryLimit) < 0.01) {
      errors.lotteryLimit = 'Please enter a value greater than 0.01%';
    }
  }

  if (!formToken.value) {
    errors.token = 'Please select a token';
  } else if (
    isExcludedToken(form.value.network, formToken.value.contractAddress)
  ) {
    errors.token = 'This token is not allowed';
  }

  if (!form.value.amount) {
    errors.amount = 'Please enter a value';
  } else if (amountParsed.value.lte(0)) {
    errors.amount = 'Please enter a value greater than 0';
  }

  if (formToken.value) {
    const balance = BigNumber.from(account.value.balance || '0');

    const amount = amountWithTokenFeeParsed.value;

    if (balance.lt(amount) && !isLoading.value) {
      errors.balance = 'Insufficient balance';
    }
  }

  if (form.value.distribution.type === 'lottery') {
    if (!form.value.distribution.numWinners) {
      errors.numWinners = 'Please enter a value';
    } else if (Number(form.value.distribution.numWinners) <= 0) {
      errors.numWinners = 'Please enter a value greater than 0';
    } else if (Number(form.value.distribution.numWinners) > 1e7) {
      errors.numWinners = 'Please enter a value less than 10,000,000';
    } else if (!Number.isInteger(Number(form.value.distribution.numWinners))) {
      errors.numWinners = 'Please enter a whole number without any decimals';
    }
  }

  return errors;
});

const formErrorMessages = computed(() => {
  return showFormErrors.value ? formValidation.value : {};
});

function retryCreation() {
  createStatus.value = '';
  handleCreate();
}

const amountWithTokenFeeParsed = computed(() => {
  return amountParsed.value.add(tokenFeeParsed.value).toString();
});

const requireApproval = computed(() =>
  BigNumber.from(account.value.allowance || '0').lt(
    amountWithTokenFeeParsed.value
  )
);

function setErrorStatus(error: string) {
  if (error?.includes('user rejected transaction')) {
    createStatus.value = '';
  } else {
    createStatus.value = 'error';
  }
}

async function loadFees() {
  try {
    loadingFees.value = true;
    const provider = getProvider(form.value.network, PROVIDER_OPTIONS);
    const response = await getFees(provider, form.value.network);
    ethFee.value = formatEther(response.ethFee);
    tokenFeePercent.value = (Number(response.tokenFeePercent) / 100).toString();
  } catch (e: any) {
    console.error('Error loading fees:', e);
  } finally {
    loadingFees.value = false;
  }
}

async function handleApproval() {
  createStatus.value = 'approve';

  try {
    approveTx.value = await sendApprovalTransaction(
      auth.web3,
      formToken.value!.contractAddress,
      BOOST_CONTRACTS[form.value.network],
      amountWithTokenFeeParsed.value
    );

    createStatus.value = 'pending';

    await approveTx.value.wait();

    await updateAccount(
      formToken.value!.contractAddress,
      form.value.network,
      BOOST_CONTRACTS[form.value.network]
    );
    handleCreate();
  } catch (e: any) {
    console.error('Approval error:', e);
    setErrorStatus(e.message);
  } finally {
    approveTx.value = undefined;
  }
}

async function handleCreate() {
  if (!web3Account.value) {
    modalAccountOpen.value = true;
    return;
  }
  if (!isValidForm.value) {
    showFormErrors.value = true;
    return;
  }
  if (isWrongNetwork.value) {
    modalWrongNetworkOpen.value = true;
    return;
  }
  if (requireApproval.value) {
    handleApproval();
    return;
  }

  try {
    createStatus.value = 'pinning';

    const { cid: ipfsHash } = await pinGraph(strategy.value);
    if (!ipfsHash) throw new Error('Error pinning the strategy');

    createStatus.value = 'confirm';
    createTx.value = await createBoost(
      auth.web3,
      form.value.network,
      ethFee.value,
      {
        strategyURI: `ipfs://${ipfsHash}`,
        token: formToken.value!.contractAddress,
        amount: amountWithTokenFeeParsed.value,
        guard: SNAPSHOT_GUARD_ADDRESS,
        start: proposal.value.end,
        end: proposal.value.end + TWO_WEEKS,
        owner: web3Account.value
      }
    );

    createStatus.value = 'pending';

    await createTx.value.wait();
    createStatus.value = 'success';
  } catch (e: any) {
    console.error('Create boost error:', e);
    setErrorStatus(e.message);
  } finally {
    createTx.value = undefined;
  }
}

function closeStatusModal() {
  if (createStatus.value === 'success')
    router.push({ name: 'spaceProposal', params: { id: proposal.value.id } });
  createStatus.value = '';
}

watchEffect(async () => {
  const id = route.params.proposalId;

  proposal.value = await getProposal(id);
  if (proposal.value) return;

  router.push({ name: 'spaceProposals', params: { key: props.space.id } });
});

watch(
  [() => form.value.distribution.type],
  () => {
    if (!form.value.distribution.hasWeightedLimit) {
      form.value.distribution.weightedLimit = '';
    }
    if (!form.value.distribution.hasLotteryLimit) {
      form.value.distribution.lotteryLimit = '';
    }
    if (form.value.distribution.type === 'lottery') {
      form.value.distribution.hasWeightedLimit = false;
      form.value.distribution.weightedLimit = '';
      form.value.distribution.numWinners ??= '1';
    }
    if (form.value.distribution.type === 'weighted') {
      form.value.distribution.hasLotteryLimit = false;
      form.value.distribution.lotteryLimit = '';
      form.value.distribution.numWinners = undefined;
    }
  },
  { deep: true }
);

watch(
  [web3Account, formToken, () => form.value.network],
  () => {
    if (!web3Account.value || !formToken.value) return;
    updateAccount(
      formToken.value.contractAddress,
      form.value.network,
      BOOST_CONTRACTS[form.value.network]
    );
  },
  { immediate: true }
);

watch(
  () => form.value.network,
  async () => {
    loadFees();
  },
  { immediate: true }
);

watch(
  [web3Account, () => form.value.network],
  () => {
    form.value.token = undefined;
    loadBalances(web3Account.value, form.value.network);
  },
  { immediate: true }
);
</script>

<template>
  <LoadingSpinner v-if="!proposal" class="overlay big" />

  <div v-else>
    <SpaceBreadcrumbs :space="space" :proposal="proposal" />
    <TheLayout class="pt-[12px] px-[20px] mb-[124px] md:mb-0">
      <template #content-left>
        <h1 class="leading-[44px]">Create a new boost</h1>
        <p class="text-md leading-5">
          Reward voters on this proposal and drive engagement
        </p>

        <div class="space-y-3 mt-[20px] md:mt-4">
          <SpaceBoostCardProposal :proposal="proposal" :space="space" />

          <SpaceBoostDeposit
            v-model:formToken="form.token"
            v-model:formNetwork="form.network"
            v-model:formAmount="form.amount"
            :tokens="tokens"
            :loading-balances="loadingBalances"
            :amount-with-token-fee-parsed="amountWithTokenFeeParsed"
            :form-error-messages="formErrorMessages"
            :token-fee-percent="tokenFeePercent"
            :token-fee-parsed="tokenFeeParsed"
            :eth-fee="ethFee"
          />

          <TuneBlock>
            <template #header>
              <TuneBlockHeader
                title="Distribution"
                sub-title="Define how the reward pool is distributed to eligible voters."
              />
            </template>
            <div class="space-y-3">
              <div class="flex flex-col sm:flex-row gap-[12px]">
                <button
                  v-for="item in DISTRIBUTION_TYPE_ITEMS"
                  :key="item.value"
                  type="button"
                  class="rounded-xl p-3 cursor-pointer border sm:w-1/2 text-left"
                  :class="{
                    'border-skin-link': form.distribution.type === item.value
                  }"
                  @click="form.distribution.type = item.value"
                >
                  <div
                    class="flex justify-between font-semibold text-skin-heading"
                  >
                    {{ item.name }}
                    <i-ho-check v-if="form.distribution.type === item.value" />
                  </div>
                  <div class="leading-[18px] pr-4">
                    {{ item.description }}
                  </div>
                </button>
              </div>
              <template v-if="form.distribution.type === 'weighted'">
                <TuneSwitch
                  v-model="form.distribution.hasWeightedLimit"
                  label="Define a maximum reward per voter"
                />

                <TuneInput
                  v-if="form.distribution.hasWeightedLimit"
                  v-model="form.distribution.weightedLimit"
                  label="Max reward"
                  type="number"
                  placeholder="100"
                  always-show-error
                  :error="formErrorMessages?.weightedLimit"
                  @click="form.distribution.hasWeightedLimit = true"
                >
                  <template #after>
                    <div class="-mr-[8px]">{{ formToken?.symbol }}</div>
                  </template>
                </TuneInput>
              </template>

              <template v-if="form.distribution.type === 'lottery'">
                <TuneInput
                  v-model="form.distribution.numWinners"
                  label="Number of winners"
                  type="number"
                  placeholder="5"
                  always-show-error
                  :error="formErrorMessages?.numWinners"
                >
                  <template #after>
                    <div class="-mr-2">Winners</div>
                  </template>
                </TuneInput>

                <TuneSwitch
                  v-model="form.distribution.hasLotteryLimit"
                  label="Define a maximum chance to win"
                  hint="As the chance to win is based on voting power, setting a limit will ensure a more fair lottery. If set to 1% and the voter has 5% of the voted voting power, the voter will only have a 1% chance to win. If there are not enough voters, the chance to win will be increased to reach a total of 100%."
                />

                <TuneInput
                  v-if="form.distribution.hasLotteryLimit"
                  v-model="form.distribution.lotteryLimit"
                  label="Max chance to win"
                  type="number"
                  placeholder="1"
                  always-show-error
                  :error="formErrorMessages?.lotteryLimit"
                  @click="form.distribution.hasLotteryLimit = true"
                >
                  <template #after>
                    <div class="-mr-[8px]">%</div>
                  </template>
                </TuneInput>
              </template>
            </div>
            <TuneBlockFooter v-if="form.distribution.type === 'lottery'">
              <div class="flex justify-between">
                Reward per winner
                <div class="text-skin-heading">
                  {{ amountPerWinner }}
                  {{ formToken?.symbol }}
                </div>
              </div>
            </TuneBlockFooter>
          </TuneBlock>

          <TuneBlock>
            <template #header>
              <TuneBlockHeader
                title="Eligibility"
                sub-title="Choose an option that best incentivises meaningful participation."
              />
            </template>

            <TuneSelect
              v-model="form.eligibility.choice"
              :items="eligibilityOptions"
              label="Eligible to"
            />
            <TuneBlockFooter v-if="!bribeEnabled">
              <BaseMessage level="info">
                <template v-if="!space.boost.bribeEnabled">
                  Selecting a specific choice is disabled for the
                  <span class="font-semibold">
                    {{ space.name }}
                  </span>
                  space. Please enable strategic incentivization in the space
                  settings to enable this feature.
                </template>
                <template v-else-if="proposal.privacy === 'shutter'">
                  Strategic incentivization is disabled for proposal with
                  shutter on.
                </template>
                <template
                  v-else-if="
                    !['basic', 'single-choice'].includes(proposal.type)
                  "
                >
                  Strategic incentivization is available only for basic and
                  single choice voting type.
                </template>
              </BaseMessage>
            </TuneBlockFooter>
          </TuneBlock>
        </div>
      </template>

      <template #sidebar-right>
        <TheActionbar break-point="md">
          <div
            class="md:border rounded-xl p-3 md:mt-3 lg:mt-0 lg:fixed lg:w-[320px]"
          >
            <h4 class="leading-5 mb-1 hidden md:block">Create boost</h4>
            <p class="text-md leading-5 hidden md:block">
              Once a boost is created, it can no longer be modified.
            </p>
            <div class="flex justify-left md:mt-3 leading-5">
              <i-ho-exclamation-circle class="inline-block text-sm mr-1" />

              The boost contract is not audited.
            </div>
            <TuneButton
              :loading="isLoading"
              :disabled="!space.boost.enabled || proposal.state === 'closed'"
              primary
              class="w-full mt-3"
              @click="handleCreate"
            >
              Create
            </TuneButton>
            <div
              v-if="isEndingSoon || proposal.state === 'closed'"
              class="text-boost flex items-center gap-1 justify-center mt-[6px]"
            >
              <template v-if="proposal.state === 'closed'">
                <i-ho-exclamation-circle />
                This proposal is closed
              </template>
              <template v-else-if="!space.boost.enabled">
                <i-ho-exclamation-circle />
                Boost is not enabled in this space
              </template>
              <template v-else-if="isEndingSoon">
                <i-ho-clock />
                Proposal
                {{
                  getRelativeProposalPeriod(
                    'active',
                    proposal.start,
                    proposal.end
                  )
                }}
              </template>
            </div>
          </div>
        </TheActionbar>
      </template>
    </TheLayout>
    <ModalTransactionStatus
      v-if="createStatusModalConfig"
      open
      :variant="createStatusModalConfig.variant"
      :title="createStatusModalConfig.title"
      :subtitle="createStatusModalConfig.subtitle"
      :network="form.network"
      @close="closeStatusModal"
      @try-again="retryCreation"
    />

    <ModalWrongNetwork
      :open="modalWrongNetworkOpen"
      :network="form.network"
      @network-changed="handleCreate"
      @close="modalWrongNetworkOpen = false"
    />
  </div>
</template>
