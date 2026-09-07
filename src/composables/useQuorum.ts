import { ExtendedSpace, Proposal, Results } from '@/helpers/interfaces';
import getProvider from '@snapshot-labs/snapshot.js/src/utils/provider';
import { PROVIDER_OPTIONS } from '@/helpers/constants';
import { BigNumber } from '@ethersproject/bignumber';
import { call } from '@snapshot-labs/snapshot.js/src/utils';
import { getSnapshots } from '@snapshot-labs/snapshot.js/src/utils/blockfinder';

interface QuorumProps {
  space: ExtendedSpace;
  proposal: Proposal;
  results: Results;
}

export function useQuorum(props: QuorumProps) {
  const loading = ref(false);
  const quorum = ref(0);
  const quorumType = ref('default');

  const totalQuorumScore = computed(() => {
    if (props.proposal.quorumType === 'rejection') {
      return props.results.scores
        .filter((c, i) => i === 1)
        .reduce((a, b) => a + b, 0);
    }
    const basicCount = props.space.plugins?.quorum?.basicCount;
    if (basicCount && props.proposal.type === 'basic')
      return props.results.scores
        .filter((c, i) => basicCount.includes(i))
        .reduce((a, b) => a + b, 0);
    if (props.space.voting.hideAbstain && props.proposal.type === 'basic') {
      return props.results.scores
        .filter((c, i) => i !== 2)
        .reduce((a, b) => a + b, 0);
    }
    if (props.results.scoresTotal) return props.results.scoresTotal;
    return 0;
  });

  async function getQuorum(web3: any, quorumOptions: any, snapshot: string) {
    if (props.proposal?.quorum) {
      return props.proposal?.quorum;
    }

    if (!quorumOptions) return 0;

    const { strategy } = quorumOptions;

    const quorumModifier = quorumOptions.quorumModifier ?? 1;

    switch (strategy) {
      case 'static': {
        return quorumOptions.total;
      }

      case 'balance': {
        const { address, methodABI, decimals } = quorumOptions;

        const blockTag = snapshot === 'latest' ? snapshot : parseInt(snapshot);

        const votingPower = await call(
          web3,
          [methodABI],
          [address, methodABI.name],
          { blockTag }
        );

        return (
          BigNumber.from(votingPower)
            .div(BigNumber.from(10).pow(decimals))
            .toNumber() * quorumModifier
        );
      }

      case 'multichainBalance': {
        const { network, strategies } = quorumOptions;
        const blocks = await getSnapshots(
          network,
          parseInt(snapshot),
          web3,
          strategies.map(s => s.network || network)
        );
        const requests: Promise<any>[] = strategies.map(s =>
          call(
            getProvider(s.network, PROVIDER_OPTIONS),
            [s.methodABI],
            [s.address, s.methodABI.name],
            { blockTag: blocks[s.network] }
          )
        );
        const results = await Promise.all(requests);
        const totalBalance = results.reduce((total, ele, index) => {
          if (index === 1) {
            total = total.div(BigNumber.from(10).pow(strategies[0].decimals));
          }
          return total.add(
            ele.div(BigNumber.from(10).pow(strategies[index].decimals))
          );
        });
        return totalBalance.toNumber() * quorumModifier;
      }

      default:
        throw new Error(`Unsupported quorum strategy: ${strategy}`);
    }
  }

  async function loadQuorum() {
    loading.value = true;
    quorum.value = await getQuorum(
      getProvider(props.space.network, PROVIDER_OPTIONS),
      props.space.plugins.quorum,
      props.proposal.snapshot
    );
    quorumType.value = props.proposal.quorumType;
    loading.value = false;
  }

  onMounted(() => loadQuorum());

  return {
    loadingQuorum: loading,
    totalQuorumScore,
    quorum,
    quorumType
  };
}
