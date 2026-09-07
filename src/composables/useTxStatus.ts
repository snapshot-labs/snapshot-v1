import { useStorage } from '@vueuse/core';
import getProvider from '@snapshot-labs/snapshot.js/src/utils/provider';
import { PROVIDER_OPTIONS } from '@/helpers/constants';
import { PendingTransaction } from '@/helpers/interfaces';

const PENDING_TRANSACTIONS_STORAGE_KEY = 'snapshot.pendingTransactions';
const pendingTransactions = useStorage(
  PENDING_TRANSACTIONS_STORAGE_KEY,
  [] as PendingTransaction[]
);

export function useTxStatus() {
  const { web3 } = useWeb3();

  const pendingTransactionsWithHash = computed(() => {
    return pendingTransactions.value.filter(tx => tx.hash);
  });

  const createPendingTransaction = (hash?: string) => {
    const createdAt = Date.now();
    const id = createdAt.toString();
    const tx = {
      id,
      network: web3.value.network.key,
      createdAt,
      hash: hash ?? null
    };
    pendingTransactions.value.push(tx);
    return id;
  };

  const updatePendingTransaction = (
    id: string,
    payload: Partial<PendingTransaction>
  ) => {
    const tx = pendingTransactions.value.find(tx => tx.id === id);
    if (tx) {
      Object.assign(tx, payload);
    }
  };

  const removePendingTransaction = (id: string) => {
    const tx = pendingTransactions.value.find(tx => tx.id === id);
    if (tx) {
      pendingTransactions.value = pendingTransactions.value.filter(
        tx => tx.id !== id
      );
    }
  };

  const restorePendingTransactions = () => {
    pendingTransactions.value.forEach(async tx => {
      if (tx.hash) {
        if (Date.now() > tx.createdAt + 1000 * 60)
          return removePendingTransaction(tx.id);
        try {
          const provider = getProvider(tx.network, PROVIDER_OPTIONS);
          await provider.waitForTransaction(tx.hash, 1, 1000 * 60 * 4);
        } finally {
          removePendingTransaction(tx.id);
        }
      } else {
        if (Date.now() > tx.createdAt + 1000 * 10)
          return removePendingTransaction(tx.id);
      }
    });
  };

  return {
    pendingTransactions,
    pendingTransactionsWithHash,
    createPendingTransaction,
    updatePendingTransaction,
    removePendingTransaction,
    restorePendingTransactions
  };
}
