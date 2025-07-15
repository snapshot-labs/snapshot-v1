import { TreasuryWallet } from '@/helpers/interfaces';
import { defaultAbiCoder } from '@ethersproject/abi';
import { BigNumber } from '@ethersproject/bignumber';
import { Contract } from '@ethersproject/contracts';
import { keccak256 } from '@ethersproject/keccak256';
import { StaticJsonRpcProvider } from '@ethersproject/providers';
import { pack } from '@ethersproject/solidity';
import { toUtf8Bytes } from '@ethersproject/strings';
import snapshot from '@snapshot-labs/snapshot.js';
import getProvider from '@snapshot-labs/snapshot.js/src/utils/provider';
import memoize from 'lodash/memoize';
import detectProxyTarget from 'evm-proxy-detection';
import {
  ERC20_ABI,
  GNOSIS_SAFE_TRANSACTION_API_URLS,
  OPTIMISTIC_GOVERNOR_ABI,
  OPTIMISTIC_ORACLE_V3_ABI,
  SAFE_APP_URLS,
  contractData,
  safePrefixes,
  solidityZeroHexString
} from '../constants';
import {
  AssertionGql,
  AssertionMadeEvent,
  BalanceResponse,
  CollateralDetails,
  NFT,
  Network,
  OGModuleDetails,
  OGProposalState,
  OptimisticGovernorTransaction,
  ProposalExecutedEvent,
  SafeNetworkPrefix,
  SpaceConfigResponse,
  Token,
  TransactionsProposedEvent
} from '../types';
import { getPagedEvents } from './events';
import { shortenAddress, toChecksumAddress } from '@/helpers/utils';
import { getNativeAsset } from './coins';
import { formatUnits } from '@ethersproject/units';

/**
 * Calls the Gnosis Safe Transaction API
 *
 * Ideal usage is to specify the shape of the response with the generic type parameter, assuming that the shape of the response is known.
 */
async function callGnosisSafeTransactionApi<TResult = any>(
  network: Network,
  url: string
) {
  if (!GNOSIS_SAFE_TRANSACTION_API_URLS[network])
    throw new Error(`No gnosis safe api defined for network ${network}`);
  const apiUrl = GNOSIS_SAFE_TRANSACTION_API_URLS[network];
  const response = await fetch(apiUrl + url);
  return response.json() as TResult;
}

/**
 * Fetches the balances of the tokens owned by a given Safe.
 */
export const getGnosisSafeBalances = memoize(
  (network: Network, safeAddress: string) => {
    const checksumAddress = toChecksumAddress(safeAddress);
    const endpointPath = `/v1/safes/${checksumAddress}/balances?exclude_spam=true`;
    return callGnosisSafeTransactionApi<Partial<BalanceResponse>[]>(
      network,
      endpointPath
    );
  },
  (safeAddress, network) => `${safeAddress}_${network}`
);

/**
 * Fetches the collectibles owned by a given Safe.
 */
export const getGnosisSafeCollectibles = memoize(
  (network: Network, safeAddress: string) => {
    const endpointPath = `/v2/safes/${safeAddress}/collectibles/`;
    // the endpoint returns the data in this form, most likely to allow you to page the data.
    type Result = {
      count: number;
      next: unknown;
      previous: unknown;
      results: NFT[];
    };
    return callGnosisSafeTransactionApi<Result>(network, endpointPath);
  },
  (safeAddress, network) => `${safeAddress}_${network}`
);

/**
 * Fetches the block number of a given contract's deployment.
 */
function getDeployBlock(params: { network: Network; name: string }): number {
  const results = contractData.filter(
    contract =>
      contract.network === params.network && contract.name === params.name
  );
  if (results.length === 1) return results[0].deployBlock ?? 0;
  return 0;
}

export class ConfigError extends Error {
  constructor(message: string, responsibleVar: string) {
    super(message);
    this.name = 'CONFIG_ERROR';
  }
}

export function logIfErrorMessage(e: unknown, overrideMessage: string) {
  console.error(e instanceof Error ? e.message : overrideMessage);
}

/**
 * Fetches the subgraph url for a given contract on a given network.
 */
