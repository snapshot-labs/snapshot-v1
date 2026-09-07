import { PROVIDER_OPTIONS } from '@/helpers/constants';
import {
  createProviderUrl,
  normalizeOptions
} from '@snapshot-labs/snapshot.js/src/utils/provider';

const rpcUrl = (chainId: number) =>
  createProviderUrl(String(chainId), normalizeOptions(PROVIDER_OPTIONS));

const connectors = {
  injected: {
    id: 'injected',
    name: 'MetaMask'
  },
  walletconnect: {
    id: 'walletconnect',
    name: 'WalletConnect',
    network: '1',
    options: {
      projectId: 'e6454bd61aba40b786e866a69bd4c5c6',
      chains: [],
      optionalChains: [
        1, 4, 5, 10, 42, 56, 100, 137, 146, 246, 250, 4002, 1088, 42161, 73799,
        33139, 11155111
      ],
      optionalMethods: [
        'eth_sendTransaction',
        'personal_sign',
        'eth_accounts',
        'eth_signTypedData_v4'
      ],
      rpcMap: Object.fromEntries(
        [1, 4, 5, 10, 42, 56, 100, 137, 246, 42161, 73799, 11155111].map(id => [
          id,
          rpcUrl(id)
        ])
      ),
      showQrModal: true
    },
    icon: 'ipfs://QmZRVqHpgRemw13aoovP2EaQdVtjzXRaQGQZsCLXWaNn9x'
  },
  walletlink: {
    id: 'walletlink',
    name: 'Coinbase Wallet',
    network: '1',
    options: {
      appName: 'Snapshot',
      appChainIds: [1],
      appLogoUrl: 'https://snapshot.box/favicon.svg'
    },
    icon: 'ipfs://QmbJKEaeMz6qR3DmJSTxtYtrZeQPptVfnnYK72QBsvAw5q',
    hidden: false
  },
  portis: {
    id: 'portis',
    name: 'Portis',
    network: '1',
    options: {
      dappId: '3eb93706-c71d-456b-b4eb-322ea27f7d48',
      network: 'mainnet'
    },
    icon: 'ipfs://QmNuLXa47xSrDNKRfpPNhoFTuoztvtWCcwGnPpT5MXJWMb'
  },
  stargazer: {
    id: 'stargazer',
    name: 'Stargazer',
    icon: 'ipfs://bafkreiapdizo36f3yeg7g6l46f7ahbbkyo4otufnfyqri6louysr3grpzy'
  },
  gnosis: {
    id: 'gnosis',
    name: 'Gnosis Safe',
    icon: 'ipfs://QmfJUHZLtRvadM7fvEJUWWxhS869KXXCMxPCr7TUqkwvUc',
    hidden: true
  },
  kaikas: {
    id: 'kaikas',
    name: 'Kaikas',
    icon: 'ipfs://QmXD4kkxKzXKbbBu3zAzZ279Sm91JhxCDAwSypyzxwe2Hj'
  }
};

export default connectors;
