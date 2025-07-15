<script setup lang="ts">
import { ExtendedSpace } from '@/helpers/interfaces';
import { clone, sleep } from '@snapshot-labs/snapshot.js/src/utils';

const defaultDelegate = {
  address: '',
  weight: 100
};

const props = defineProps<{
  open: boolean;
  space: ExtendedSpace;
  address: string;
}>();

const emit = defineEmits(['close', 'reload', 'deleteDelegate']);

const {
  createPendingTransaction,
  updatePendingTransaction,
  removePendingTransaction
} = useTxStatus();
const route = useRoute();
const { notify } = useFlashNotification();
const { d, t } = useI18n();
const { setDelegates, fetchDelegatingTo, clearDelegations } = useDelegates(
  props.space
);
const { web3 } = useWeb3();

const currentDelegations = ref<{ address: string; weight: number }[]>([]);
const delegates = ref(
  currentDelegations.value.length > 0
    ? clone(currentDelegations.value)
    : [defaultDelegate]
);
const delegationWeightError = ref('');
const delegationAddressError = ref('');
const isAwaitingSignature = ref(false);
const expirationDate = ref<number>(calculateInitialDate());

const isSpaceDelegatesValid = computed(() => {
  const allDelegatesHaveAddress = delegates.value.every(
    delegate => delegate.address
  );

  const totalWeight = delegates.value.reduce(
    (total, delegate) => total + delegate.weight,
    0
  );

  return (
    delegates.value.length > 0 &&
    allDelegatesHaveAddress &&
    Math.floor(totalWeight) <= 100 &&
    totalWeight > 0
  );
});

const dateString = computed(() =>
  d(expirationDate.value * 1e3, 'short', 'en-US')
);

const handleExpirationDateUpdate = (date: number) => {
  expirationDate.value = date;
};

async function handleConfirm() {
  if (web3.value.network.chainId !== 1 && web3.value.network.chainId !== 100) {
    notify([
      'red',
      'Change your network to Mainnet or Gnosis Chain to delegate your voting power.'
    ]);
    return;
  }
  const txPendingId = createPendingTransaction();

  try {
    isAwaitingSignature.value = true;
    const addresses = delegates.value.map(delegation => delegation.address);

    const weights = delegates.value.map(delegation =>
      Math.floor(delegation.weight)
    );

    const delegateToSelf =
      delegates.value
        .map(delegation => delegation.weight)
        .reduce((acc, weight) => acc + weight, 0) < 100;

    if (delegateToSelf) {
      addresses.push(web3.value.account);
      weights.push(100 - weights.reduce((acc, weight) => acc + weight, 0));
    }

    const expirationTime = expirationDate.value;
    const tx = await setDelegates(addresses, weights, expirationTime);
    isAwaitingSignature.value = false;
    updatePendingTransaction(txPendingId, { hash: tx.hash });
    emit('close');
    notify(t('notify.transactionSent'));
    const receipt = await tx.wait();
    console.log('Receipt', receipt);
    await sleep(3e3);
    notify(t('notify.delegationSuccess'));
    removePendingTransaction(txPendingId);
    emit('reload');
  } catch (e) {
    console.log(e);
    isAwaitingSignature.value = false;
    removePendingTransaction(txPendingId);
  }
}

const handleCloseModal = () => {
  delegates.value =
    currentDelegations.value.length > 0
      ? clone(currentDelegations.value)
      : [defaultDelegate];
  isAwaitingSignature.value = false;
  expirationDate.value = calculateInitialDate();
  emit('close');
};

function calculateInitialDate(): number {
  const date = new Date();
  date.setFullYear(date.getFullYear() + 1);
  return Math.floor(date.getTime() / 1000);
}

function deleteDelegate(index: number) {
  const newDelegates = clone(delegates.value);
  newDelegates.splice(index, 1);
  delegates.value = newDelegates;

  validateDelegations();
}

function updateDelegate(index: number, form: { to: string; weight: number }) {
  const newDelegates = clone(delegates.value);
  newDelegates[index] = {
    ...newDelegates[index],
    address: form.to,
    weight: form.weight
  };
  delegates.value = newDelegates;

  validateDelegations();
}

function validateDelegations() {
  // show error if weights add to more than 100
  const totalWeight = delegates.value.reduce(
    (total, delegate) => total + delegate.weight,
    0
  );
  delegationWeightError.value =
    totalWeight > 100 ? 'Total weight cannot exceed 100' : '';

  // Show error if duplicate addresses
  const nonEmptyAddresses = delegates.value.map(d => d.address).filter(Boolean);
  const hasDuplicates =
    new Set(nonEmptyAddresses).size !== nonEmptyAddresses.length;
  delegationAddressError.value = hasDuplicates
    ? 'Duplicate addresses not allowed'
    : '';
}

async function deleteAllDelegates() {
  const txPendingId = createPendingTransaction();

  try {
    isAwaitingSignature.value = true;

    const tx = await clearDelegations();
    isAwaitingSignature.value = false;
    updatePendingTransaction(txPendingId, { hash: tx.hash });
    emit('close');
    notify(t('notify.transactionSent'));
    const receipt = await tx.wait();
    console.log('Receipt', receipt);
    await sleep(3e3);
    notify('Your delegations have been cleared');
    removePendingTransaction(txPendingId);
    emit('reload');
  } catch (e) {
    console.log(e);
    isAwaitingSignature.value = false;
    removePendingTransaction(txPendingId);
  }
}

