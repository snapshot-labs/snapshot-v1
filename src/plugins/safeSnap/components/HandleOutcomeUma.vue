<script setup lang="ts">
import { ExtendedSpace, Proposal, Results } from '@/helpers/interfaces';
import { formatUnits } from '@ethersproject/units';
import { getInstance } from '@snapshot-labs/lock/plugins/vue3';
import networks from '@snapshot-labs/snapshot.js/src/networks.json';
import { sleep } from '@snapshot-labs/snapshot.js/src/utils';
import Plugin from '../index';
import type { Network } from '../types';
import { ensureRightNetwork } from './SafeTransactions.vue';

type Transaction = {
  to: string;
  operation: string;
  value: string;
  data: string;
};

type Batch = {
  transactions: Transaction[];
};

const props = defineProps<{
  space: ExtendedSpace;
  proposal: Proposal;
  results: Results;
  batches: Batch[];
  network: Network;
  umaAddress: string;
  multiSendAddress: string;
}>();

const { formatDuration } = useIntl();
const { t } = useI18n();

const { clearBatchError } = useSafe();
const { web3 } = useWeb3();
const {
  createPendingTransaction,
  updatePendingTransaction,
  removePendingTransaction
} = useTxStatus();
const { notify } = useFlashNotification();
const { quorum } = useQuorum(props);

const plugin = new Plugin();

type QuestionState =
  | 'error'
  | 'no-wallet-connection'
  | 'loading'
  | 'waiting-for-vote-confirmation'
  | 'no-transactions'
  | 'completely-executed'
  | 'waiting-for-proposal'
  | 'waiting-for-liveness'
  | 'proposal-approved'
  | 'waiting-for-vote-finalize'
  | 'proposal-denied';

type Action1State = 'idle' | 'approve-bond' | 'submit-proposal';
type Action2State = 'idle' | 'execute-proposal';

const loading = ref(true);
const action1State = ref<Action1State>('idle');
const action2State = ref<Action2State>('idle');
const voteResultsConfirmed = ref(false);
const questionDetails =
  ref<Awaited<ReturnType<typeof plugin.getExecutionDetailsUma>>>();
const closeModal = ref(false);

function closeEvent() {
  closeModal.value = false;
  voteResultsConfirmed.value = false;
}

function showProposeModal() {
  closeModal.value = true;
  voteResultsConfirmed.value = true;
}

const getTransactionsUma = () =>
  props.batches.map(batch => {
    const mainTx = batch.mainTransaction;
    return [mainTx.to, Number(mainTx.operation), mainTx.value, mainTx.data];
  });

const updateDetails = async () => {
  loading.value = true;
  try {
    questionDetails.value = await plugin.getExecutionDetailsUma(
      props.network,
      props.umaAddress,
      props.proposal.id,
      props.proposal.ipfs,
      getTransactionsUma()
    );
  } catch (e) {
    console.error('Error loading uma execution details', e);
  } finally {
    loading.value = false;
  }
};

const approveBondUma = async () => {
  if (!questionDetails.value?.oracle) return;
  const txPendingId = createPendingTransaction();
  try {
    action1State.value = 'approve-bond';

    await ensureRightNetwork(props.network);

    const approveBond = plugin.approveBondUma(
      props.network,
      getInstance().web3,
      props.umaAddress
    );
    const step = await approveBond.next();
    if (step.value)
      updatePendingTransaction(txPendingId, { hash: step.value.hash });
    action1State.value = 'idle';
    await approveBond.next();
    notify(t('notify.youDidIt'));
    await sleep(3e3);
    await updateDetails();
  } catch (e) {
    console.error(e);
    action1State.value = 'idle';
  } finally {
    removePendingTransaction(txPendingId);
  }
};

const getProposalUrl = (chain: string, txHash: string, logIndex: number) => {
  if (Number(chain) !== 5 && Number(chain) !== 80001) {
    return `https://oracle.uma.xyz?transactionHash=${txHash}&eventIndex=${logIndex}`;
  }
  return `https://testnet.oracle.uma.xyz?transactionHash=${txHash}&eventIndex=${logIndex}`;
};