function getContractSubgraph(params: { network: Network; name: string }) {
  const results = contractData.filter(
    contract =>
      contract.network === params.network && contract.name === params.name
  );
  if (results.length > 1)
    throw new ConfigError(
      `Too many results finding ${params.name} subgraph on network ${params.network}`,
      'subgraph'
    );

  if (results.length < 1 || !results[0].subgraph)
    throw new ConfigError(
      `No subgraph url defined for ${params.name} on network ${params.network}`,
      'subgraph'
    );

  return results[0].subgraph;
}

/**
 * A helper that wraps the getContractSubgraph function to return the subgraph url for the OptimisticGovernor contract on a given network.
 */
function getOptimisticGovernorSubgraph(network: Network): string {
  return getContractSubgraph({ network, name: 'OptimisticGovernor' });
}

/**
 * A helper that wraps the getContractSubgraph function to return the subgraph url for the OptimisticOracleV3 contract on a given network.
 */
function getOracleV3Subgraph(network: Network): string {
  return getContractSubgraph({ network, name: 'OptimisticOracleV3' });
}

/**
 * Executes a graphql query.
 *
 * Ideal usage is to specify the shape of the response with the generic type parameter, assuming that the shape of the response is known.
 */
export const queryGql = async <Result = any>(url: string, query: string) => {
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json'
      },
      body: JSON.stringify({ query: query })
    });
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(
        `Network Error: ${response.status}, message: ${errorData.message}`
      );
    }
    const data = await response.json();
    // Throw an error if there are errors in the GraphQL response
    if (data.errors) {
      throw new Error(
        `GraphQL Error: ${data.errors.map(error => error.message).join(', ')}`
      );
    }
    return data.data as Result;
  } catch (error) {
    throw new Error(
      `Network error: ${error instanceof Error ? error.message : error}`
    );
  }
};

/**
 * Returns the address of the Optimistic Governor contract deployment associated with a given treasury (Safe) from the graph.
 */
export const getModuleAddressForTreasury = async (
  network: Network,
  treasuryAddress: string
) => {
  try {
    const subgraph = getOptimisticGovernorSubgraph(network);
    const query = `
    query getModuleAddressForTreasury {
        safe(id: "${treasuryAddress.toLowerCase()}") {
          optimisticGovernor {
            id
          }
        }
    }
    `;

    type Result = {
      safe: { optimisticGovernor: { id: string } };
    };

    const result = await queryGql<Result>(subgraph, query);
    return result?.safe?.optimisticGovernor?.id ?? '';
  } catch (error) {
    logIfErrorMessage(
      error,
      `Unable to get module address for treasury ${shortenAddress(
        treasuryAddress
      )} on network ${network}`
    );

    throw error;
  }
};

/**
 * Checks if a given treasury (Safe) has enabled oSnap.
 */
export const getIsOsnapEnabled = async (
  network: Network,
  safeAddress: string
) => {
  try {
    const subgraph = getOptimisticGovernorSubgraph(network);
    const query = `
        query isOSnapEnabled {
          safe(id:"${safeAddress.toLowerCase()}"){
            isOptimisticGovernorEnabled
          }
        }
      `;
    type Result = {
      safe: { isOptimisticGovernorEnabled: boolean };
    };
    const result = await queryGql<Result>(subgraph, query);
    return result?.safe?.isOptimisticGovernorEnabled ?? false;
  } catch (error) {
    logIfErrorMessage(
      error,
      `Unable to check if oSnap is enable for address ${shortenAddress(
        safeAddress
      )} on network ${network}`
    );
    throw error;
  }
};

/**
 * Takes an array of treasuries and checks if any of them have oSnap enabled.
 */
export const getSpaceHasOsnapEnabledTreasury = async (
  treasuries: TreasuryWallet[]
) => {
  const isOsnapEnabledOnTreasuriesResult = await Promise.all(
    treasuries.map(treasury =>
      getIsOsnapEnabled(treasury.network as Network, treasury.address)
    )
  );
  return isOsnapEnabledOnTreasuriesResult.some(
    isOsnapEnabled => isOsnapEnabled
  );
};

