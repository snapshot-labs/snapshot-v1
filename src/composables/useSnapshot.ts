import { getBlockNumber } from '@snapshot-labs/snapshot.js/src/utils/web3';
import getProvider from '@snapshot-labs/snapshot.js/src/utils/provider';
import { PROVIDER_OPTIONS } from '@/helpers/constants';

const isLoading = ref(false);
const error = ref(false);

export function useSnapshot() {
  async function getSnapshot(network: string): Promise<number> {
    try {
      isLoading.value = true;
      error.value = false;
      const currentBlock = await getBlockNumber(
        getProvider(network, PROVIDER_OPTIONS)
      );
      console.log('Snapshot block number', currentBlock);
      return currentBlock - 4;
    } catch (e) {
      error.value = true;
      return 0;
    } finally {
      isLoading.value = false;
    }
  }

  return {
    getSnapshot,
    isSnapshotLoading: isLoading,
    errorFetchingSnapshot: error
  };
}