const submitProposalUma = async () => {
  if (!getInstance().isAuthenticated.value) return;
  action1State.value = 'submit-proposal';
  const txPendingId = createPendingTransaction();
  try {
    await ensureRightNetwork(props.network);
    const proposalSubmission = plugin.submitProposalUma(
      getInstance().web3,
      props.umaAddress,
      props.proposal.ipfs,
      getTransactionsUma()
    );
    const step = await proposalSubmission.next();
    if (step.value)
      updatePendingTransaction(txPendingId, { hash: step.value.hash });
    action1State.value = 'idle';
    await proposalSubmission.next();
    notify(t('notify.youDidIt'));
    await sleep(3e3);
    await updateDetails();
  } catch (e) {
    console.error(e);
  } finally {
    action1State.value = 'idle';
    removePendingTransaction(txPendingId);
  }
};

const executeProposalUma = async () => {
  if (!getInstance().isAuthenticated.value) return;
  action2State.value = 'execute-proposal';
  const txPendingId = createPendingTransaction();
  try {
    await ensureRightNetwork(props.network);
  } catch (e) {
    console.error(e);
    action2State.value = 'idle';
    return;
  }

  try {
    clearBatchError();
    const executingProposal = plugin.executeProposalUma(
      getInstance().web3,
      props.umaAddress,
      getTransactionsUma()
    );
    const step = await executingProposal.next();
    if (step.value)
      updatePendingTransaction(txPendingId, { hash: step.value.hash });
    action2State.value = 'idle';
    await executingProposal.next();
    notify(t('notify.youDidIt'));
    await sleep(3e3);
    await updateDetails();
  } catch (err) {
    action2State.value = 'idle';
  } finally {
    removePendingTransaction(txPendingId);
  }
};

const usingMetaMask = computed(() => {
  return (
    // @ts-expect-error window.ethereum is not in the types
    window.ethereum && getInstance().provider.value?.isMetaMask
  );
});

const connectedToRightChain = computed(() => {
  return getInstance().provider.value?.chainId === parseInt(props.network);
});

const networkName = computed(() => {
  return networks[props.network].name;
});

type Proposal = {
  choices: string[];
  scores: number[];
  scores_total: number;
  quorum: number;
  created: number;
  end: number;
  state: string;
};
function didProposalPass(proposal: Proposal) {
  // ensure the vote has ended
  if (proposal.state !== 'closed') return false;
  // ensure total votes are more than quorum
  if (proposal.scores_total && proposal.scores_total < proposal.quorum)
    return false;
  const votes = Object.fromEntries(
    proposal.choices.map((choice, i) => {
      return [choice.toLowerCase(), proposal.scores[i] ?? 0];
    })
  );
  // ensure there are more "for" votes than "against" votes
  // abstain votes should not count against the proposal
  return votes['for'] > (votes['against'] ?? 0);
}

function wasProposalFinalized(proposal: Proposal) {
  return proposal.scores_state === 'final';
}

