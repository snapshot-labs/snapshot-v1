import { clone } from '@snapshot-labs/snapshot.js/src/utils';
import schemas from '@snapshot-labs/snapshot.js/src/schemas';
import { ExtendedSpace } from '@/helpers/interfaces';
import isEqual from 'lodash/isEqual';
import isEmpty from 'lodash/isEmpty';
import { validateForm } from '@/helpers/validation';

const DEFAULT_PROPOSAL_VALIDATION = { name: 'any', params: {} };
const DEFAULT_VOTE_VALIDATION = { name: 'any', params: {} };
const DEFAULT_DELEGATION = {
  delegationType: 'compound-governor',
  delegationContract: '',
  delegationNetwork: '1',
  delegationApi: ''
};
const EMPTY_SPACE_FORM = {
  strategies: [],
  categories: [],
  labels: [],
  treasuries: [],
  admins: [],
  moderators: [],
  members: [],
  plugins: {},
  delegationPortal: clone(DEFAULT_DELEGATION),
  filters: {
    minScore: 0,
    onlyMembers: false
  },
  voting: {
    delay: 0,
    hideAbstain: false,
    period: 0,
    quorum: 0,
    type: '',
    privacy: ''
  },
  boost: {
    enabled: true,
    bribeEnabled: false
  },
  validation: clone(DEFAULT_PROPOSAL_VALIDATION),
  voteValidation: clone(DEFAULT_VOTE_VALIDATION),
  name: '',
  about: '',
  avatar: '',
  network: '1',
  symbol: '',
  terms: '',
  website: '',
  twitter: '',
  github: '',
  coingecko: '',
  parent: null,
  children: [],
  private: false,
  domain: '',
  skin: '',
  guidelines: '',
  template: ''
};

const formSetup = ref(clone(EMPTY_SPACE_FORM));
const formSettings = ref(clone(EMPTY_SPACE_FORM));
const initialFormState = ref(clone(EMPTY_SPACE_FORM));
const inputRefs = ref<any[]>([]);

export function useFormSpaceSettings(
  context: 'setup' | 'settings',
  { spaceType = 'default' } = {}
) {
  const { isSending } = useClient();
  const { isUploadingImage } = useImageUpload();

  const form = computed({
    get: () => (context === 'setup' ? formSetup.value : formSettings.value),
    set: newVal =>
      context === 'setup'
        ? (formSetup.value = newVal)
        : (formSettings.value = newVal)
  });

  const hasFormChanged = computed(() => {
    return !isEqual(formSettings.value, initialFormState.value);
  });

  const prunedForm = computed(() => {
    const formData = clone(form.value);
    Object.entries(formData).forEach(([key, value]) => {
      if (value === null || value === '') delete formData[key];
    });
    if (
      !formData.delegationPortal.delegationContract &&
      !formData.delegationPortal.delegationApi
    ) {
      delete formData.delegationPortal;
    }
    if (formData.voting.quorumType === 'default') {
      delete formData.voting.quorumType;
    }
    return formData;
  });

  function populateForm(extendedSpace: ExtendedSpace) {
    const formData = clone(extendedSpace);
    removeUnnecessaryFields(formData);
    ensureDefaultValues(formData);
    ensureMembersLowerCase(formData);

    if (shouldUseAnyValidation(formData)) {
      formData.validation.name = 'any';
    }

    if (shouldUseBasicValidation(formData)) {
      formData.validation.name = 'basic';
    }

    form.value = clone(formData);
    initialFormState.value = clone(formData);
  }

  function ensureMembersLowerCase(formData: any) {
    formData.admins =
      formData?.admins.map((admin: string) => admin.toLowerCase()) || [];
    formData.moderators =
      formData?.moderators.map((moderator: string) =>
        moderator.toLowerCase()
      ) || [];
    formData.members =
      formData?.members.map((member: string) => member.toLowerCase()) || [];
  }

  function removeUnnecessaryFields(formData: any) {
    delete formData.id;
    delete formData.followersCount;
    delete formData.verified;
    delete formData.flagged;
    delete formData.hibernated;
    delete formData.turbo;

    if (formData.filters.invalids) delete formData.filters.invalids;
  }

  function ensureDefaultValues(formData: any) {
    formData.strategies = formData.strategies || [];
    formData.plugins = formData.plugins || {};
    formData.delegationPortal =
      formData.delegationPortal || clone(DEFAULT_DELEGATION);
    formData.validation =
      formData.validation || clone(DEFAULT_PROPOSAL_VALIDATION);
    formData.voteValidation =
      formData.voteValidation || clone(DEFAULT_VOTE_VALIDATION);
    formData.filters = formData.filters || {};
    formData.voting = formData.voting || {};
    formData.voting = {
      ...formData.voting,
      delay: formData.voting.delay || undefined,
      period: formData.voting.period || undefined,
      type: formData.voting.type || undefined,
      quorum: formData.voting?.quorum || undefined,
      quorumType: formData.voting.quorumType || 'default',
      privacy: formData.voting.privacy || undefined
    };
    formData.children = formData.children
      ? formData.children.map((child: any) => child.id)
      : [];
    formData.parent = formData.parent?.id || '';
    formData.boost = formData.boost || { enabled: true, bribeEnabled: false };
  }

  function shouldUseAnyValidation(formData: any) {
    return (
      formData.validation.name === 'basic' &&
      !formData.filters.minScore &&
      !formData.validation.params.minScore &&
      isEmpty(formData.validation.params)
    );
  }

  function shouldUseBasicValidation(formData: any) {
    return (
      formData.validation.name === 'nouns' ||
      formData.validation.name === 'aave'
    );
  }

  function validateStrategies(errors: any) {
    const isTicket = form.value.strategies.some(
      (strategy: any) => strategy.name === 'ticket'
    );
    const isAnyOrBasic = form.value.voteValidation.name === 'any';

    if (isTicket && isAnyOrBasic) {
      errors.strategies = 'ticketWithAnyOrBasicError';
    }
  }

  function validateProposalValidation(errors: any) {
    const hasProposalValidation =
      (form.value.validation?.name && form.value.validation.name !== 'any') ||
      !!form.value.filters?.minScore ||
      !!form.value.filters?.onlyMembers;

    if (!hasProposalValidation) {
      errors.validation = 'missingProposalValidationError';
    }
  }

  const validationErrors = computed(() => {
    const errors = validateForm(schemas.space, prunedForm.value, { spaceType });

    validateStrategies(errors);
    validateProposalValidation(errors);

    return errors;
  });

  const isValid = computed(() => {
    return Object.values(validationErrors.value).length === 0;
  });

  const isReadyToSubmit = computed(
    () => !isUploadingImage.value && !isSending.value
  );

  function resetForm() {
    form.value = clone(initialFormState.value);
  }

  function forceShowError() {
    inputRefs?.value?.forEach((ref: any) => {
      if (ref?.forceShowError) ref?.forceShowError();
    });
  }

  function addRef(ref: any) {
    if (ref) inputRefs.value.push(ref);
  }

  return {
    form,
    prunedForm,
    validationErrors,
    isValid,
    isReadyToSubmit,
    hasFormChanged,
    populateForm,
    resetForm,
    addRef,
    forceShowError,
    DEFAULT_VOTE_VALIDATION
  };
}
