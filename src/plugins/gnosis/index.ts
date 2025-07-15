import { getAddress } from '@ethersproject/address';
import snapshot from '@snapshot-labs/snapshot.js';

const UNISWAP_V2_SUBGRAPH_URL = {
  '1': 'https://subgrapher.snapshot.org/subgraph/arbitrum/EYCKATKGBKLWvSfwvBjzfCBmGwYNdVkduYXVivCsLRFu',
  '100': 'https://subgrapher.snapshot.org/subgraph/arbitrum/F5u74NSaLF92s1qUSacQU4fmWizmK9yqDhXAq6RPtgky',
};

const OMEN_SUBGRAPH_URL = {
  '1': 'https://subgrapher.snapshot.org/subgraph/arbitrum/7JbjEfSTme3LioqJ7SJZ9Y1GhSD55X98Btd8fg7iYUPT',
  '100': 'https://subgrapher.snapshot.org/subgraph/arbitrum/9fUVQpFwzpdWS9bq5WkAnmKbNNcoBwatMR4yZq81pbbz'
};

const WETH_ADDRESS = {
  '1': '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
  '4': '0xc778417e063141139fce010982780140aa0cd5ab',
  '100': '0x6A023CCd1ff6F2045C3309768eAd9E68F978f6e1'
};

const OMEN_GQL_QUERY = {
  condition: {
    __args: {
      id: undefined
    },
    id: true,
    fixedProductMarketMakers: {
      id: true,
      collateralToken: true,
      outcomeTokenAmounts: true,
      outcomeTokenMarginalPrices: true
    }
  }
};

const UNISWAP_V2_GQL_QUERY = {
  pairsTokens: {
    __aliasFor: 'pairs',
    __args: {
      where: {
        token0: true,
        token1: true
      }
    },
    token0Price: true
  },
  pairsTokensInverted: {
    __aliasFor: 'pairs',
    __args: {
      where: {
        token0: true,
        token1: true
      }
    },
    token1Price: true
  },
  pairsTokens0: {
    __aliasFor: 'pairs',
    __args: {
      where: {
        token0: true,
        token1: true
      }
    },
    token0Price: true
  },
  pairsTokens1: {
    __aliasFor: 'pairs',
    __args: {
      where: {
        token0: true,
        token1: true
      }
    },
    token0Price: true
  }
};

