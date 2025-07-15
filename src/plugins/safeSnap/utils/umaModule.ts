import gql from 'graphql-tag';
import { defaultAbiCoder } from '@ethersproject/abi';
import { BigNumber } from '@ethersproject/bignumber';
import { Contract } from '@ethersproject/contracts';
import { keccak256 } from '@ethersproject/keccak256';
import { StaticJsonRpcProvider } from '@ethersproject/providers';
import { pack } from '@ethersproject/solidity';
import { toUtf8Bytes, toUtf8String } from '@ethersproject/strings';
import snapshot from '@snapshot-labs/snapshot.js';
import {
  ERC20_ABI,
  UMA_MODULE_ABI,
  UMA_ORACLE_ABI,
  contractData
} from '../constants';
import { pageEvents } from './events';
import filter from 'lodash/filter';

function getDeployBlock(network: string, name: string): number {
  const data = filter(contractData, { network, name });
  if (data.length === 1) return data[0].deployBlock ?? 0;
  return 0;
}
function getContractSubgraph(search: {
  network: string;
  name: string;
}): string {
  const results = filter(contractData, search);
  if (results.length > 1)
    throw new Error(
      `Too many results finding ${search.name} subgraph on network ${search.network}`
    );
  if (results.length < 1)
    throw new Error(
      `No results finding ${search.name} subgraph on network ${search.network}`
    );
  if (!results[0].subgraph)
    throw new Error(
      `No subgraph url defined for ${search.name} on network ${search.network}`
    );
  return results[0].subgraph;
}
function getOptimisticGovernorSubgraph(network: string): string {
  return getContractSubgraph({ network, name: 'OptimisticGovernor' });
}
function getOracleV3Subgraph(network: string): string {
  return getContractSubgraph({ network, name: 'OptimisticOracleV3' });
}

export const queryGql = async (url: string, query: string) => {
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
    return data.data;
  } catch (error) {
    throw new Error(`Network error: ${error.message}`);
  }
};

const findAssertionGql = async (
  network: string,
  params: { assertionId: string }
) => {
  const oracleUrl = getOracleV3Subgraph(network);
  const request = `
  {
    assertion(id:"${params.assertionId}"){
      assertionId
      expirationTime
      assertionHash
      assertionLogIndex
      settlementHash
    }
  }
  `;
  const result = await queryGql(oracleUrl, request);
  return result?.assertion;
};
// Search optimistic governor for individual proposal
const findProposalGql = async (
  network: string,
  params: { proposalHash; explanation; ogAddress }
) => {
  const subgraph = getOptimisticGovernorSubgraph(network);
  const request = `
  {
    proposals(where:{proposalHash:"${params.proposalHash}",explanation:"${
      params.explanation
    }",optimisticGovernor:"${params.ogAddress.toLowerCase()}"}){
      id
      executed
      assertionId
    }
  }
  `;
  const result = await queryGql(subgraph, request);
  return result?.proposals;
};

const getBondDetailsUma = async (
  provider: StaticJsonRpcProvider,
  moduleAddress: string
) => {
  const { web3Account } = useWeb3();

  const moduleContract = new Contract(moduleAddress, UMA_MODULE_ABI, provider);

  const erc20Contract = new Contract(
    await moduleContract.collateral(),
    ERC20_ABI,
    provider
  );

  const bondInfo = ref({
    collateral: erc20Contract.address,
    symbol: await erc20Contract.symbol(),
    decimals: await erc20Contract.decimals(),
    currentUserBondAllowance: BigNumber.from(0),
    currentUserBalance: BigNumber.from(0)
  });

  async function updateCurrentUserBondInfo() {
    bondInfo.value.currentUserBondAllowance = BigNumber.from(
      web3Account.value
        ? await erc20Contract.allowance(web3Account.value, moduleAddress)
        : 0
    );
    bondInfo.value.currentUserBalance = BigNumber.from(
      web3Account.value ? await erc20Contract.balanceOf(web3Account.value) : 0
    );
  }
  await updateCurrentUserBondInfo();

  return bondInfo.value;
};

