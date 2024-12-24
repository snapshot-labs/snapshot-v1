<script setup lang="ts">
import networks from '@snapshot-labs/snapshot.js/src/networks.json';
import { useTippy } from 'vue-tippy';
import { shorten } from '@/helpers/utils';

const { env } = useApp();
const { t } = useI18n();

const defaultNetwork = import.meta.env.VITE_DEFAULT_NETWORK;

const { web3Account } = useWeb3();
const { loadOwnedEnsDomains, ownedEnsDomains } = useEns();
const { loadSpaces, spaces, getDeletedSpaces } = useSpaces();

const inputDomain = ref('');
const isLoading = ref(false);
const deletedSpaces = ref<string[]>([]);
const refEnsUnavailableTooltip = ref<Record<string, any>>({});

watch(
  web3Account,
  async () => {
    ownedEnsDomains.value = [];
    isLoading.value = true;
    await loadOwnedEnsDomains(web3Account.value);

    const ids = ownedEnsDomains.value.map(d => d.name);
    if (ids.length) {
      await loadSpaces(ids);
      const spaceIds = spaces.value.map(space => space.id);
      deletedSpaces.value = await getDeletedSpaces(
        ids.filter(id => !spaceIds.includes(id))
      );
    }
    isLoading.value = false;
  },
  { immediate: true }
);

const triggerEnsUnavailableTooltip = (key: string, error_code: string) => {
  let text;
  switch (error_code) {
    case 'deleted-space':
      text =
        'This ENS name is used by a previously deleted space, and can not be used anymore to create a new space. <a target="_blank" href="https://docs.snapshot.org/faq#why-cant-i-create-a-new-space-with-my-previous-deleted-space-ens-name">Learn more.</a>';
      break;
    case 'invalid-ens-length':
      text = 'The ENS name is too long. It must be less than 64 characters.';
      break;
    default:
      text = t('setup.domain.invalidEns');
  }

  useTippy(refEnsUnavailableTooltip.value[key], {
    content: text,
    interactive: true,
    allowHTML: true,
    theme: 'urlified'
  });
};

const availableDomains = computed(() => {
  const spaceIds = spaces.value.map(space => space.id);
  return ownedEnsDomains.value.filter(
    d =>
      !spaceIds.includes(d.name) &&
      !d.isInvalid &&
      !deletedSpaces.value.includes(d.name) &&
      d.name.length <= 64
  );
});

const unavailableDomains = computed(() => {
  const spaceIds = spaces.value.map(space => space.id);
  return ownedEnsDomains.value.filter(
    d =>
      !spaceIds.includes(d.name) &&
      (d.isInvalid ||
        deletedSpaces.value.includes(d.name) ||
        d.name.length > 64)
  );
});

const domainsWithExistingSpace = computed(() => {
  const spaceIds = ownedEnsDomains.value.map(d => d.name);
  return spaces.value.filter(d => spaceIds.includes(d.id));
});

const emit = defineEmits(['next']);

// handle periodic lookup (every 5s) while registering new domain
let waitingForRegistrationInterval;
const waitForRegistration = () => {
  clearInterval(waitingForRegistrationInterval);
  waitingForRegistrationInterval = setInterval(loadOwnedEnsDomains, 5000);
};

function shortenInvalidEns(ens: string) {
  const [name, domain] = ens.split('.');
  return `${shorten(name)}.${domain}`;
}

// stop lookup when leaving
onUnmounted(() => clearInterval(waitingForRegistrationInterval));
</script>

