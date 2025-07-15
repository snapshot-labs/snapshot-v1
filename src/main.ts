import { Buffer } from 'buffer';
(window as any).global = window;
(window as any).Buffer = Buffer;

import { LockPlugin } from '@snapshot-labs/lock/plugins/vue3';
import { DefaultApolloClient } from '@vue/apollo-composable';
import { createHead } from '@vueuse/head';
import options from '@/helpers/auth';
import VueTippy from 'vue-tippy';
import VueViewer from 'v-viewer';
import { apolloClient } from '@/helpers/apollo';
// import { initSentry } from '@/sentry';
import { KNOWN_DOMAINS, KNOWN_HOSTS } from '@/helpers/constants';
import i18n from '@/helpers/i18n';
import router from '@/router';
import '@/assets/css/main.scss';
import App from '@/App.vue';

const parentUrl =
  window.location != window.parent.location
    ? document.referrer ||
      document.location.ancestorOrigins[
        document.location.ancestorOrigins.length - 1
      ]
    : document.location.href;
const parentHost = new URL(parentUrl).host;
if (
  window !== window.parent &&
  !KNOWN_HOSTS.includes(parentHost) &&
  !KNOWN_DOMAINS.includes(parentHost.split('.').slice(-2).join('.'))
) {
  document.documentElement.style.display = 'none';
  throw new Error(`Unknown host: ${parentHost}`);
}

const head = createHead();

const app = createApp({
  setup() {
    provide(DefaultApolloClient, apolloClient);
  },
  render: () => h(App)
});

// initSentry(app, router);

app
  .use(head)
  .use(i18n)
  .use(router)
  .use(LockPlugin, options)
  .use(VueTippy, {
    defaultProps: { delay: [400, null] },
    directive: 'tippy' // => v-tippy
  })
  .use(VueViewer, { defaultOptions: { navbar: true, toolbar: false } });

app.mount('#app');

export default app;
