import snapshot from '@snapshot-labs/snapshot.js';
import { ERC20ABI, PROVIDER_OPTIONS } from '@/helpers/constants';
import getProvider from '@snapshot-labs/snapshot.js/src/utils/provider';

async function getERC20Account(
  provider: any,
  account: string,
  token: string,
  chainId: string,
  contract: string
) {
  const multi = new snapshot.utils.Multicaller(chainId, provider, ERC20ABI, {});
  multi.call('balance', token, 'balanceOf', [account]);
  multi.call('allowance', token, 'allowance', [account, contract]);
  return await multi.execute();
}

export function useAccount() {
  const { web3Account } = useWeb3();

  const account = ref<{
    balance?: string;
    allowance?: string;
  }>({});
  const updatingAccount = ref(false);

  async function updateAccount(
    token: string,
    chainId: string,
    contract: string
  ) {
    account.value = {};
    updatingAccount.value = true;
    const provider = getProvider(chainId, PROVIDER_OPTIONS);

    try {
      account.value = await getERC20Account(
        provider,
        web3Account.value,
        token,
        chainId,
        contract
      );
    } catch (e) {
      console.log('Error getting account', e);
    } finally {
      updatingAccount.value = false;
    }
  }

  return {
    account,
    updatingAccount,
    updateAccount
  };
}