/**
 * Creates the url for the Safe app to configure oSnap.
 *
 * The data that the Safe app needs is encoded as URL search params.
 */
export function makeConfigureOsnapUrl(params: {
  safeAddress: string;
  network: Network;
  spaceName: string;
  spaceUrl: string;
  baseUrl?: string;
  appUrl?: string;
}) {
  const {
    safeAddress,
    network,
    spaceName,
    spaceUrl,
    appUrl = 'https://osnap.uma.xyz/'
  } = params;
  const baseUrl =
    params.baseUrl ??
    SAFE_APP_URLS[network] ??
    'https://app.safe.global/apps/open';
  const safeAddressPrefix = getSafeNetworkPrefix(network);
  const appUrlSearchParams = new URLSearchParams();
  appUrlSearchParams.set('spaceName', spaceName);
  appUrlSearchParams.set('spaceUrl', spaceUrl);
  const appUrlSearch = appUrlSearchParams.toString();
  const safeAppSearchParams = new URLSearchParams();
  safeAppSearchParams.set('safe', `${safeAddressPrefix}:${safeAddress}`);
  safeAppSearchParams.set('appUrl', `${appUrl}?${appUrlSearch}`);
  const safeAppSearch = safeAppSearchParams.toString();
  const url = `${baseUrl}?${safeAppSearch}`;
  return url;
}

/**
 * Fetches the details of a given assertion from the Optimistic Oracle V3 subgraph.
 */
async function getAssertionGql(params: {
  network: Network;
  assertionId: string;
}) {
  const { assertionId, network } = params;
  const oracleUrl = getOracleV3Subgraph(network);
  const request = `
  {
    assertion(id:"${assertionId}"){
      assertionId
      expirationTime
      assertionHash
      disputeHash
      settlementHash
      assertionLogIndex
      settlementResolution
    }
  }
  `;
  type Result = {
    assertion: AssertionGql | undefined;
  };
  const result = await queryGql<Result>(oracleUrl, request);
  return result?.assertion;
}
/**
 * Fetches the details of a given proposal from the Optimistic Governor subgraph.
 *
 * The subgraph uses the `assertionId` that comes from assertion events as the primary key for proposals.
 * However, this `assertionId` will be deleted if the proposal is disputed, so we can't use it to query the subgraph.
 * Instead, we use the `proposalHash` and `explanation` to query the subgraph.
 * The `explanation` contains the ipfs url of the proposal, which is the only way to distinguish between proposals with the same `proposalHash`.
 * This means we must use a `where` clause to filter the results, which is not ideal.
 */
async function getOgProposalGql(params: {
  network: Network;
  explanation: string;
  moduleAddress: string;
  proposalHash: string;
}) {
  const { network, explanation, moduleAddress, proposalHash } = params;
  const encodedExplanation = pack(
    ['bytes'],
    [toUtf8Bytes(explanation.replace(/^0x/, ''))]
  );
  const subgraph = getOptimisticGovernorSubgraph(network);
  const request = `
{
  proposals(where:{proposalHash:"${proposalHash}",explanation:"${encodedExplanation}",optimisticGovernor:"${moduleAddress.toLowerCase()}"}){
    id
    executed
    deleted
    assertionId
  }
}
`;
  type Result = {
    proposals: {
      id: string;
      executed: boolean;
      assertionId: string;
      deleted: boolean;
    }[];
  };
  const result = await queryGql<Result>(subgraph, request);
  // we can only use the gql `where` clause when querying a list, but we know that there will only be one result.
  return result?.proposals[0];
}

/**
 * Fetches the details of a Optimistic Governor module's collateral token.
 *
 * Returns the address, symbol, and decimals of the collateral token, along with the token contract for further querying.
 */
export async function getCollateralDetailsForProposal(
  provider: StaticJsonRpcProvider,
  moduleAddress: string
): Promise<CollateralDetails> {
  const moduleContract = new Contract(
    moduleAddress,
    OPTIMISTIC_GOVERNOR_ABI,
    provider
  );

  const erc20Contract = new Contract(
    await moduleContract.collateral(),
    ERC20_ABI,
    provider
  );

  const address = erc20Contract.address;
  const symbol: string = await erc20Contract.symbol();
  const decimals: BigNumber = await erc20Contract.decimals();

  return { erc20Contract, address, symbol, decimals };
}