const questionState = computed<QuestionState>(() => {
  if (!web3.value.account) return 'no-wallet-connection';

  if (loading.value) return 'loading';

  if (!questionDetails.value) return 'error';

  const { assertionEvent, proposalExecuted, activeProposal, noTransactions } =
    questionDetails.value;

  if (noTransactions) return 'no-transactions';

  // check if proposal passed snapshot rules, ie votes for, and quorum
  const proposalPassed = didProposalPass(props.proposal);

  // vote may not be finalized, its possible for vote to pass, but require a waiting period till votes completely tally
  const proposalFinalized = wasProposalFinalized(props.proposal);

  // ordering of this is deliberate. it will prevent you from executing proposals that did not pass,
  // but if for some reason the proposal did get executed elsewhere, it will still show that it was.
  // If proposal has already been executed, prevents user from proposing again.
  if (proposalExecuted) return 'completely-executed';

  if (!proposalFinalized) {
    return 'waiting-for-vote-finalize';
  }

  // User can confirm vote results if not done already and there is no proposal yet.
  if (!activeProposal && !voteResultsConfirmed.value && proposalPassed)
    return 'waiting-for-vote-confirmation';

  // Proposal can be made if it has not been made already and user confirmed vote results.
  if (!activeProposal && voteResultsConfirmed.value && proposalPassed)
    return 'waiting-for-proposal';

  // Proposal has been made and is waiting for liveness period to complete.

  if (assertionEvent && !assertionEvent.isExpired)
    return 'waiting-for-liveness';

  // this is  above proposal-approved stated because we dont want to ever execute on proposals that did not pass vote
  if (!proposalPassed) return 'proposal-denied';

  // Proposal is approved if it expires without a dispute and hasn't been settled.
  if (assertionEvent && assertionEvent.isExpired && !assertionEvent.isSettled)
    return 'proposal-approved';

  // Proposal is approved if it has been settled without a disputer and hasn't been executed.
  if (assertionEvent && assertionEvent.isSettled && !proposalExecuted)
    return 'proposal-approved';

  return 'error';
});

onMounted(async () => {
  await updateDetails();
});
</script>

