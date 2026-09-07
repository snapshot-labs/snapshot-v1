<script setup lang="ts">
import { isAddress } from '@ethersproject/address';
import { ERC20ABI, PROVIDER_OPTIONS } from '@/helpers/constants';
import { Token } from '@/helpers/alchemy';
import snapshot from '@snapshot-labs/snapshot.js';

const props = defineProps<{
  selectedToken?: Token;
  open: boolean;
  tokens: Token[];
  network: string;
}>();

const emit = defineEmits(['close', 'update:selectedToken']);

const { web3Account } = useWeb3();

const searchInput = ref('');
const customTokenLoading = ref(false);
const customToken: Ref<Token | null> = ref(null);
const isSearchValueValidToken = ref(false);

const tokensFiltered = computed(() => {
  if (customToken.value && isSearchValueValidToken.value) {
    return [customToken.value];
  }

  return props.tokens.filter(filterToken);
});

function filterToken(token: Token) {
  const searchQuery = searchInput.value.toLowerCase();
  return isTokenMatchingSearch(token, searchQuery) || !searchInput.value;
}

function isTokenMatchingSearch(token: Token, searchQuery: string) {
  return [token.symbol, token.name, token.contractAddress].some(
    property => property?.toLowerCase().includes(searchQuery)
  );
}

function handleTokenClick(token: Token) {
  emit('update:selectedToken', token);
  emit('close');
}

async function fetchCustomToken(address: string) {
  if (props.tokens.find(asset => asset.contractAddress === address)) return;

  customTokenLoading.value = true;

  const provider = snapshot.utils.getProvider(props.network, PROVIDER_OPTIONS);
  const tokens = [address];

  try {
    const multi = new snapshot.utils.Multicaller(
      props.network,
      provider,
      ERC20ABI
    );
    tokens.forEach(token => {
      multi.call(`${token}.name`, token, 'name');
      multi.call(`${token}.symbol`, token, 'symbol');
      multi.call(`${token}.decimals`, token, 'decimals');
      if (web3Account.value)
        multi.call(`${token}.balance`, token, 'balanceOf', [web3Account.value]);
    });

    const result = await multi.execute();

    const fetchedToken = result[address];

    customToken.value = {
      contractAddress: address,
      symbol: fetchedToken.symbol,
      name: fetchedToken.name,
      tokenBalance: web3Account.value ? fetchedToken.balance._hex : 0,
      decimals: fetchedToken.decimals,
      price: 0,
      change: 0,
      value: 0
    };

    isSearchValueValidToken.value = true;
  } catch (e) {
    isSearchValueValidToken.value = false;
  } finally {
    customTokenLoading.value = false;
  }
}

watch(searchInput, value => {
  if (!isAddress(value)) {
    customToken.value = null;
    return;
  }

  fetchCustomToken(value);
});

watch(
  () => props.open,
  () => {
    searchInput.value = '';
  }
);
</script>

<template>
  <BaseModal :open="open" @close="$emit('close')">
    <template #header>
      <div
        class="flex flex-col content-center items-center justify-center gap-x-4"
      >
        <h3>Assets</h3>
        <BaseSearch
          v-model="searchInput"
          placeholder="Search or add token address"
          modal
          focus-on-mount
          class="min-h-[60px] w-full flex-auto !px-3 pb-3 sm:!px-4"
        />
      </div>
    </template>

    <template #default="{ maxHeight }">
      <div
        class="flex w-full flex-col overflow-auto"
        :style="{ minHeight: maxHeight }"
      >
        <LoadingList v-if="customTokenLoading" class="p-4" />
        <template v-else>
          <ModalTokensItem
            v-for="token in tokensFiltered"
            :key="token.contractAddress"
            :token="token"
            :is-selected="
              token.contractAddress === selectedToken?.contractAddress
            "
            :network="network"
            @select="handleTokenClick"
          />

          <div
            v-if="!tokensFiltered.length"
            class="py-[20px] text-center text-skin-link md:py-5"
          >
            <i-ho-emoji-sad class="mx-auto" />
            <div class="mt-2">
              <span v-if="searchInput.length && !tokensFiltered.length">{{
                $t('noResultsFound')
              }}</span>
              <span v-else-if="!tokensFiltered.length">
                No tokens found.
                <br />
                Add a token by searching the contract address.
              </span>
            </div>
          </div>
        </template>
      </div>
    </template>
  </BaseModal>
</template>