/**
 * Fetches the allowance of a given collateral token for a given user.
 */
export async function getUserCollateralAllowance(
  erc20Contract: Contract,
  userAddress: string,
  moduleAddress: string
) {
  return erc20Contract.allowance(userAddress, moduleAddress);
}

/**
 * Fetches the balance of a given collateral token for a given user.
 */
export async function getUserCollateralBalance(
  erc20Contract: Contract,
  userAddress: string
) {
  return erc20Contract.balanceOf(userAddress);
}

/**
 * Fetches the details of a given Optimistic Governor module from the chain.
 *
 * Performs a multicall to fetch the oracle address, rules, minimum bond, and challenge period.
 */
export async function getOGModuleDetails(params: {
  provider: StaticJsonRpcProvider;
  network: Network;
  moduleAddress: string;
  transactions: OptimisticGovernorTransaction[];
}): Promise<OGModuleDetails> {
  const { provider, network, moduleAddress } = params;
  const moduleDetails: [
    [oracleAddress: string],
    [rules: string],
    [minimumBond: BigNumber],
    [challengePeriod: BigNumber]
  ] = await snapshot.utils.multicall(network, provider, OPTIMISTIC_GOVERNOR_ABI as any, [
    [moduleAddress, 'optimisticOracleV3'],
    [moduleAddress, 'rules'],
    [moduleAddress, 'getProposalBond'],
    [moduleAddress, 'liveness']
  ]);

  const oracleAddress = moduleDetails[0][0];
  const rules = moduleDetails[1][0];
  const minimumBond = moduleDetails[2][0];
  const challengePeriod = moduleDetails[3][0];

  return {
    moduleAddress,
    oracleAddress,
    rules,
    minimumBond,
    challengePeriod
  };
}

/**
 * Fetches the state of an Optimistic Governor proposal from the chain.
 *
 * This is a fallback function that should only be used if the subgraph is not available, because it is very slow.
 *
 * The contract is designed in such a way that it deletes the `assertionId` from the proposal if the proposal is disputed, _or_ if the transactions are executed successfully. This means we can't tell the difference between a proposal that has not yet been proposed, has been disputed, or that has been executed by querying the chain.
 *
 * Instead, we must query the chain for the proposal events, and then query the chain for the execution events, and then compare the two to determine the state of the proposal. This is very slow.
 */
