import { ref, computed } from 'vue';
import { useI18n } from '@/composables/useI18n';
import { getInstance } from '@snapshot-labs/lock/plugins/vue3';
import { useWeb3 } from '@/composables/useWeb3';
import { useSkin } from '@/composables/useSkin';
import { useSpaces } from '@/composables/useSpaces';
import domains from '@/../snapshot-spaces/spaces/domains.json';
import aliases from '@/../snapshot-spaces/spaces/aliases.json';
import { getInjected } from '@snapshot-labs/lock/src/utils';

const domainName = window.location.hostname;
let env = 'master';
if (domainName.includes('localhost')) env = 'local';
if (domainName === 'demo.snapshot.org') env = 'develop';
let domain = domains[domainName];

if (env === 'local') {
  domain = import.meta.env.VITE_VIEW_AS_SPACE ?? domain;
}

const domainAlias = Object.keys(aliases).find(
  alias => aliases[alias] === domain
);

const { login } = useWeb3();

const ready = ref(false);

// only affects small screens
const showSidebar = ref(false);

export function useApp() {
  const { loadLocale } = useI18n();
  const { getSkin } = useSkin();
  const { getSpaces } = useSpaces();

  async function init() {
    await loadLocale();
    const auth = getInstance();
    await getSkin(domain);
    ready.value = true;
    getSpaces();

    // Auto connect if previous session was connected
    if (window?.parent === window)
      auth.getConnector().then(connector => {
        if (connector) login(connector);
      });
    // Auto connect when on web3 browser
    const injected = computed(() => getInjected());
    if (injected.value?.id === 'web3') return login('injected');
    // Auto connect with gnosis-connector when inside gnosis-safe iframe
    login('gnosis');
  }

  return {
    domain,
    domainAlias,
    env,
    ready,
    init,
    showSidebar
  };
}