export const getModuleDetailsUma = async (
  provider: StaticJsonRpcProvider,
  network: string,
  moduleAddress: string,
  explanation: string,
  transactions: any
) => {
  const moduleContract = new Contract(moduleAddress, UMA_MODULE_ABI, provider);
  const moduleDetails = await snapshot.utils.multicall(network, provider, UMA_MODULE_ABI, [
    [moduleAddress, 'avatar'],
    [moduleAddress, 'optimisticOracleV3'],
    [moduleAddress, 'rules'],
    [moduleAddress, 'bondAmount'],
    [moduleAddress, 'liveness']
  ]);
  let needsApproval = false;
  const optimisticOracle = moduleDetails[1][0];
  const rules = moduleDetails[2][0];
  const minimumBond = moduleDetails[3][0];
  const livenessPeriod = moduleDetails[4][0];
  const bondDetails = await getBondDetailsUma(provider, moduleAddress);

  if (
    Number(minimumBond) > 0 &&
    Number(minimumBond) > Number(bondDetails.currentUserBondAllowance)
  ) {
    needsApproval = true;
  }

  // Create ancillary data for proposal hash
  let ancillaryData = '';
  let proposalHash: string;
  if (transactions !== undefined) {
    proposalHash = keccak256(
      defaultAbiCoder.encode(
        ['(address to, uint8 operation, uint256 value, bytes data)[]'],
        [transactions]
      )
    );

    ancillaryData = pack(
      ['string', 'bytes', 'bytes', 'bytes', 'bytes', 'bytes', 'bytes', 'bytes'],
      [
        '',
        pack(['string', 'string'], ['proposalHash', ':']),
        toUtf8Bytes(proposalHash.replace(/^0x/, '')),
        pack(
          ['string', 'string', 'string', 'string'],
          [',', 'explanation', ':', '"']
        ),
        toUtf8Bytes(explanation.replace(/^0x/, '')),
        pack(
          ['string', 'string', 'string', 'string', 'string'],
          ['"', ',', 'rules', ':', '"']
        ),
        toUtf8Bytes(rules.replace(/^0x/, '')),
        pack(['string'], ['"'])
      ]
    );
  } else {
    return {
      dao: moduleDetails[0][0],
      oracle: moduleDetails[1][0],
      rules: moduleDetails[2][0],
      minimumBond: minimumBond,
      expiration: moduleDetails[4][0],
      allowance: bondDetails.currentUserBondAllowance,
      collateral: bondDetails.collateral,
      decimals: bondDetails.decimals,
      symbol: bondDetails.symbol,
      userBalance: bondDetails.currentUserBalance,
      needsBondApproval: needsApproval,
      noTransactions: true,
      activeProposal: false,
      assertionEvent: undefined,
      proposalExecuted: false,
      livenessPeriod: livenessPeriod
    };
  }
  // Check for active proposals. proposal hash can be identical across assertions
  // but the explanation field should be unique. we will filter this out later.
  const assertionId = await moduleContract.assertionIds(proposalHash);

  const activeProposal =
    assertionId !==
    '0x0000000000000000000000000000000000000000000000000000000000000000';

  // Search for requests with matching ancillary data
  const oracleContract = new Contract(
    optimisticOracle,
    UMA_ORACLE_ABI,
    provider
  );
  const latestBlock = await provider.getBlock('latest');
  // modify this per chain. this should be updated with constants for all chains. start block is og deploy block.
  // this needs to be optimized to reduce loading time, currently takes a long time to parse 3k blocks at a time.
  const oGstartBlock = getDeployBlock(network, 'OptimisticGovernor');
  const oOStartBlock = getDeployBlock(network, 'OptimisticOracleV3');
  const maxRange = 3000;

  const [assertionEvents, transactionsProposedEvents, executionEvents] =
    await Promise.all([
      pageEvents(
        oOStartBlock,
        latestBlock.number,
        maxRange,
        ({ start, end }: { start: number; end: number }) => {
          return oracleContract.queryFilter(
            oracleContract.filters.AssertionMade(),
            start,
            end
          );
        }
      ),
      pageEvents(
        oGstartBlock,
        latestBlock.number,
        maxRange,
        ({ start, end }: { start: number; end: number }) => {
          return moduleContract.queryFilter(
            moduleContract.filters.TransactionsProposed(),
            start,
            end
          );
        }
      ),
      pageEvents(
        oGstartBlock,
        latestBlock.number,
        maxRange,
        ({ start, end }: { start: number; end: number }) => {
          return moduleContract.queryFilter(
            moduleContract.filters.ProposalExecuted(proposalHash),
            start,
            end
          );
        }
      )
    ]);

  const thisModuleAssertionEvent = assertionEvents.filter(event => {
    return (
      event.args?.claim === ancillaryData &&
      event.args?.callbackRecipient === moduleAddress
    );
  });

  // Get the full proposal events (with state).
  const fullAssertionEvent = await Promise.all(
    thisModuleAssertionEvent.map(async event => {
      const assertion = await oracleContract.getAssertion(
        event.args?.assertionId
      );

      const isExpired =
        Math.floor(Date.now() / 1000) >= assertion.expirationTime.toNumber();

      return {
        assertionId: event?.args?.assertionId,
        expirationTimestamp: assertion.expirationTime,
        isExpired: isExpired,
        isSettled: assertion.settled,
        proposalHash: proposalHash,
        proposalTxHash: event.transactionHash,
        logIndex: event.logIndex
      };
    })
  );

  const thisProposalTransactionsProposedEvents =
    transactionsProposedEvents.filter(
      event => toUtf8String(event.args?.explanation) === explanation
    );

  const assertion = thisProposalTransactionsProposedEvents.map(
    tx => tx.args?.assertionId
  );

  const assertionIds = executionEvents.map(tx => tx.args?.assertionId);

  const proposalExecuted = assertion.some(assertionId =>
    assertionIds.includes(assertionId)
  );

  return {
    dao: moduleDetails[0][0],
    oracle: moduleDetails[1][0],
    rules: moduleDetails[2][0],
    minimumBond: minimumBond,
    expiration: moduleDetails[4][0],
    allowance: bondDetails.currentUserBondAllowance,
    collateral: bondDetails.collateral,
    decimals: bondDetails.decimals,
    symbol: bondDetails.symbol,
    userBalance: bondDetails.currentUserBalance,
    needsBondApproval: needsApproval,
    noTransactions: false,
    activeProposal: activeProposal,
    assertionEvent: fullAssertionEvent[0],
    proposalExecuted: proposalExecuted,
    livenessPeriod: livenessPeriod.toString()
  };
};