export async function getOgProposalStateFromChain(params: {
  moduleDetails: OGModuleDetails;
  network: Network;
  proposalHash: string;
  explanation: string;
}): Promise<OGProposalState> {
  const { network, moduleDetails, explanation, proposalHash } = params;
  const { moduleAddress, oracleAddress } = moduleDetails;

  const provider = getProvider(network);
  const latestBlock = (await provider.getBlock('latest')).number;
  const oGstartBlock = getDeployBlock({ network, name: 'OptimisticGovernor' });
  const oOStartBlock = getDeployBlock({ network, name: 'OptimisticOracleV3' });
  const maxRange = 3000;

  const moduleContract = new Contract(
    moduleAddress,
    OPTIMISTIC_GOVERNOR_ABI,
    provider
  );
  const oracleContract = new Contract(
    oracleAddress,
    OPTIMISTIC_ORACLE_V3_ABI,
    provider
  );

  const assertionId: string = await moduleContract.assertionIds(proposalHash);
  const hasAssertionId = assertionIdIsNotZero(assertionId);

  if (hasAssertionId) {
    const assertionMadeEventForCurrentAssertionIdFilter =
      oracleContract.filters.AssertionMade(assertionId);

    const assertionMadeEvents = await getPagedEvents<AssertionMadeEvent>({
      contract: oracleContract,
      eventFilter: assertionMadeEventForCurrentAssertionIdFilter,
      startBlock: oOStartBlock,
      latestBlock,
      maxRange
    });

    // assertion ids are unique, so this will have only one result
    // we need to get an event instead of getting the `Assertion` struct from the chain because the oracle dapp needs the assertion transaction hash and the log index to link to the oracle dapp.
    const assertionMadeEvent = assertionMadeEvents[0];

    const expirationTime = assertionMadeEvent.args?.expirationTime.toNumber();
    const isInChallengePeriod = expirationTime * 1000 > Date.now();
    const assertionHash = assertionMadeEvent.transactionHash;
    const assertionLogIndex = assertionMadeEvent.logIndex.toString();

    if (isInChallengePeriod) {
      return {
        status: 'in-oo-challenge-period',
        assertionHash,
        assertionLogIndex,
        expirationTime
      };
    }

    return {
      status: 'can-request-tx-execution',
      assertionHash,
      assertionLogIndex
    };
  }

  const transactionsProposedEventFilter =
    moduleContract.filters.TransactionsProposed();

  const transactionsProposedEvents =
    await getPagedEvents<TransactionsProposedEvent>({
      contract: moduleContract,
      eventFilter: transactionsProposedEventFilter,
      startBlock: oGstartBlock,
      latestBlock,
      maxRange
    });

  const transactionsProposedEventsThatMatch = transactionsProposedEvents.filter(
    event =>
      event.args?.proposalHash === proposalHash &&
      event.args?.explanation === explanation
  );

  const hasTransactionProposedEvents =
    transactionsProposedEventsThatMatch.length > 0;

  // we can return early and skip querying for execution events if there are no proposal events
  if (!hasTransactionProposedEvents) {
    return {
      status: 'can-propose-to-og',
      isDisputed: false
    };
  }

  // the proposal hash is not indexed on the transactions proposed event unfortunately, but it is on the proposal executed event.
  // so at least we can use it for this one to narrow down the results.
  const proposalExecutedEventFilter =
    moduleContract.filters.ProposalExecuted(proposalHash);

  const proposalExecutedEvents = await getPagedEvents<ProposalExecutedEvent>({
    contract: moduleContract,
    eventFilter: proposalExecutedEventFilter,
    startBlock: oGstartBlock,
    latestBlock,
    maxRange
  });

  // we know that the transactions have been executed if there is an execution event with an assertion id that matches an assertion id for a proposal event
  let proposalExecuted = false;
  for (const proposalExecutedEvent of proposalExecutedEvents) {
    for (const transactionsProposedEvent of transactionsProposedEventsThatMatch) {
      if (
        proposalExecutedEvent.args?.assertionId ===
        transactionsProposedEvent.args?.assertionId
      ) {
        proposalExecuted = true;
        break;
      }
    }
  }

  if (proposalExecuted) {
    const assertionMadeEventForExecutedAssertionIdFilter =
      oracleContract.filters.AssertionMade(assertionId);

    const assertionMadeEvents = await getPagedEvents<AssertionMadeEvent>({
      contract: oracleContract,
      eventFilter: assertionMadeEventForExecutedAssertionIdFilter,
      startBlock: oOStartBlock,
      latestBlock,
      maxRange
    });

    // assertion ids are unique, so this will have only one result
    const assertionMadeEvent = assertionMadeEvents[0];

    return {
      status: 'transactions-executed',
      assertionHash: assertionMadeEvent.transactionHash,
      assertionLogIndex: assertionMadeEvent.logIndex.toString()
    };
  }

  return {
    status: 'can-propose-to-og',
    isDisputed: false
  };
}

/**
 * Fetches the state of an Optimistic Governor proposal from the subgraph.
 *
 * This is the preferred method of fetching the state of a proposal, because it is much faster than querying the chain.
 */
