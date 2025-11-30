<script setup lang="ts">
import { ExtendedSpace, Proposal, Results } from '@/helpers/interfaces';
import { BigNumber } from '@ethersproject/bignumber';
import { StaticJsonRpcProvider } from '@ethersproject/providers';
import { getInstance } from '@snapshot-labs/lock/plugins/vue3';
import networks from '@snapshot-labs/snapshot.js/src/networks.json';
import { sleep } from '@snapshot-labs/snapshot.js/src/utils';
import getProvider from '@snapshot-labs/snapshot.js/src/utils/provider';
import {
  CollateralDetails,
  Network,
  OGModuleDetails,
  OGProposalState,
  Transaction
} from '../../types';
import {
  approveBond,
  executeProposal,
  getCollateralDetailsForProposal,
  getOGModuleDetails,
  getOGProposalState,
  getUserCollateralAllowance,
  getUserCollateralBalance,
  submitProposal
} from '../../utils';
import CanRequestTxExecution from './steps/CanRequestTxExecution.vue';
import InOOChallengePeriod from './steps/InOOChallengePeriod.vue';
import CanProposeToOG from './steps/CanProposeToOG.vue';
import RejectedBySnapshotVote from './steps/RejectedBySnapshotVote.vue';
import TallyingSnapshotVotes from './steps/TallyingSnapshotVotes.vue';
import TransactionsExecuted from './steps/TransactionsExecuted.vue';

declare global {
  interface Window {
    ethereum: any;
  }
}

const props = defineProps<{
  space: ExtendedSpace;
  proposal: Proposal;
  results: Results;
  transactions: Transaction[];
  network: Network;
  moduleAddress: string;
}>();

const { web3 } = useWeb3();
const isLoading = ref(true);
const hasConnectedWallet = computed(() => !!web3.value.account);
const provider: StaticJsonRpcProvider = getProvider(props.network);
const ogModuleDetails = ref<OGModuleDetails>();
const oGProposalState = ref<OGProposalState>();
const collateralDetails = ref<CollateralDetails>();
const userCollateralBalance = ref<BigNumber>();
const userCollateralAllowance = ref<BigNumber>();

const hasSufficientAllowance = computed(() => {
  if (
    isLoading.value ||
    !hasConnectedWallet.value ||
    collateralDetails.value === undefined ||
    ogModuleDetails.value === undefined ||
    userCollateralAllowance.value === undefined
  )
    return undefined;
  return userCollateralAllowance.value.gte(ogModuleDetails.value.minimumBond);
});
const hasSufficientBalance = computed(() => {
  if (
    isLoading.value ||
    !hasConnectedWallet.value ||
    collateralDetails.value === undefined ||
    ogModuleDetails.value === undefined ||
    userCollateralBalance.value === undefined
  )
    return undefined;
  return userCollateralBalance.value.gte(ogModuleDetails.value.minimumBond);
});
const { createPendingTransaction, removePendingTransaction } = useTxStatus();
const { notify } = useFlashNotification();
const { quorum } = useQuorum(props);

type TransactionExecutionState =
  | { status: 'tallying-snapshot-votes' }
  | { status: 'rejected-by-snapshot-vote' }
  | OGProposalState;

const transactionExecutionState = computed<
  TransactionExecutionState | undefined
>(() => {
  const proposalFinalized = wasProposalFinalized(props.proposal);

  if (!proposalFinalized) return { status: 'tallying-snapshot-votes' };

  const proposalPassed = didProposalPass(props.proposal);

  if (!proposalPassed) return { status: 'rejected-by-snapshot-vote' };

  return oGProposalState.value;
});

function getFormattedTransactions() {
  return props.transactions.map(transaction => {
    return transaction.formatted;
  });
}

