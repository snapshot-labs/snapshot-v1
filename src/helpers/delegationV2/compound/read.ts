import getProvider from '@snapshot-labs/snapshot.js/src/utils/provider';
import { PROVIDER_OPTIONS } from '@/helpers/constants';
import { subgraphRequest, call } from '@snapshot-labs/snapshot.js/src/utils';
import { DelegateWithPercent, ExtendedSpace } from '@/helpers/interfaces';
import { DelegatingTo, DelegationReader } from '@/helpers/delegationV2/types';
import {
  getBalanceQuery,
  getDelegateQuery,
  getDelegatesQuery
} from './queries';

type Governance = {
  delegatedVotes: string;
  totalTokenHolders: string;
  totalDelegates: string;
};

type Delegate = {
  id: string;
  delegatedVotes: string;
  tokenHoldersRepresentedAmount: number;
};

function adjustUrl(apiUrl: string) {
  const hostedPattern =
    /https:\/\/thegraph\.com\/hosted-service\/subgraph\/([\w-]+)\/([\w-]+)/;
  const hostedMatch = apiUrl.match(hostedPattern);

  return hostedMatch
    ? `https://api.thegraph.com/subgraphs/name/${hostedMatch[1]}/${hostedMatch[2]}`
    : apiUrl;
}

const emptyDelegate = (address: string): DelegateWithPercent => ({
  id: address,
  delegatedVotes: '0',
  tokenHoldersRepresentedAmount: 0,
  delegatorsPercentage: 0,
  votesPercentage: 0
});

const formatDelegatesResponse = (response: any): DelegateWithPercent[] => {
  const governanceData = response.governance as Governance;
  const delegatesData = response.delegates as Delegate[];

  return delegatesData.map(delegate => {
    const delegatorsPercentage =
      Number(delegate.tokenHoldersRepresentedAmount) /
      Number(governanceData.totalTokenHolders);
    const votesPercentage =
      Number(delegate.delegatedVotes) / Number(governanceData.delegatedVotes);

    delegate.id = delegate.id.toLowerCase();

    return {
      ...delegate,
      delegatorsPercentage,
      votesPercentage
    };
  });
};

const formatDelegateResponse = (response: any): DelegateWithPercent => {
  const delegate = response.delegate as Delegate;
  const governanceData = response.governance as Governance;

  const delegatorsPercentage =
    Number(delegate.tokenHoldersRepresentedAmount) /
    Number(governanceData.totalTokenHolders);
  const votesPercentage =
    Number(delegate.delegatedVotes) / Number(governanceData.delegatedVotes);

  return {
    ...{
      id: delegate.id.toLowerCase(),
      delegatedVotes: delegate?.delegatedVotes || '0',
      tokenHoldersRepresentedAmount:
        delegate?.tokenHoldersRepresentedAmount || 0
    },
    delegatorsPercentage: delegatorsPercentage || 0,
    votesPercentage: votesPercentage || 0
  };
};

const formatBalanceResponse = (response: any): string =>
  response.tokenHolder?.tokenBalance || '0';

const getDelegations =
  (space: ExtendedSpace): DelegationReader['getDelegates'] =>
  async (first: number, skip: number, orderBy: string) => {
    const query: any = getDelegatesQuery(first, skip, orderBy);

    const response = await subgraphRequest(
      adjustUrl(space.delegationPortal.delegationApi),
      query
    );

    return formatDelegatesResponse(response);
  };

const getDelegate =
  (space: ExtendedSpace): DelegationReader['getDelegate'] =>
  async (address: string) => {
    const query: any = getDelegateQuery(address);

    const response = await subgraphRequest(
      adjustUrl(space.delegationPortal.delegationApi),
      query
    );

    if (!response.delegate) return emptyDelegate(address);

    return formatDelegateResponse(response);
  };

const getBalance =
  (space: ExtendedSpace): DelegationReader['getBalance'] =>
  async (id: string) => {
    const query: any = getBalanceQuery(id.toLowerCase());

    const response = await subgraphRequest(
      adjustUrl(space.delegationPortal.delegationApi),
      query
    );
    return formatBalanceResponse(response);
  };

const getDelegatingTo =
  (space: ExtendedSpace): DelegationReader['getDelegatingTo'] =>
  async (address: string): Promise<DelegatingTo> => {
    const provider = getProvider(space.network, PROVIDER_OPTIONS);
    const delegates = await call(
      provider,
      ['function delegates(address) view returns (address)'],
      [space.delegationPortal.delegationContract, 'delegates', [address]]
    );
    return { delegates };
  };

export const getDelegationReader = (
  space: ExtendedSpace
): DelegationReader => ({
  getDelegates: getDelegations(space),
  getDelegate: getDelegate(space),
  getBalance: getBalance(space),
  getDelegatingTo: getDelegatingTo(space)
});