export async function getOGProposalStateGql(params: {
  network: Network;
  moduleAddress: string;
  proposalHash: string;
  explanation: string;
}): Promise<OGProposalState> {
  const { network } = params;
  const oGproposal = await getOgProposalGql(params);

  if (!oGproposal) {
    return { status: 'can-propose-to-og', isDisputed: false };
  }

  const { executed, assertionId, deleted } = oGproposal;

  const hasAssertionId = assertionIdIsNotZero(assertionId);

  // the subgraph records `ProposalDeleted` events, which are fired when a proposal is disputed.
  if (!hasAssertionId && deleted) {
    return { status: 'can-propose-to-og', isDisputed: true };
  }

  // no assertion made yet
  if (!hasAssertionId) {
    return { status: 'can-propose-to-og', isDisputed: false };
  }

  const assertion = await getAssertionGql({ network, assertionId });

  // cannot find assertion for some reason
  if (!assertion) {
    return { status: 'can-propose-to-og', isDisputed: false };
  }

  const {
    assertionHash,
    settlementHash,
    assertionLogIndex,
    settlementResolution
  } = assertion;

  // if the assertion is settled and the graph says the transactions have been executed, then we know the assertion passed and we can return early
  if (executed && settlementHash) {
    return {
      status: 'transactions-executed',
      assertionHash,
      assertionLogIndex
    };
  }

  // if the settlement hash exists and the settlement resolution is true, then we know that the assertion passed.
  // we already checked if the transactions were executed, so we know that the assertion passed but the transactions were not executed yet.
  if (settlementHash && settlementResolution) {
    return {
      status: 'can-request-tx-execution',
      assertionHash,
      assertionLogIndex
    };
  }

  const expirationTime = Number(assertion.expirationTime);
  const isExpired = Math.floor(Date.now() / 1000) >= expirationTime;

  // from the above checks, we know that the transactions have not been executed, the assertion has not been disputed, and the assertion has not been settled.
  // if the assertion challenge period has not yet expired, then we know we are still in the challenge period.
  if (!isExpired) {
    return {
      status: 'in-oo-challenge-period',
      assertionHash,
      assertionLogIndex,
      expirationTime
    };
  }

  // request execution if there is no settlement yet and liveness has expired
  return {
    status: 'can-request-tx-execution',
    assertionHash,
    assertionLogIndex
  };
}

/**
 * Querying for an assertion ID that does not map to a proposal hash will return '0x0000000000000000000000000000000000000000000000000000000000000000'
 */
function assertionIdIsNotZero(assertionId: string) {
  return assertionId !== solidityZeroHexString;
}

/**
 * Fetches the state of an Optimistic Governor proposal.
 *
 * This function will attempt to fetch the state of a proposal from the subgraph, and if that fails, it will fall back to querying the chain.
 */
export async function getOGProposalState(params: {
  moduleDetails: OGModuleDetails;
  network: Network;
  explanation: string;
  transactions: OptimisticGovernorTransaction[];
}): Promise<OGProposalState> {
  const { network, moduleDetails, explanation, transactions } = params;
  const { moduleAddress } = moduleDetails;
  const proposalHash = getProposalHashFromTransactions(transactions);
  try {
    return await getOGProposalStateGql({
      network,
      moduleAddress,
      explanation,
      proposalHash
    });
  } catch (error) {
    console.warn(
      'Error fetching OG proposal state from subgraph, falling back to chain',
      error
    );
    return getOgProposalStateFromChain({
      network,
      moduleDetails,
      explanation,
      proposalHash
    });
  }
}

/**
 * The `proposalHash` as represented in the Optimistic Governor contract is the keccak256 hash of the transactions that make up the proposal.
 */
export function getProposalHashFromTransactions(
  transactions: OptimisticGovernorTransaction[]
) {
  return keccak256(
    defaultAbiCoder.encode(
      ['(address to, uint8 operation, uint256 value, bytes data)[]'],
      [transactions]
    )
  );
}

/**
 * Returns the EIP-3770 prefix for a given network.
 *
 * @see SafeNetworkPrefix
 */
export function getSafeNetworkPrefix(network: Network): SafeNetworkPrefix {
  return safePrefixes[network];
}

/**
 * Returns the url for a given Safe app on a given network.
 */
export function getSafeAppLink(
  network: Network,
  safeAddress: string,
  { appUrl = 'https://app.safe.global', path = '/home' } = {
    appUrl: 'https://app.safe.global',
    path: '/home'
  }
) {
  const prefix = getSafeNetworkPrefix(network);
  return new URL(`${path}?safe=${prefix}:${safeAddress}`, appUrl).toString();
}

