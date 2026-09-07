import { useEns } from './useEns';
import getProvider from '@snapshot-labs/snapshot.js/src/utils/provider';
import { PROVIDER_OPTIONS } from '@/helpers/constants';
import { contractAddress } from '@/helpers/delegation';
import { formatBytes32String } from '@ethersproject/strings';
import {
  sendTransaction,
  sleep,
  SNAPSHOT_SUBGRAPH_URL
} from '@snapshot-labs/snapshot.js/src/utils';
import { getInstance } from '@snapshot-labs/lock/plugins/vue3';

export function useDelegate() {
  const abi = ['function setDelegate(bytes32 id, address delegate)'];

  const auth = getInstance();
  const { notify } = useFlashNotification();
  const {
    createPendingTransaction,
    updatePendingTransaction,
    removePendingTransaction
  } = useTxStatus();
  const { validEnsTlds } = useEns();
  const { t } = useI18n();
  const { web3 } = useWeb3();

  const loading = ref(false);

  const networkKey = computed(() => web3.value.network.key);

  const networkSupportsDelegate = computed(
    () => SNAPSHOT_SUBGRAPH_URL[networkKey.value] !== undefined
  );

  async function delegateTo(address, spaceId = '') {
    loading.value = true;
    const txPendingId = createPendingTransaction();
    try {
      let ethAddress = address;
      if (validEnsTlds.includes(address.split('.').pop())) {
        const networkId = import.meta.env.VITE_DEFAULT_NETWORK;
        const provider = getProvider(networkId, PROVIDER_OPTIONS);
        ethAddress = await provider.resolveName(address);
      }
      const tx = await sendTransaction(
        auth.web3,
        contractAddress,
        abi,
        'setDelegate',
        [formatBytes32String(spaceId), ethAddress]
      );
      notify(t('notify.transactionSent'));
      updatePendingTransaction(txPendingId, { hash: tx.hash });
      loading.value = false;
      const receipt = await tx.wait();
      console.log('Receipt', receipt);
      await sleep(3e3);
      notify(t('notify.delegationSuccess'));
    } catch (e) {
      notify(['red', t('notify.somethingWentWrong')]);
      console.log(e);
    } finally {
      loading.value = false;
      removePendingTransaction(txPendingId);
    }
  }

  return {
    delegateTo,
    delegationLoading: computed(() => loading.value),
    networkSupportsDelegate,
    networkKey
  };
}
