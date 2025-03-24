<script setup lang="ts">
import { ExtendedSpace } from '@/helpers/interfaces';
import { PROPOSAL_QUERY } from '@/helpers/queries';
import { proposalValidation } from '@/helpers/snapshot';
import Plugin from '@/plugins/safeSnap';
import { getInstance } from '@snapshot-labs/lock/plugins/vue3';
import { clone } from '@snapshot-labs/snapshot.js/src/utils';
import { PROPOSAL_BODY_LIMITS } from '@/helpers/constants';

const safeSnapPlugin = new Plugin();

enum Step {
  CONTENT,
  VOTING,
  PLUGINS
}

const props = defineProps<{
  space: ExtendedSpace;
}>();

const spaceType = computed(() => (props.space.turbo ? 'turbo' : 'default'));
const bodyCharactersLimit = computed(
  () => PROPOSAL_BODY_LIMITS[spaceType.value]
);

useMeta({
  title: {
    key: 'metaInfo.space.create.title',
    params: {
      space: props.space.name
    }
  },
  description: {
    key: 'metaInfo.space.create.description'
  }
});

const { notify } = useFlashNotification();
const router = useRouter();
const route = useRoute();
const { t } = useI18n();
const auth = getInstance();
const { domain } = useApp();
const { web3, web3Account } = useWeb3();
const { send, isSending } = useClient();
const { pluginIndex } = usePlugins();
const { modalAccountOpen } = useModal();
const { modalTermsOpen, termsAccepted, acceptTerms } = useTerms(props.space.id);
const { isGnosisAndNotSpaceNetwork } = useGnosis(props.space);
const { isSnapshotLoading } = useSnapshot();
const { apolloQuery, queryLoading } = useApolloQuery();
const { containsShortUrl } = useShortUrls();

const { isValid: isValidSpaceSettings, populateForm } = useFormSpaceSettings(
  'settings',
  {
    spaceType: spaceType.value
  }
);

const {
  form,
  formDraft,
  userSelectedDateEnd,
  sourceProposalLoaded,
  sourceProposal,
  validationErrors,
  resetForm
} = useFormSpaceProposal({
  spaceType: spaceType.value
});

const isValidAuthor = ref(false);
const validationLoading = ref(false);
const preview = ref(false);
const hasAuthorValidationFailed = ref(false);
const timeSeconds = ref(Number((Date.now() / 1e3).toFixed()));
const currentStep = ref(Step.CONTENT);

const proposal = computed(() =>
  Object.assign(form.value, { choices: form.value.choices })
);

const isEditing = computed(
  () => !!(sourceProposal.value && route.query.editing)
);

type DateRange = {
  dateStart: number;
  dateEnd?: number;
};

function sanitizeDateRange({ dateStart, dateEnd }: DateRange): DateRange {
  const { delay = 0, period = 0 } = props.space?.voting ?? {};
  const threeDays = 259200;
  const currentTimestamp = Math.floor(Date.now() / 1000);

  const sanitizedDateStart = delay
    ? timeSeconds.value + delay
    : Math.max(dateStart, currentTimestamp);

  if (typeof dateEnd === 'undefined') {
    return { dateStart: sanitizedDateStart };
  }

  if (period) {
    const sanitizedDateEnd = sanitizedDateStart + period;
    return { dateStart: sanitizedDateStart, dateEnd: sanitizedDateEnd };
  }

  if (userSelectedDateEnd.value || sourceProposalLoaded.value) {
    return { dateStart: sanitizedDateStart, dateEnd };
  }

  return {
    dateStart: sanitizedDateStart,
    dateEnd: sanitizedDateStart + threeDays
  };
}

const dateStart = computed(() => {
  const { dateStart } = sanitizeDateRange({ dateStart: form.value.start });
  return dateStart;
});

const dateEnd = computed(() => {
  const { dateEnd } = sanitizeDateRange({
    dateStart: form.value.start,
    dateEnd: form.value.end
  });
  return dateEnd;
});