const erc20Abi = [
  {
    constant: true,
    inputs: [],
    name: 'name',
    outputs: [{ name: '', type: 'string' }],
    payable: false,
    stateMutability: 'view',
    type: 'function'
  },
  {
    constant: false,
    inputs: [{ name: '_upgradedAddress', type: 'address' }],
    name: 'deprecate',
    outputs: [],
    payable: false,
    stateMutability: 'nonpayable',
    type: 'function'
  },
  {
    constant: false,
    inputs: [
      { name: '_spender', type: 'address' },
      { name: '_value', type: 'uint256' }
    ],
    name: 'approve',
    outputs: [],
    payable: false,
    stateMutability: 'nonpayable',
    type: 'function'
  },
  {
    constant: true,
    inputs: [],
    name: 'deprecated',
    outputs: [{ name: '', type: 'bool' }],
    payable: false,
    stateMutability: 'view',
    type: 'function'
  },
  {
    constant: false,
    inputs: [{ name: '_evilUser', type: 'address' }],
    name: 'addBlackList',
    outputs: [],
    payable: false,
    stateMutability: 'nonpayable',
    type: 'function'
  },
  {
    constant: true,
    inputs: [],
    name: 'totalSupply',
    outputs: [{ name: '', type: 'uint256' }],
    payable: false,
    stateMutability: 'view',
    type: 'function'
  },
  {
    constant: false,
    inputs: [
      { name: '_from', type: 'address' },
      { name: '_to', type: 'address' },
      { name: '_value', type: 'uint256' }
    ],
    name: 'transferFrom',
    outputs: [],
    payable: false,
    stateMutability: 'nonpayable',
    type: 'function'
  },
  {
    constant: true,
    inputs: [],
    name: 'upgradedAddress',
    outputs: [{ name: '', type: 'address' }],
    payable: false,
    stateMutability: 'view',
    type: 'function'
  },
  {
    constant: true,
    inputs: [{ name: '', type: 'address' }],
    name: 'balances',
    outputs: [{ name: '', type: 'uint256' }],
    payable: false,
    stateMutability: 'view',
    type: 'function'
  },
  {
    constant: true,
    inputs: [],
    name: 'decimals',
    outputs: [{ name: '', type: 'uint256' }],
    payable: false,
    stateMutability: 'view',
    type: 'function'
  },
  {
    constant: true,
    inputs: [],
    name: 'maximumFee',
    outputs: [{ name: '', type: 'uint256' }],
    payable: false,
    stateMutability: 'view',
    type: 'function'
  },
  {
    constant: true,
    inputs: [],
    name: '_totalSupply',
    outputs: [{ name: '', type: 'uint256' }],
    payable: false,
    stateMutability: 'view',
    type: 'function'
  },
  {
    constant: false,
    inputs: [],
    name: 'unpause',
    outputs: [],
    payable: false,
    stateMutability: 'nonpayable',
    type: 'function'
  },
  {
    constant: true,
    inputs: [{ name: '_maker', type: 'address' }],
    name: 'getBlackListStatus',
    outputs: [{ name: '', type: 'bool' }],
    payable: false,
    stateMutability: 'view',
    type: 'function'
  },
  {
    constant: true,
    inputs: [
      { name: '', type: 'address' },
      { name: '', type: 'address' }
    ],
    name: 'allowed',
    outputs: [{ name: '', type: 'uint256' }],
    payable: false,
    stateMutability: 'view',
    type: 'function'
  },
  {
    constant: true,
    inputs: [],
    name: 'paused',
    outputs: [{ name: '', type: 'bool' }],
    payable: false,
    stateMutability: 'view',
    type: 'function'
  },
  {
    constant: true,
    inputs: [{ name: 'who', type: 'address' }],
    name: 'balanceOf',
    outputs: [{ name: '', type: 'uint256' }],
    payable: false,
    stateMutability: 'view',
    type: 'function'
  },
  {
    constant: false,
    inputs: [],
    name: 'pause',
    outputs: [],
    payable: false,
    stateMutability: 'nonpayable',
    type: 'function'
  },
  {
    constant: true,
    inputs: [],
    name: 'getOwner',
    outputs: [{ name: '', type: 'address' }],
    payable: false,
    stateMutability: 'view',
    type: 'function'
  },
  {
    constant: true,
    inputs: [],
    name: 'owner',
    outputs: [{ name: '', type: 'address' }],
    payable: false,
    stateMutability: 'view',
    type: 'function'
  },
  {
    constant: true,
    inputs: [],
    name: 'symbol',
    outputs: [{ name: '', type: 'string' }],
    payable: false,
    stateMutability: 'view',
    type: 'function'
  },
  {
    constant: false,
    inputs: [
      { name: '_to', type: 'address' },
      { name: '_value', type: 'uint256' }
    ],
    name: 'transfer',
    outputs: [],
    payable: false,
    stateMutability: 'nonpayable',
    type: 'function'
  },
  {
    constant: false,
    inputs: [
      { name: 'newBasisPoints', type: 'uint256' },
      { name: 'newMaxFee', type: 'uint256' }
    ],
    name: 'setParams',
    outputs: [],
    payable: false,
    stateMutability: 'nonpayable',
    type: 'function'
  },
  {
    constant: false,
    inputs: [{ name: 'amount', type: 'uint256' }],
    name: 'issue',
    outputs: [],
    payable: false,
    stateMutability: 'nonpayable',
    type: 'function'
  },
  {
    constant: false,
    inputs: [{ name: 'amount', type: 'uint256' }],
    name: 'redeem',
    outputs: [],
    payable: false,
    stateMutability: 'nonpayable',
    type: 'function'
  },
  {
    constant: true,
    inputs: [
      { name: '_owner', type: 'address' },
      { name: '_spender', type: 'address' }
    ],
    name: 'allowance',
    outputs: [{ name: 'remaining', type: 'uint256' }],
    payable: false,
    stateMutability: 'view',
    type: 'function'
  },
  {
    constant: true,
    inputs: [],
    name: 'basisPointsRate',
    outputs: [{ name: '', type: 'uint256' }],
    payable: false,
    stateMutability: 'view',
    type: 'function'
  },
  {
    constant: true,
    inputs: [{ name: '', type: 'address' }],
    name: 'isBlackListed',
    outputs: [{ name: '', type: 'bool' }],
    payable: false,
    stateMutability: 'view',
    type: 'function'
  },
  {
    constant: false,
    inputs: [{ name: '_clearedUser', type: 'address' }],
    name: 'removeBlackList',
    outputs: [],
    payable: false,
    stateMutability: 'nonpayable',
    type: 'function'
  },
  {
    constant: true,
    inputs: [],
    name: 'MAX_UINT',
    outputs: [{ name: '', type: 'uint256' }],
    payable: false,
    stateMutability: 'view',
    type: 'function'
  },
  {
    constant: false,
    inputs: [{ name: 'newOwner', type: 'address' }],
    name: 'transferOwnership',
    outputs: [],
    payable: false,
    stateMutability: 'nonpayable',
    type: 'function'
  },
  {
    constant: false,
    inputs: [{ name: '_blackListedUser', type: 'address' }],
    name: 'destroyBlackFunds',
    outputs: [],
    payable: false,
    stateMutability: 'nonpayable',
    type: 'function'
  },
  {
    inputs: [
      { name: '_initialSupply', type: 'uint256' },
      { name: '_name', type: 'string' },
      { name: '_symbol', type: 'string' },
      { name: '_decimals', type: 'uint256' }
    ],
    payable: false,
    stateMutability: 'nonpayable',
    type: 'constructor'
  },
  {
    anonymous: false,
    inputs: [{ indexed: false, name: 'amount', type: 'uint256' }],
    name: 'Issue',
    type: 'event'
  },
  {
    anonymous: false,
    inputs: [{ indexed: false, name: 'amount', type: 'uint256' }],
    name: 'Redeem',
    type: 'event'
  },
  {
    anonymous: false,
    inputs: [{ indexed: false, name: 'newAddress', type: 'address' }],
    name: 'Deprecate',
    type: 'event'
  },
  {
    anonymous: false,
    inputs: [
      { indexed: false, name: 'feeBasisPoints', type: 'uint256' },
      { indexed: false, name: 'maxFee', type: 'uint256' }
    ],
    name: 'Params',
    type: 'event'
  },
  {
    anonymous: false,
    inputs: [
      { indexed: false, name: '_blackListedUser', type: 'address' },
      { indexed: false, name: '_balance', type: 'uint256' }
    ],
    name: 'DestroyedBlackFunds',
    type: 'event'
  },
  {
    anonymous: false,
    inputs: [{ indexed: false, name: '_user', type: 'address' }],
    name: 'AddedBlackList',
    type: 'event'
  },
  {
    anonymous: false,
    inputs: [{ indexed: false, name: '_user', type: 'address' }],
    name: 'RemovedBlackList',
    type: 'event'
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: 'owner', type: 'address' },
      { indexed: true, name: 'spender', type: 'address' },
      { indexed: false, name: 'value', type: 'uint256' }
    ],
    name: 'Approval',
    type: 'event'
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: 'from', type: 'address' },
      { indexed: true, name: 'to', type: 'address' },
      { indexed: false, name: 'value', type: 'uint256' }
    ],
    name: 'Transfer',
    type: 'event'
  },
  { anonymous: false, inputs: [], name: 'Pause', type: 'event' },
  { anonymous: false, inputs: [], name: 'Unpause', type: 'event' }
];