async function updateOgProposalState() {
  isLoading.value = true;
  try {
    if (ogModuleDetails.value) {
      oGProposalState.value = await getOGProposalState({
        moduleDetails: ogModuleDetails.value,
        network: props.network,
        explanation: props.proposal.ipfs,
        transactions: getFormattedTransactions()
      });
    }
  } catch (e) {
    console.error('Error loading uma execution details', e);
  } finally {
    isLoading.value = false;
  }
}

async function onApproveBond() {
  if (!collateralDetails.value || !ogModuleDetails.value) return;
  let txPendingId: string | undefined;
  try {
    await ensureRightNetwork(props.network);
    const approvingBond = approveBond(
      getInstance().web3,
      props.moduleAddress,
      collateralDetails.value?.address,
      ogModuleDetails.value?.minimumBond
    );
    const step = await approvingBond.next();
    if (step.value) {
      txPendingId = createPendingTransaction(step.value.hash);
      await approvingBond.next();
      await sleep(3e3);
      notify('Successfully approved bond');
      // update our knowledge of users approval
      userCollateralAllowance.value = await getUserCollateralAllowance(
        collateralDetails.value.erc20Contract,
        web3.value.account,
        props.moduleAddress
      );
      await updateOgProposalState();
    }
  } catch (e) {
    console.error(e);
    notify(['red', 'Failed to approve bond']);
  } finally {
    if (txPendingId) {
      removePendingTransaction(txPendingId);
    }
  }
}

async function onSubmitProposal() {
  if (!getInstance().isAuthenticated.value) return;
  let txPendingId: string | undefined;
  try {
    await ensureRightNetwork(props.network);
    const proposalSubmission = submitProposal(
      getInstance().web3,
      props.moduleAddress,
      props.proposal.ipfs,
      getFormattedTransactions()
    );
    const step = await proposalSubmission.next();
    if (step.value) {
      txPendingId = createPendingTransaction(step.value.hash);
      await proposalSubmission.next();
      notify('Proposal submitted successfully');
      await sleep(3e3);
      await updateOgProposalState();
    }
  } catch (e) {
    notify(['red', 'Failed to submit proposal']);
    console.error(e);
  } finally {
    if (txPendingId) {
      removePendingTransaction(txPendingId);
    }
  }
}

async function onExecuteProposal() {
  if (!getInstance().isAuthenticated.value) return;
  let txPendingId: string | undefined;
  try {
    await ensureRightNetwork(props.network);
  } catch (e) {
    console.error(e);
  }

  try {
    const executingProposal = executeProposal(
      getInstance().web3,
      props.moduleAddress,
      getFormattedTransactions()
    );
    const step = await executingProposal.next();
    if (step.value) {
      txPendingId = createPendingTransaction(step.value.hash);
      await executingProposal.next();
      notify('Proposal executed successfully');
      await sleep(3e3);
      await updateOgProposalState();
    }
  } catch (err) {
    notify(['red', 'Failed to execute proposal']);
  } finally {
    if (txPendingId) {
      removePendingTransaction(txPendingId);
    }
  }
}

const connectedToRightChain = computed(() => {
  return Number(props.network) === Number(web3.value.network.chainId);
});

const networkName = computed(() => {
  return networks[props.network].name;
});

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

async function ensureRightNetwork(chainId: Network) {
  const chainIdInt = parseInt(chainId);
  const connectedToChainId = getInstance().provider.value?.chainId;
  if (connectedToChainId === chainIdInt) return; // already on right chain

  if (!window.ethereum || !getInstance().provider.value?.isMetaMask) {
    // we cannot switch automatically
    throw new Error(
      `Connected to wrong chain #${connectedToChainId}, required: #${chainId}`
    );
  }

  const network = networks[chainId];
  const chainIdHex = `0x${chainIdInt.toString(16)}`;

  try {
    // check if the chain to connect to is installed
    await window.ethereum.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: chainIdHex }] // chainId must be in hexadecimal numbers
    });
  } catch (error) {
    // This error code indicates that the chain has not been added to MetaMask. Let's add it.
    // @ts-expect-error non-standard error type
    if (error.code === 4902) {
      try {
        await window.ethereum.request({
          method: 'wallet_addEthereumChain',
          params: [
            {
              chainId: chainIdHex,
              chainName: network.name,
              rpcUrls: network.rpc,
              blockExplorerUrls: [network.explorer.url]
            }
          ]
        });
      } catch (addError) {
        console.error(addError);
      }
    }
    console.error(error);
  }

  await sleep(1e3); // somehow the switch does not take immediate effect :/
  if (window.ethereum.chainId !== chainIdHex) {
    throw new Error(
      `Could not switch to the right chain on MetaMask (required: ${chainIdHex}, active: ${window.ethereum.chainId})`
    );
  }
}