const isFormValid = computed(() => {
  const isSafeSnapPluginValid = form.value.metadata.plugins?.safeSnap
    ? form.value.metadata.plugins.safeSnap.valid
    : true;

  const isOsnapPluginValid = (() => {
    const safes = form.value.metadata.plugins.oSnap?.safes;
    if (!safes) {
      //  not using osnap plugin
      return true;
    }
    if (safes.length && safes.some(safe => !(safe.transactions.length > 0))) {
      //  using osnap, but some have no transactions
      return false;
    }
    if (
      safes &&
      !safes.every(safe => safe.transactions.every(tx => tx.isValid))
    ) {
      //  all transactions must be valid
      return false;
    }
    return true;
  })();

  return (
    !web3.value.authLoading &&
    isOsnapPluginValid &&
    !isSending.value &&
    form.value.body.length <= bodyCharactersLimit.value &&
    dateEnd.value &&
    dateEnd.value > dateStart.value &&
    form.value.snapshot &&
    form.value.choices.length >= 1 &&
    !form.value.choices.some((a, i) => a.text === '' && i === 0) &&
    isValidAuthor.value &&
    isSafeSnapPluginValid
  );
});

const formContainsShortUrl = computed(() => {
  const { body, name, discussion } = form.value;

  return (
    containsShortUrl(body) ||
    containsShortUrl(name) ||
    containsShortUrl(discussion)
  );
});

const stepIsValid = computed(() => {
  if (
    currentStep.value === Step.CONTENT &&
    form.value.name &&
    form.value.body.length <= bodyCharactersLimit.value &&
    isValidAuthor.value &&
    !validationErrors.value.name &&
    !validationErrors.value.body &&
    !validationErrors.value.discussion &&
    !formContainsShortUrl.value
  )
    return true;
  else if (
    currentStep.value === Step.VOTING &&
    dateEnd.value &&
    dateEnd.value > dateStart.value &&
    form.value.snapshot &&
    !form.value.choices.some((a, i) => a.text === '' && i === 0)
  )
    return true;
  else return false;
});

const isMember = computed(() => {
  function findAccount(object: string[], account: string) {
    return object.map(a => a.toLowerCase()).includes(account.toLowerCase());
  }
  return (
    findAccount(props.space.members, web3Account.value) ||
    findAccount(props.space.admins, web3Account.value) ||
    findAccount(props.space.moderators, web3Account.value) ||
    false
  );
});

const needsPluginConfigs = computed(() =>
  Object.keys(props.space?.plugins ?? {}).some(
    pluginKey => pluginIndex[pluginKey]?.defaults?.proposal
  )
);

const validationName = computed(() => props.space.validation?.name ?? 'basic');

function getFormattedForm() {
  const clonedForm = clone(form.value);
  clonedForm.snapshot = Number(form.value.snapshot);
  clonedForm.choices = form.value.choices
    .map(choice => choice.text)
    .filter(choiceText => choiceText.length > 0);
  updateTime();
  const { dateStart: sanitizedDateStart, dateEnd: sanitizedDateEnd } =
    sanitizeDateRange({
      dateStart: dateStart.value,
      dateEnd: dateEnd.value
    });
  clonedForm.start = sanitizedDateStart;
  clonedForm.end = sanitizedDateEnd;
  clonedForm.privacy =
    props.space.voting.privacy === 'any' ? '' : props.space.voting.privacy;
  return clonedForm;
}

const { resetSpaceProposals } = useProposals();

function handleSubmit() {
  if (!termsAccepted && props.space.terms) return (modalTermsOpen.value = true);
  if (isEditing.value) return handleUpdate();
  handleCreate();
}

async function handleCreate() {
  const formattedForm = getFormattedForm();
  const result = await send(props.space, 'create-proposal', formattedForm);
  if (result.id) {
    resetSpaceProposals();
    if (!result.ipfs) notify(['green', t('notify.waitingForOtherSigners')]);
    else notify(['green', t('notify.proposalCreated')]);
    resetForm();
    router.push({
      name: 'spaceProposal',
      params: {
        key: props.space.id,
        id: result.id
      }
    });
  }
}

