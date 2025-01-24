export const ETH_CONTRACT = '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';

export const DEFAULT_ETH_ADDRESS = '0x0000000000000000000000000000000000000000';

export const SNAPSHOT_BREAKPOINTS = {
  xs: '420px',
  sm: '544px',
  md: '768px',
  lg: '1012px',
  xl: '1280px',
  '2xl': '1536px'
};

export const KNOWN_HOSTS = [
  'app.safe.global',
  'horizen-eon.safe.onchainden.com',
  'pilot.gnosisguild.org',
  'metissafe.tech',
  'multisig.mantle.xyz',
  'wallet.ambire.com',
  'multisig.moonbeam.network',
  'worldassociation.org',
  'safe.mainnet.frax.com',
  'safe.fantom.network',
  'safe.apechain.com'
];

// All subdomains of these domains are allowed
export const KNOWN_DOMAINS = ['blockscout.com'];

export const SPACE_CATEGORIES = [
  'protocol',
  'social',
  'investment',
  'grant',
  'service',
  'media',
  'creator',
  'collector',
  'ai-agent',
  'gaming',
  'wallet',
  'music',
  'layer-2',
  'defai',
  'defi',
  'rwa',
  'depin',
  'meme'
];

export const ERC20ABI = [
  'constructor(string name, string symbol)',
  'event Approval(address indexed owner, address indexed spender, uint256 value)',
  'event Transfer(address indexed from, address indexed to, uint256 value)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function approve(address spender, uint256 amount) returns (bool)',
  'function balanceOf(address account) view returns (uint256)',
  'function decimals() view returns (uint8)',
  'function decreaseAllowance(address spender, uint256 subtractedValue) returns (bool)',
  'function increaseAllowance(address spender, uint256 addedValue) returns (bool)',
  'function name() view returns (string)',
  'function symbol() view returns (string)',
  'function totalSupply() view returns (uint256)',
  'function transfer(address recipient, uint256 amount) returns (bool)',
  'function transferFrom(address sender, address recipient, uint256 amount) returns (bool)'
];

export const COINGECKO_ASSET_PLATFORMS = {
  '137': 'polygon-pos',
  '42161': 'arbitrum-one'
};

export const COINGECKO_BASE_ASSETS = {
  '137': 'matic-network',
  '42161': 'ethereum'
};

export type ChainCurrency = {
  name: string;
  symbol: string;
  decimals: number;
  contractAddress: string;
};

export const CHAIN_CURRENCIES: Record<string, ChainCurrency> = {
  '1': {
    name: 'Ether',
    symbol: 'ETH',
    decimals: 18,
    contractAddress: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee'
  },
  '8453': {
    name: 'Ether',
    symbol: 'ETH',
    decimals: 18,
    contractAddress: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee'
  },
  '11155111': {
    name: 'Sepolia Ether',
    symbol: 'SepoliaETH',
    decimals: 18,
    contractAddress: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee'
  },
  '137': {
    name: 'MATIC',
    symbol: 'MATIC',
    decimals: 18,
    contractAddress: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee'
  },
  '42161': {
    name: 'Arbitrum',
    symbol: 'ARB',
    decimals: 18,
    contractAddress: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee'
  }
};

export const TWO_WEEKS = 1209600;
export const ONE_DAY = 86400;

export const SNAPSHOT_HELP_LINK = 'https://help.snapshot.org/en';

export const BOOST_ENABLED_VOTING_TYPES = [
  'basic',
  'single-choice',
  'ranked-choice'
];