async function loadActions() {
  collateralDetails.value = await getCollateralDetailsForProposal(
    provider,
    props.moduleAddress
  );
  ogModuleDetails.value = await getOGModuleDetails({
    provider,
    network: props.network,
    moduleAddress: props.moduleAddress,
    transactions: getFormattedTransactions()
  });
  userCollateralBalance.value = await getUserCollateralBalance(
    collateralDetails.value.erc20Contract,
    web3.value.account
  );
  userCollateralAllowance.value = await getUserCollateralAllowance(
    collateralDetails.value.erc20Contract,
    web3.value.account,
    props.moduleAddress
  );
  await updateOgProposalState();
}

onMounted(async () => {
  loadActions();
});
</script>

<template>
  <div v-if="!hasConnectedWallet" class="my-4">
    Connect your wallet to see execution details
  </div>
  <div v-if="!connectedToRightChain" class="my-4">
    Switch your wallet to {{ networkName }} to request execution
  </div>
  <template v-if="hasConnectedWallet && connectedToRightChain">
    <div v-if="isLoading" class="grid place-items-center">
      <LoadingSpinner />
    </div>
    <template
      v-if="
        !isLoading &&
        transactionExecutionState !== undefined &&
        ogModuleDetails !== undefined
      "
    >
      <div>
        <h3>Request transaction execution</h3>
        <div class="flex flex-col gap-2">
          <TallyingSnapshotVotes
            v-if="
              transactionExecutionState.status === 'tallying-snapshot-votes'
            "
          />
          <RejectedBySnapshotVote
            v-if="
              transactionExecutionState.status === 'rejected-by-snapshot-vote'
            "
          />
          <CanProposeToOG
            v-if="
              transactionExecutionState.status === 'can-propose-to-og' &&
              !!collateralDetails &&
              !!ogModuleDetails &&
              !!userCollateralBalance &&
              hasSufficientBalance !== undefined &&
              hasSufficientAllowance !== undefined
            "
            :has-sufficient-balance="hasSufficientBalance"
            :has-sufficient-allowance="hasSufficientAllowance"
            :minimum-bond="ogModuleDetails.minimumBond"
            :user-balance="userCollateralBalance"
            :decimals="collateralDetails.decimals"
            :symbol="collateralDetails.symbol"
            :challenge-period="
              Number(ogModuleDetails.challengePeriod.toString())
            "
            :quorum="quorum"
            :scores-total="proposal.scores_total"
            :is-disputed="transactionExecutionState.isDisputed"
            @submit-proposal="onSubmitProposal"
            @approve-bond="onApproveBond"
          />
          <InOOChallengePeriod
            v-if="transactionExecutionState.status === 'in-oo-challenge-period'"
            :network="network"
            :expiration-time="transactionExecutionState.expirationTime"
            :assertion-hash="transactionExecutionState.assertionHash"
            :assertion-log-index="transactionExecutionState.assertionLogIndex"
          />
          <CanRequestTxExecution
            v-if="
              transactionExecutionState.status === 'can-request-tx-execution'
            "
            :transaction-count="transactions.length"
            @execute-proposal="onExecuteProposal"
          />
          <TransactionsExecuted
            v-if="transactionExecutionState.status === 'transactions-executed'"
          />
        </div>
      </div>
    </template>
  </template>
</template>