/**
 * Returns the url for an Optimistic Governor proposal's assertion on the Optimistic Oracle dapp.
 */
export function getOracleUiLink(
  chain: string,
  txHash: string,
  logIndex: number
) {
  if (Number(chain) !== 5 && Number(chain) !== 80001) {
    return `https://oracle.uma.xyz?transactionHash=${txHash}&eventIndex=${logIndex}`;
  }
  return `https://testnet.oracle.uma.xyz?transactionHash=${txHash}&eventIndex=${logIndex}`;
}

export async function fetchImplementationAddress(
  proxyAddress: string,
  network: string
): Promise<string | undefined> {
  try {
    const provider = getProvider(network);
    const requestFunc = ({ method, params }) => provider.send(method, params);
    return (await detectProxyTarget(proxyAddress, requestFunc)) ?? undefined;
  } catch (error) {
    console.error(error);
  }
}

/**
 * Check if a space's deployed (on-chain) settings are supported by oSnap bots for auto execution
 */
export async function isConfigCompliant(safeAddress: string, chainId: string) {
  const res = await fetch(
    `https://osnap.uma.xyz/api/space-config?address=${safeAddress}&chainId=${chainId}`
  );
  if (!res.ok) {
    throw new Error('Unable to fetch setting status');
  }
  const data = await res.json();
  return data as unknown as SpaceConfigResponse;
}

export async function fetchBalances(network: Network, safeAddress: string) {
  if (!safeAddress) {
    return [];
  }
  try {
    const balances = await getGnosisSafeBalances(network, safeAddress);
    const balancesWithNative = balances.map(balance => {
      if (!balance.tokenAddress || !balance.token) {
        return {
          ...balance,
          token: getNativeAsset(network),
          tokenAddress: 'main'
        };
      }
      return balance;
    });

    const tokens = await fetchTokens('https://tokens.uniswap.org');

    return enhanceTokensWithBalances(balancesWithNative, tokens, network);
  } catch (e) {
    console.warn('Error fetching balances', e);
    return [];
  }
}

export async function fetchTokens(url: string): Promise<Token[]> {
  try {
    const response = await fetch(url);
    const data = await response.json();
    return data.verifiedTokens?.tokens || data.tokens || [];
  } catch {
    return [];
  }
}

export function enhanceTokensWithBalances(
  balances: Partial<BalanceResponse>[],
  tokens: Token[],
  network: Network
) {
  return balances
    .filter(
      (balance): balance is BalanceResponse =>
        !!balance.token && !!balance.tokenAddress && !!balance.balance
    )
    .map(balance => enhanceTokenWithBalance(balance, tokens, network))
    .sort((a, b) => {
      if (a.address === 'main' && b.address !== 'main') return -1;
      if (!(a.address === 'main') && b.address === 'main') return 1;
      if (a.verified && !b.verified) return -1;
      if (!a.verified && b.verified) return +1;
      if (!a.balance || !b.balance) return 0;
      if (parseFloat(a.balance) > parseFloat(b.balance)) return -1;
      return 0;
    });
}

// gets token balances and also determines if the token is verified
function enhanceTokenWithBalance(
  balance: BalanceResponse,
  tokens: Token[],
  network: Network
): Token {
  const verifiedToken = getVerifiedToken(balance.tokenAddress, tokens);
  return {
    ...balance.token,
    address: balance.tokenAddress,
    balance: balance.balance
      ? formatUnits(balance.balance, balance.token.decimals)
      : '0',
    verified: !!verifiedToken,
    chainId: network
  };
}

function getVerifiedToken(tokenAddress: string, tokens: Token[]) {
  return tokens.find(
    token => token.address.toLowerCase() === tokenAddress.toLowerCase()
  );
}

export async function fetchCollectibles(
  network: Network,
  gnosisSafeAddress: string
) {
  try {
    const response = await getGnosisSafeCollectibles(
      network,
      gnosisSafeAddress
    );
    return response.results;
  } catch (error) {
    console.warn('Error fetching collectibles');
  }
  return [];
}
