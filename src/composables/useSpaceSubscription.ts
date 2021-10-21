import { computed, ref, watch } from 'vue';
import { useWeb3 } from '@/composables/useWeb3';
import { useApolloQuery } from '@/composables/useApolloQuery';
import { SUBSCRIPTIONS_QUERY } from '@/helpers/queries';
import { useAliasAction } from '@/composables/useAliasAction';
import client from '@/helpers/EIP712';
import { beams } from '../helpers/beams';
import { useNotifications } from './useNotifications';
import { useI18n } from 'vue-i18n';

const subscriptions = ref<any[] | undefined>(undefined);

export function useSpaceSubscription(spaceId: any) {
  const { web3 } = useWeb3();
  const { apolloQuery } = useApolloQuery();
  const { setAlias, aliasWallet, isValidAlias, checkAlias } = useAliasAction();
  const { notify } = useNotifications();
  const { t } = useI18n();
  const loading = ref(false);
  const web3Account = computed(() => web3.value.account);
  const isSubscribed = computed(() => {
    return (
      subscriptions.value?.some((subscription: any) => {
        return (
          subscription.space.id === spaceId &&
          subscription.address === web3Account.value
        );
      }) ?? false
    );
  });

  async function loadSubscriptions() {
    if (!web3Account.value) return;

    loading.value = true;
    try {
      const spaceSubscriptions = await apolloQuery(
        {
          query: SUBSCRIPTIONS_QUERY,
          variables: {
            address: web3Account.value
          }
        },
        'subscriptions'
      );
      if (spaceSubscriptions) {
        subscriptions.value = spaceSubscriptions;
      } else {
        subscriptions.value = undefined;
      }
    } catch (e) {
      console.error(e);
      subscriptions.value = undefined;
    } finally {
      loading.value = false;
    }
  }

  const checkBrowserNotification = () => {
    if (Notification.permission === 'denied') {
      Notification.requestPermission().then(function (permission) {
        if (permission === 'granted') {
          return true;
        }
      });
      return false;
    } else if (Notification.permission === 'granted') {
      return true;
    } else {
      Notification.requestPermission().then(function (permission) {
        if (permission === 'granted') {
          return true;
        }
      });
      return false;
    }
  };

  const configurePush = async () => {
    try {
      const isNotificationsAllowed = checkBrowserNotification();
      if (isNotificationsAllowed) {
        await beams.start();
        await beams.addDeviceInterest(web3Account.value);
      } else {
        notify(['red', t('pleaseEnableBrowserNotifications')]);
      }
    } catch (error) {
      console.log(error);
    }
  };

  async function toggleSubscription() {
    if (web3.value.authLoading) {
      return null;
    }

    loading.value = true;
    try {
      await checkAlias();
      if (!aliasWallet.value || !isValidAlias.value) {
        await setAlias();
      }

      if (isSubscribed.value) {
        await client.unsubscribe(aliasWallet.value, aliasWallet.value.address, {
          from: web3Account.value,
          space: spaceId
        });
      } else {
        await client.subscribe(aliasWallet.value, aliasWallet.value.address, {
          from: web3Account.value,
          space: spaceId
        });
      }
      await loadSubscriptions();
    } catch (e) {
      console.error(e);
    } finally {
      loading.value = false;
    }
  }

  return {
    toggleSubscription,
    loading,
    isSubscribed,
    subscriptions,
    loadSubscriptions,
    configurePush
  };
}