<template>
  <div v-if="questionState === 'error'" class="my-4">
    {{ $t('safeSnap.labels.error') }}
  </div>
  <template v-else>
    <div v-if="questionState === 'no-wallet-connection'" class="my-4">
      {{ $t('safeSnap.labels.connectWallet') }}
    </div>

    <div v-if="questionState === 'loading'" class="my-4">
      <LoadingSpinner />
    </div>
    <div v-if="questionState === 'waiting-for-vote-finalize'" class="my-4">
      Waiting on vote to be finalized
    </div>

    <div v-if="connectedToRightChain || usingMetaMask">
      <div
        v-if="questionState === 'waiting-for-vote-confirmation'"
        class="my-4 inline-block"
      >
        <BaseContainer class="flex items-center">
          <TuneButton @click="showProposeModal" class="mr-2">
            {{ $t('safeSnap.labels.confirmVoteResults') }}
          </TuneButton>
        </BaseContainer>
      </div>

      <div v-if="questionState === 'no-transactions'" class="my-4">
        {{ $t('safeSnap.labels.noTransactions') }}
      </div>

      <div
        v-if="
          questionState === 'waiting-for-proposal' &&
          questionDetails.needsBondApproval === true
        "
        class="my-4 inline-block"
      >
        <BaseContainer class="flex items-center">
          <TuneButton
            :loading="action1State === 'approve-bond'"
            @click="approveBondUma"
            class="mr-2"
          >
            {{ $t('safeSnap.labels.approveBond') }}
          </TuneButton>
          <BasePopoverHover placement="top">
            <template #button>
              <i-ho-information-circle />
            </template>
            <template #content>
              <div
                class="border bg-skin-bg p-3 text-md shadow-lg md:rounded-lg"
              >
                {{ $t('safeSnap.labels.approveBondToolTip') }}
              </div>
            </template>
          </BasePopoverHover>
        </BaseContainer>
      </div>
      <div
        v-if="
          questionState === 'waiting-for-proposal' &&
          questionDetails.needsBondApproval === false
        "
        class="my-4 inline-block"
      >
        <BaseContainer class="flex items-center">
          <BaseModal :open="closeModal" @close="closeEvent">
            <template #header>
              <h3 class="title">{{ $t('safeSnap.labels.request') }}</h3>
            </template>
            <div class="my-3 p-3">
              <div class="pl-3 pr-3">
                <p>{{ $t('safeSnap.labels.confirmVoteResultsToolTip') }}</p>
              </div>
              <div class="my-3 rounded-lg border p-3">
                <div>
                  <strong class="pr-3">{{
                    $t('safeSnap.labels.requiredBond')
                  }}</strong>
                  <span class="float-right text-skin-link">
                    {{
                      formatUnits(
                        questionDetails.minimumBond ?? 0,
                        questionDetails.decimals
                      ) +
                      ' ' +
                      questionDetails.symbol
                    }}
                  </span>
                </div>
                <div>
                  <strong class="pr-3">{{
                    $t('safeSnap.labels.challengePeriod')
                  }}</strong>
                  <span class="float-right text-skin-link">
                    {{ formatDuration(Number(questionDetails.livenessPeriod)) }}
                  </span>
                </div>
              </div>
              <div>
                <BaseMessage
                  v-if="Number(props.proposal.scores_total) < Number(quorum)"
                  level="warning-red"
                >
                  {{ $t('safeSnap.labels.quorumWarning') }}
                </BaseMessage>
                <BaseMessage
                  v-if="
                    Number(questionDetails.minimumBond.toString()) >
                    Number(questionDetails.userBalance.toString())
                  "
                  level="warning-red"
                >
                  {{ $t('safeSnap.labels.bondWarning') }}
                </BaseMessage>
              </div>

              <TuneButton
                :loading="action1State === 'submit-proposal'"
                @click="submitProposalUma"
                class="my-1 w-full"
                :disabled="
                  Number(questionDetails.minimumBond.toString()) >
                    Number(questionDetails.userBalance.toString()) ||
                  Number(props.proposal.scores_total) < Number(quorum)
                "
              >
                {{ $t('safeSnap.labels.request') }}
              </TuneButton>
            </div>
          </BaseModal>
        </BaseContainer>
      </div>

      <div
        v-if="
          questionState === 'waiting-for-liveness' &&
          questionDetails.assertionEvent !== undefined
        "
        class="flex items-center justify-center self-stretch p-3 text-skin-link"
      >
        <BaseContainer class="my-1 inline-block">
          <div>
            <strong>{{
              'Proposal can be executed at ' +
              new Date(
                questionDetails.assertionEvent.expirationTimestamp.toNumber() *
                  1000
              ).toLocaleString()
            }}</strong>
          </div>

          <div style="text-align: center" class="mt-3">
            <a
              :href="
                getProposalUrl(
                  props.network,
                  questionDetails.assertionEvent.proposalTxHash,
                  questionDetails.assertionEvent.logIndex
                )
              "
              class="rounded-lg border p-2 text-skin-text"
              rel="noreferrer noopener"
              target="_blank"
              style="font-size: 16px"
            >
              {{ $t('safeSnap.labels.disputeProposal') }}
              <em style="font-size: 14px" class="iconfont iconexternal-link" />
            </a>
          </div>
        </BaseContainer>
      </div>

      <div
        v-if="questionState === 'proposal-approved'"
        class="my-4 inline-block"
      >
        <BaseContainer class="flex items-center">
          <TuneButton
            :loading="action2State === 'execute-proposal'"
            @click="executeProposalUma"
            class="mr-2"
          >
            {{ $t('safeSnap.labels.executeTxsUma', [batches.length]) }}
          </TuneButton>
          <BasePopoverHover placement="top">
            <template #button>
              <i-ho-information-circle />
            </template>
            <template #content>
              <div
                class="border bg-skin-bg p-3 text-md shadow-lg md:rounded-lg"
              >
                {{ $t('safeSnap.labels.executeToolTip') }}
              </div>
            </template>
          </BasePopoverHover>
        </BaseContainer>
      </div>
    </div>
    <div
      v-else-if="
        questionState !== 'loading' && questionState !== 'no-wallet-connection'
      "
      class="my-4"
    >
      {{ $t('safeSnap.labels.switchChain', [networkName]) }}
    </div>

    <div v-if="questionState === 'completely-executed'" class="my-4">
      {{ $t('safeSnap.labels.executed') }}
    </div>
    <div v-if="questionState === 'proposal-denied'" class="my-4">
      {{ $t('safeSnap.labels.rejected') }}
    </div>
  </template>
</template>
