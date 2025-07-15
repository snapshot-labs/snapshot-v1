import { LEADERBOARD_QUERY } from '@/helpers/queries';
import { getInstance } from '@snapshot-labs/lock/plugins/vue3';
import { getAddress } from '@ethersproject/address';
import { DelegateWithPercent, ExtendedSpace } from '@/helpers/interfaces';
import {
  DelegationTypes,
  setupDelegation as getDelegationAdapter
} from '@/helpers/delegationV2';

type DelegatesStats = Record<string, { votes: number; proposals: number }>;

const DELEGATES_LIMIT = 18;

export function useDelegates(space: ExtendedSpace) {
  const auth = getInstance();
  const { resolveName } = useResolveName();
  const { apolloQuery } = useApolloQuery();

  const { reader, writer } = getDelegationAdapter(space, auth);

  const delegates = ref<DelegateWithPercent[]>([]);
  const delegate = ref<DelegateWithPercent | null>(null);
  const isLoadingDelegate = ref(false);
  const isLoadingDelegates = ref(false);
  const isLoadingMoreDelegates = ref(false);
  const hasDelegatesLoadFailed = ref(false);
  const isLoadingDelegatingTo = ref(false);
  const isLoadingDelegateBalance = ref(false);
  const hasMoreDelegates = ref(false);
  const delegatesStats = ref<DelegatesStats>({});

  const hasDelegationPortal =
    space.delegationPortal.delegationType === DelegationTypes.COMPOUND ||
    (space.delegationPortal.delegationType ===
      DelegationTypes.SPLIT_DELEGATION &&
      space.strategies.some(
        ({ name }) => name === DelegationTypes.SPLIT_DELEGATION
      ));

  async function fetchDelegateBatch(orderBy: string, skip = 0) {
    return reader.getDelegates(DELEGATES_LIMIT, skip, orderBy);
  }

  async function loadDelegates(orderBy: string) {
    if (isLoadingDelegates.value) return;
    isLoadingDelegates.value = true;
    hasDelegatesLoadFailed.value = false;

    try {
      const response = await fetchDelegateBatch(orderBy);
      delegates.value = response;
      loadStats(response.map(d => d.id));
      hasMoreDelegates.value = response.length === DELEGATES_LIMIT;
    } catch (e) {
      console.error(e);
      hasDelegatesLoadFailed.value = true;
    } finally {
      isLoadingDelegates.value = false;
    }
  }

  async function fetchMoreDelegates(orderBy: string) {
    if (!delegates.value.length || isLoadingMoreDelegates.value) return;
    isLoadingMoreDelegates.value = true;
    hasDelegatesLoadFailed.value = false;

    try {
      const response = await fetchDelegateBatch(
        orderBy,
        delegates.value.length
      );
      loadStats(response.map(d => d.id));
      delegates.value = [...delegates.value, ...response];
      hasMoreDelegates.value = response.length === DELEGATES_LIMIT;
    } catch (e) {
      console.error(e);
      hasDelegatesLoadFailed.value = true;
    } finally {
      isLoadingMoreDelegates.value = false;
    }
  }

  async function loadDelegate(addressOrEns: string) {
    if (isLoadingDelegate.value) return;
    hasDelegatesLoadFailed.value = false;
    isLoadingDelegate.value = true;
    delegate.value = null;

    try {
      const resolvedAddress = await resolveName(addressOrEns);
      if (!resolvedAddress) return;
      const response = await reader.getDelegate(getAddress(resolvedAddress));
      loadStats([response.id]);
      delegate.value = response;
    } catch (e) {
      console.error(e);
      hasDelegatesLoadFailed.value = true;
    } finally {
      isLoadingDelegate.value = false;
    }
  }

  async function loadDelegateBalance(id: string) {
    try {
      isLoadingDelegateBalance.value = true;
      return await reader.getBalance(id.toLowerCase());
    } catch (e) {
      console.error(e);
    } finally {
      isLoadingDelegateBalance.value = false;
    }
  }

  async function setDelegates(
    addresses: string[],
    ratio?: number[],
    expirationTimestamp?: number
  ) {
    return writer.sendSetDelegationTx(addresses, ratio, expirationTimestamp);
  }

  async function clearDelegations() {
    if (!writer.sendClearDelegationsTx) {
      throw new Error('Clear delegations not supported');
    }
    return writer.sendClearDelegationsTx();
  }

  async function fetchDelegatingTo(address: string) {
    if (!address) return;
    isLoadingDelegatingTo.value = true;
    try {
      return await reader.getDelegatingTo(address);
    } catch (e) {
      console.error(e);
    } finally {
      isLoadingDelegatingTo.value = false;
    }
  }

  async function loadStats(addresses: string[]) {
    const leaderboards = await apolloQuery(
      {
        query: LEADERBOARD_QUERY,
        variables: {
          space: space.id,
          user_in: addresses
        }
      },
      'leaderboards'
    );

    leaderboards.forEach(leaderboard => {
      delegatesStats.value[leaderboard.user] = {
        votes: leaderboard.votesCount,
        proposals: leaderboard.proposalsCount
      };
    });
  }

  return {
    isLoadingDelegate,
    isLoadingDelegates,
    isLoadingMoreDelegates,
    hasDelegatesLoadFailed,
    hasDelegationPortal,
    isLoadingDelegateBalance,
    isLoadingDelegatingTo,
    hasMoreDelegates,
    delegate,
    delegates,
    delegatesStats,
    loadDelegate,
    loadDelegates,
    fetchMoreDelegates,
    setDelegates,
    clearDelegations,
    loadDelegateBalance,
    fetchDelegatingTo
  };
}