<template>
  <div>
    <LoadingRow v-if="isLoading" block />
    <div v-else>
      <h4 class="mb-2 px-4 md:px-0">{{ $t('setup.domain.title') }}</h4>
      <BaseMessageBlock
        v-if="env !== 'demo'"
        class="mb-4"
        level="info"
        is-responsive
      >
        {{ $t('setup.domain.ensMessage') }}
        <i18n-t
          keypath="setup.domain.ensMessageTestnet"
          tag="span"
          scope="global"
        >
          <template #link>
            <BaseLink link="https://testnet.v1.snapshot.box">
              {{ $t('setup.domain.tryDemo') }}
            </BaseLink>
          </template>
        </i18n-t>
      </BaseMessageBlock>

      <BlockSpacesList
        v-if="domainsWithExistingSpace.length"
        :spaces="domainsWithExistingSpace"
        :title="$t('setup.domain.yourExistingSpaces')"
        class="mb-3"
      />

      <BaseMessageBlock
        v-if="defaultNetwork && env === 'demo'"
        level="info"
        class="mb-4"
        is-responsive
      >
        {{
          $t('setup.demoTestnetEnsMessage', {
            network: networks[defaultNetwork].name
          })
        }}
      </BaseMessageBlock>

      <BaseBlock>
        <div class="flex flex-col space-y-4">
          <div v-if="availableDomains.length">
            <div class="mb-3">
              {{
                $t(
                  availableDomains.length > 1
                    ? 'setup.chooseExistingEns'
                    : 'setup.useSingleExistingEns'
                )
              }}
            </div>
            <div class="space-y-2 flex flex-col">
              <template v-for="(ens, i) in availableDomains" :key="i">
                <TuneButton
                  class="flex w-full items-center justify-between"
                  :primary="availableDomains.length === 1"
                  @click="emit('next', ens.name)"
                >
                  {{ ens.name }}
                  <i-ho-arrow-sm-right class="-mr-2" />
                </TuneButton>
              </template>
            </div>
          </div>

          <div v-if="unavailableDomains.length">
            <div class="mb-3">Unavailable ENS domains:</div>
            <div class="space-y-2 flex flex-col">
              <template v-for="(ens, i) in unavailableDomains" :key="i">
                <template v-if="deletedSpaces.includes(ens.name)">
                  <TuneButton
                    class="flex w-full items-center justify-between hover:cursor-default hover:border-skin-border"
                  >
                    {{ ens.name }}
                    <div
                      @mouseenter="
                        triggerEnsUnavailableTooltip(ens.name, 'deleted-space')
                      "
                      @focus="
                        triggerEnsUnavailableTooltip(ens.name, 'deleted-space')
                      "
                    >
                      <div :ref="v => (refEnsUnavailableTooltip[ens.name] = v)">
                        <i-ho-exclamation-circle
                          class="text-red -mr-2 cursor-help"
                        />
                      </div>
                    </div>
                  </TuneButton>
                </template>
                <template v-else-if="ens.name.length > 64">
                  <TuneButton class="flex w-full items-center justify-between">
                    {{ shortenInvalidEns(ens.name) }}
                    <div
                      @mouseenter="
                        triggerEnsUnavailableTooltip(
                          ens.name,
                          'invalid-ens-length'
                        )
                      "
                      @focus="
                        triggerEnsUnavailableTooltip(
                          ens.name,
                          'invalid-ens-length'
                        )
                      "
                    >
                      <div
                        :ref="
                          v => {
                            refEnsUnavailableTooltip[ens.name] = v;
                          }
                        "
                      >
                        <i-ho-exclamation-circle
                          class="-mr-2 text-red cursor-help"
                        />
                      </div>
                    </div>
                  </TuneButton>
                </template>
                <template v-else-if="ens.isInvalid">
                  <TuneButton class="flex w-full items-center justify-between">
                    {{ shortenInvalidEns(ens.name) }}

                    <div
                      @mouseenter="
                        triggerEnsUnavailableTooltip(ens.name, 'invalid-ens')
                      "
                      @focus="
                        triggerEnsUnavailableTooltip(ens.name, 'invalid-ens')
                      "
                    >
                      <div
                        :ref="
                          v => {
                            refEnsUnavailableTooltip[ens.name] = v;
                          }
                        "
                      >
                        <i-ho-exclamation-circle
                          class="-mr-2 text-red cursor-help"
                        />
                      </div>
                    </div>
                  </TuneButton>
                </template>
              </template>
            </div>
          </div>

          <div>
            <div class="mb-2">
              {{ $t('setup.orRegisterNewEns') }}
            </div>

            <div>
              <div v-if="!availableDomains.length" class="mb-3">
                {{ $t('setup.toCreateASpace') }}
              </div>
              <SetupDomainRegister
                v-model.trim="inputDomain"
                @wait-for-registration="waitForRegistration"
              />
            </div>
          </div>
        </div>
      </BaseBlock>
    </div>
  </div>
</template>