/**
 * Returns the token `name` and `symbol` from a given ERC-20 contract address
 * @param web3
 * @param tokenAddress
 * @param method
 */
const getTokenInfo = async (web3, tokenAddress) => {
  return await snapshot.utils.multicall(web3._network.chainId.toString(), web3, erc20Abi, [
    [tokenAddress, 'name'],
    [tokenAddress, 'symbol']
  ]);
};

export default class Plugin {
  public author = 'davidalbela';
  public version = '0.0.1';
  public name = 'Gnosis Impact';
  public website = 'https://gnosis.io';
  public options: any;

  async getTokenInfo(web3: any, tokenAddress: string) {
    try {
      const tokenInfo = await getTokenInfo(web3, tokenAddress);
      return {
        address: tokenAddress,
        checksumAddress: getAddress(tokenAddress),
        name: tokenInfo[0][0],
        symbol: tokenInfo[1][0]
      };
    } catch (e) {
      throw new Error(e);
    }
  }

  async getOmenCondition(network: string, conditionId: any) {
    try {
      const query = OMEN_GQL_QUERY;
      query.condition.__args.id = conditionId;
      return await snapshot.utils.subgraphRequest(OMEN_SUBGRAPH_URL[network], query);
    } catch (e) {
      console.error(e);
    }
  }

  async getUniswapPair(network: string, token0: any, token1: any) {
    try {
      const query = UNISWAP_V2_GQL_QUERY;
      query.pairsTokens.__args.where = {
        token0: token0.toLowerCase(),
        token1: token1.toLowerCase()
      };
      query.pairsTokensInverted.__args.where = {
        token0: token1.toLowerCase(),
        token1: token0.toLowerCase()
      };
      query.pairsTokens0.__args.where = {
        token0: token0.toLowerCase(),
        token1: WETH_ADDRESS[network]
      };
      query.pairsTokens1.__args.where = {
        token0: token1.toLowerCase(),
        token1: WETH_ADDRESS[network]
      };
      const result = await subgraphRequest(
        UNISWAP_V2_SUBGRAPH_URL[network],
        query
      );

      if (result.pairsTokens.length > 0) {
        return result.pairsTokens[0];
      } else if (result.pairsTokensInverted.length > 0) {
        return {
          token0Price: result.pairsTokensInverted[0].token1Price
        };
      } else if (
        result.pairsTokens0.length > 0 &&
        result.pairsTokens1.length > 0
      ) {
        return {
          token0Price: (
            parseFloat(result.pairsTokens0[0].token0Price) /
            parseFloat(result.pairsTokens1[0].token0Price)
          ).toString()
        };
      }
      throw new Error(
        `Does not exist market pairs for ${token0} and ${token1}.`
      );
    } catch (e) {
      console.error(e);
    }
  }
}