// This is intended to function identically to getModuleDetailsUma but use subgraphs rather than web3 events.
// This has a lot of duplicate code on purpose. Reducing code duplication will require a risky refactor,
// and we also want a fallback function in case the graph is down, so we will leave the original untouched for now.
export const getModuleDetailsUmaGql = async (
  provider: StaticJsonRpcProvider,
  network: string,
  moduleAddress: string,
  explanation: string,
  transactions: any
) => {
  const moduleContract = new Contract(moduleAddress, UMA_MODULE_ABI, provider);
  const moduleDetails = await snapshot.utils.multicall(network, provider, UMA_MODULE_ABI, [
    [moduleAddress, 'avatar'],
    [moduleAddress, 'optimisticOracleV3'],
    [moduleAddress, 'rules'],
    [moduleAddress, 'bondAmount'],
    [moduleAddress, 'liveness']
  ]);
  let needsApproval = false;
  const optimisticOracle = moduleDetails[1][0];
  const rules = moduleDetails[2][0];
  const minimumBond = moduleDetails[3][0];
  const livenessPeriod = moduleDetails[4][0];
  const bondDetails = await getBondDetailsUma(provider, moduleAddress);

  if (
    Number(minimumBond) > 0 &&
    Number(minimumBond) > Number(bondDetails.currentUserBondAllowance)
  ) {
    needsApproval = true;
  }

  let proposalHash: string;
  let encodedExplanation: string;
  if (transactions !== undefined && explanation !== undefined) {
    proposalHash = keccak256(
      defaultAbiCoder.encode(
        ['(address to, uint8 operation, uint256 value, bytes data)[]'],
        [transactions]
      )
    );
    encodedExplanation = pack(
      ['bytes'],
      [toUtf8Bytes(explanation.replace(/^0x/, ''))]
    );
  } else {
    return {
      dao: moduleDetails[0][0],
      oracle: moduleDetails[1][0],
      rules: moduleDetails[2][0],
      minimumBond: minimumBond,
      expiration: moduleDetails[4][0],
      allowance: bondDetails.currentUserBondAllowance,
      collateral: bondDetails.collateral,
      decimals: bondDetails.decimals,
      symbol: bondDetails.symbol,
      userBalance: bondDetails.currentUserBalance,
      needsBondApproval: needsApproval,
      noTransactions: true,
      activeProposal: false,
      assertionEvent: undefined,
      proposalExecuted: false,
      livenessPeriod: livenessPeriod
    };
  }
  // Check for active proposals. proposal hash can be identical across assertions
  // but the explanation field should be unique. we will filter this out later.
  const assertionId = await moduleContract.assertionIds(proposalHash);

  const activeProposal =
    assertionId !==
    '0x0000000000000000000000000000000000000000000000000000000000000000';

  const [proposal] = await findProposalGql(network, {
    proposalHash,
    explanation: encodedExplanation,
    ogAddress: moduleAddress
  });
  const proposalExecuted = proposal?.executed ? true : false;
  const assertion = proposal?.assertionId
    ? await findAssertionGql(network, { assertionId: proposal.assertionId })
    : undefined;

  const assertionEvent = assertion
    ? {
        assertionId: assertion.assertionId,
        expirationTimestamp: BigNumber.from(assertion.expirationTime),
        isExpired:
          Math.floor(Date.now() / 1000) >= Number(assertion.expirationTime),
        isSettled: assertion.settlementHash ? true : false,
        proposalHash,
        proposalTxHash: assertion.assertionHash,
        logIndex: assertion.assertionLogIndex
      }
    : undefined;

  return {
    dao: moduleDetails[0][0],
    oracle: moduleDetails[1][0],
    rules: moduleDetails[2][0],
    minimumBond: minimumBond,
    expiration: moduleDetails[4][0],
    allowance: bondDetails.currentUserBondAllowance,
    collateral: bondDetails.collateral,
    decimals: bondDetails.decimals,
    symbol: bondDetails.symbol,
    userBalance: bondDetails.currentUserBalance,
    needsBondApproval: needsApproval,
    noTransactions: false,
    activeProposal,
    assertionEvent,
    proposalExecuted,
    livenessPeriod: livenessPeriod.toString()
  };
};