function addDelegate() {
  const newDelegate = {
    address: '',
    weight: 0
  };

  delegates.value.push(newDelegate);
}

function divideEqually() {
  delegationWeightError.value = '';
  const numDelegates = delegates.value.length;
  if (numDelegates === 0) return;

  const equalWeight = 100 / numDelegates;

  const updatedDelegates = delegates.value.map(delegate => ({
    ...delegate,
    weight: equalWeight
  }));

  delegates.value = updatedDelegates;
}

async function loadDelegatingTo() {
  const delegatingTo = await fetchDelegatingTo(web3.value.account);
  const delegations = delegatingTo?.delegateTree?.map(
    ({ delegate, weight }) => ({
      address: delegate,
      weight: weight / 100 // delegate weight comes from api as BPS
    })
  );
  currentDelegations.value = delegations ? clone(delegations) : [];

  if (props.address) {
    const newDelegate = {
      address: props.address,
      weight:
        100 -
        currentDelegations.value.reduce(
          (acc, delegate) => acc + delegate.weight,
          0
        )
    };
    delegations?.push(newDelegate);
  }
  delegates.value =
    delegations && delegations.length ? clone(delegations) : [defaultDelegate];
}

watch(() => web3.value.account, loadDelegatingTo, { immediate: true });

watch(
  route,
  newDelegateAddress => {
    const delegateAddress = newDelegateAddress.query.delegate;
    if (delegateAddress) {
      if (delegates.value.length === 1 && !delegates.value[0].address) {
        // delegates has default value, replace with the passed address
        const _delegates = clone(delegates.value);
        _delegates[0].address = delegateAddress;
        delegates.value = _delegates;
      } else {
        // if delegates already has a value, add to the end of the list,
        // with the remaining weight of 100
        const newDelegate = {
          address: delegateAddress as string,
          weight:
            100 -
            currentDelegations.value.reduce(
              (acc, delegate) => acc + delegate.weight,
              0
            )
        };
        delegates.value.push(newDelegate);
      }
    }
  },
  { immediate: true }
);
</script>

<template>
  <BaseModal :open="open" @close="handleCloseModal">
    <template #header>
      <div class="px-4 pt-1 text-left text-skin-heading">
        <h3 class="m-0" v-text="$t('delegates.delegateModal.title')" />
        <p class="text-gray-500">
          Delegate your voting power to multiple addresses.
        </p>
      </div>
    </template>

    <div class="space-y-3 p-4">
      <p>
        Any unallocated power (100% - any delegations) will remain with you.
      </p>
      <div class="flex flex-col space-y-1">
        <LabelInput> Delegation scope </LabelInput>
        <div class="flex items-center space-x-1">
          <AvatarSpace :space="space" />
          <span class="text-skin-heading" v-text="space.name" />
        </div>
      </div>
      <div>
        <TuneLabelInput hint="Your delegations will expire after this date">
          Set expiration
        </TuneLabelInput>
        <InputDate
          :tooltip="$t('create.delayEnforced')"
          :date="expirationDate"
          :date-string="dateString"
          @update:date="handleExpirationDateUpdate"
        />
      </div>
      <div class="space-y-1">
        <div v-if="delegates.length > 0" class="flex justify-between">
          <TuneLabelInput
            hint="Add addresses and the percentage of your voting power you want to delegate to them"
          >
            {{ 'Delegations' }}
          </TuneLabelInput>
          <button
            class="text-gray-500 underline hover:opacity-50 text-xs bg-none"
            @click="divideEqually"
          >
            Divide equally
          </button>
        </div>
        <div
          v-for="(delegate, index) in delegates"
          :key="`delegate-registry-row-${index}`"
        >
          <SpaceSplitDelegationRow
            :address="delegate.address"
            :weight="delegate.weight"
            @delete-delegate="deleteDelegate(index)"
            @update:model-value="form => updateDelegate(index, form)"
          />
        </div>
        <div class="flex justify-between">
          <TuneButton class="flex items-center space-x-2" @click="addDelegate">
            <i-ho-plus class="text-xs" />
            <span>Add delegate</span>
          </TuneButton>
          <button
            v-if="currentDelegations.length > 0"
            class="text-red underline hover:opacity-50 text-xs bg-none"
            @click="deleteAllDelegates"
          >
            Clear all delegations
          </button>
        </div>
        <TuneErrorInput
          v-if="Boolean(delegationWeightError)"
          :error="delegationWeightError"
        />
        <TuneErrorInput
          v-if="Boolean(delegationAddressError)"
          :error="delegationAddressError"
        />
      </div>
    </div>
    <template #footer>
      <TuneButton
        class="w-full"
        type="button"
        :disabled="
          !isSpaceDelegatesValid ||
          Boolean(delegationWeightError) ||
          Boolean(delegationAddressError)
        "
        :loading="isAwaitingSignature"
        @click="handleConfirm"
      >
        {{ $t('confirm') }}
      </TuneButton>
    </template>
  </BaseModal>
</template>
