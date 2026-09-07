import { getInstance } from '@snapshot-labs/lock/plugins/vue3';
import { ExtendedSpace } from '@/helpers/interfaces';
import utils from '@snapshot-labs/snapshot.js/src/utils';
import { PROVIDER_OPTIONS } from '@/helpers/constants';
import { computedAsync, useMemoize } from '@vueuse/core';
import { Contract } from '@ethersproject/contracts';

const defaultNetwork = import.meta.env.VITE_DEFAULT_NETWORK;

const getSafeVersion = useMemoize(
  async (networkKey: string, account: string) => {
    const provider = utils.getProvider(networkKey, PROVIDER_OPTIONS);
    const code = await provider.getCode(account);

    if (code === '0x') return undefined;

    const abi = ['function VERSION() view returns (string)'];
    const contract = new Contract(account, abi, provider);
    return contract.VERSION([]);
  }
);

export function useGnosis(space?: ExtendedSpace) {
  const { web3 } = useWeb3();

  const auth = getInstance();
  const connectorName = computed(() => auth.provider.value?.connectorName);

  const networkKey = computed(() => web3.value.network.key);

  const spaceNetworkKey = computed(() => space?.network);

  const isSafeContract = computedAsync(async () => {
    if (!web3.value.account) return false;

    const safeVersion = await getSafeVersion(
      networkKey.value,
      web3.value.account
    );

    return typeof safeVersion === 'string';
  }, false);

  const isGnosisSafe = computed(
    () =>
      web3.value?.walletConnectType === 'Gnosis Safe Multisig' ||
      web3.value?.walletConnectType === 'WalletConnect Safe App' ||
      web3.value?.walletConnectType === 'Den' ||
      connectorName.value === 'gnosis' ||
      isSafeContract.value
  );

  const isGnosisAndNotDefaultNetwork = computed(() => {
    return isGnosisSafe.value && networkKey.value !== defaultNetwork;
  });

  const isGnosisAndNotSpaceNetwork = computed(() => {
    return isGnosisSafe.value && networkKey.value !== spaceNetworkKey.value;
  });

  return {
    isGnosisSafe,
    isGnosisAndNotDefaultNetwork,
    isGnosisAndNotSpaceNetwork
  };
}