async function handleUpdate() {
  const formattedForm = getFormattedForm();
  formattedForm.id = sourceProposal.value;
  const result = await send(props.space, 'update-proposal', formattedForm);
  if (result.id) {
    resetSpaceProposals();
    if (!result.ipfs) notify(['green', t('notify.waitingForOtherSigners')]);
    else notify(['green', t('notify.proposalUpdated')]);
    resetForm();
    router.push({
      name: 'spaceProposal',
      params: {
        key: props.space.id,
        id: sourceProposal.value
      }
    });
  }
}

function setSourceProposal(proposal) {
  const { plugins } = proposal;

  form.value = {
    name: proposal.title,
    body: proposal.body,
    discussion: proposal.discussion,
    choices: proposal.choices,
    labels: proposal.labels,
    start: proposal.start,
    end: proposal.end,
    snapshot: proposal.snapshot,
    type: proposal.type,
    metadata: { plugins }
  };

  form.value.choices = proposal.choices.map((text, key) => ({
    key,
    text
  }));
}

async function loadSourceProposal() {
  const proposal = await apolloQuery(
    {
      query: PROPOSAL_QUERY,
      variables: {
        id: sourceProposal.value
      }
    },
    'proposal'
  );

  setSourceProposal(proposal);
  sourceProposalLoaded.value = true;
}

function nextStep() {
  if (formContainsShortUrl.value) return;
  // skip transaction page if user has osnap, but chosen not to use it for this vote
  if (shouldSkipTransactions()) return;
  currentStep.value++;
}

function previousStep() {
  currentStep.value--;
}

function updateTime() {
  timeSeconds.value = Number((Date.now() / 1e3).toFixed());
}

async function validateAuthor() {
  isValidAuthor.value = false;
  if (web3Account.value && auth.isAuthenticated.value) {
    if (isMember.value) {
      isValidAuthor.value = true;
      return;
    }

    if (props.space.filters.onlyMembers) {
      isValidAuthor.value = false;
      return;
    }

    if (
      props.space.validation.name === 'any' ||
      (props.space.validation.name === 'basic' &&
        !props.space.filters.minScore &&
        !props.space.validation.params?.minScore)
    ) {
      isValidAuthor.value = true;
      return;
    }

    try {
      validationLoading.value = true;
      const validationRes = await proposalValidation(
        props.space,
        web3Account.value
      );

      isValidAuthor.value = validationRes;
    } catch (e) {
      hasAuthorValidationFailed.value = true;
      console.warn(e);
    } finally {
      validationLoading.value = false;
    }
  }
}

watch(
  () => web3Account.value,
  () => {
    validateAuthor();
  },
  { immediate: true }
);

const hasOsnapPlugin = computed(() => {
  return !!props.space?.plugins?.oSnap;
});
const shouldUseOsnap = ref(false);

function toggleShouldUseOsnap() {
  shouldUseOsnap.value = !shouldUseOsnap.value;
}

// We need to know if the space is using osnap, this will change what types of voting we can do
// We also need to know if the user plans to use osnap
const legacyOsnap = ref<{
  enabled: boolean;
  selection: boolean;
  valid: boolean;
}>({
  selection: false,
  enabled: false,
  valid: false
});

// Skip transaction page if osnap is enabled, its not selected to be used, and we are on the voting page
function shouldSkipTransactions() {
  if (currentStep.value !== Step.VOTING) return false;
  if (
    legacyOsnap.value.enabled &&
    legacyOsnap.value.valid &&
    !legacyOsnap.value.selection
  )
    return true;
  if (hasOsnapPlugin.value && !shouldUseOsnap.value) return true;
  return false;
}

function handleLegacyOsnapToggle() {
  legacyOsnap.value.selection = !legacyOsnap.value.selection;
  shouldUseOsnap.value = !shouldUseOsnap.value;
}

onMounted(async () => {
  const network = props?.space?.plugins?.safeSnap?.safes?.[0]?.network;
  const umaAddress = props?.space?.plugins?.safeSnap?.safes?.[0]?.umaAddress;
  if (network && umaAddress) {
    // this is how we check if osnap is enabled and valid.
    legacyOsnap.value.enabled = true;
    legacyOsnap.value.valid =
      (await safeSnapPlugin.validateUmaModule(network, umaAddress)) === 'uma';
  }
  if (sourceProposal.value && !sourceProposalLoaded.value)
    await loadSourceProposal();

  if (!sourceProposal.value) {
    form.value.name = formDraft.value.name;
    form.value.body = formDraft.value.body;
  }

  if (
    !!props.space?.template &&
    !sourceProposal.value &&
    !formDraft.value.isBodySet
  ) {
    form.value.body = props.space.template;
  }
});

onBeforeRouteLeave(async () => {
  if (isEditing.value) {
    resetForm();
  }
});

onMounted(() => populateForm(props.space));
</script>

<template>
  <TheLayout v-bind="$attrs">
    <template #content-left>
      <div
        v-if="currentStep === Step.CONTENT"
        class="mb-3 overflow-hidden px-4 md:px-0"
      >
        <ButtonBack
          @click="
            router.push(domain ? { path: '/' } : { name: 'spaceProposals' })
          "
        />
      </div>
      <SpaceCreateWarnings
        v-if="!validationLoading"
        :space="space"
        :validation-failed="hasAuthorValidationFailed"
        :is-valid-author="isValidAuthor"
        :is-valid-space="isValidSpaceSettings"
        :validation-name="validationName"
        :contains-short-url="formContainsShortUrl"
        data-testid="create-proposal-connect-wallet-warning"
      />

      <!-- Step 1 -->
      <SpaceCreateContent
        v-if="currentStep === Step.CONTENT"
        :space="space"
        :preview="preview"
        :body-limit="bodyCharactersLimit"
      />

      <!-- Step 2 -->
      <SpaceCreateVoting
        v-else-if="currentStep === Step.VOTING"
        :space="space"
        :date-start="dateStart"
        :date-end="dateEnd"
        :has-osnap-plugin="hasOsnapPlugin"
        :should-use-osnap="shouldUseOsnap"
        :legacy-osnap="legacyOsnap"
        :is-editing="isEditing"
        @toggle-should-use-osnap="toggleShouldUseOsnap"
        @legacy-osnap-toggle="handleLegacyOsnapToggle"
      />

      <!-- Step 3 (only when plugins) -->
      <SpaceCreatePlugins
        v-else
        v-model="form.metadata.plugins"
        :proposal="proposal"
        :space="space"
      />
    </template>
    <template #sidebar-right>
      <BaseBlock class="lg:fixed lg:w-[320px]">
        <TuneButton
          v-if="currentStep === Step.CONTENT"
          class="mb-2 block w-full"
          @click="preview = !preview"
        >
          {{ preview ? $t('create.edit') : $t('create.preview') }}
        </TuneButton>
        <TuneButton v-else class="mb-2 block w-full" @click="previousStep">
          {{ $t('back') }}
        </TuneButton>
        <TuneButton
          v-if="
            currentStep === Step.PLUGINS ||
            (!needsPluginConfigs && currentStep === Step.VOTING) ||
            shouldSkipTransactions()
          "
          :disabled="!isFormValid"
          :loading="isSending || queryLoading || isSnapshotLoading"
          class="block w-full"
          primary
          data-testid="create-proposal-publish-button"
          @click="handleSubmit"
        >
          {{ isEditing ? 'Save changes' : $t('create.publish') }}
        </TuneButton>
        <TuneButton
          v-else
          class="block w-full"
          :loading="validationLoading || isSnapshotLoading"
          :disabled="
            (!stepIsValid && !!web3Account) ||
            web3.authLoading ||
            hasAuthorValidationFailed ||
            validationLoading ||
            isGnosisAndNotSpaceNetwork ||
            space.hibernated ||
            !isValidSpaceSettings
          "
          primary
          :data-testid="
            web3Account
              ? 'create-proposal-continue-button'
              : 'create-proposal-connect-wallet-button'
          "
          @click="web3Account ? nextStep() : (modalAccountOpen = true)"
        >
          {{ web3Account ? $t('create.continue') : $t('connectWallet') }}
        </TuneButton>
      </BaseBlock>
    </template>
  </TheLayout>
  <teleport to="#modal">
    <ModalTerms
      :open="modalTermsOpen"
      :space="space"
      :action="$t('modalTerms.actionCreate')"
      @close="modalTermsOpen = false"
      @accept="acceptTerms(), handleSubmit()"
    />
  </teleport>
</template>
