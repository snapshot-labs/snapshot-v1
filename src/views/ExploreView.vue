<script setup lang="ts">
import { useInfiniteScroll } from '@vueuse/core';

useMeta({
  title: {
    key: 'metaInfo.home.title'
  },
  description: {
    key: 'metaInfo.home.description'
  }
});

const { t } = useI18n();
const { formatCompactNumber } = useIntl();
const route = useRoute();

const isSpaces = computed(
  () => !route.query.filter || route.query.filter === 'spaces'
);
const isStrategies = computed(() => route.query.filter === 'strategies');
const isNetworks = computed(() => route.query.filter === 'networks');
const isPlugins = computed(() => route.query.filter === 'plugins');

const buttonStr = computed(() => {
  if (isStrategies.value) return t('explore.createStrategy');
  if (isNetworks.value) return t('explore.addNetwork');
  if (isPlugins.value) return t('explore.createPlugin');
  return '';
});

const resultsStr = computed(() => {
  if (isStrategies.value) return t('explore.strategies');
  if (isNetworks.value) return t('explore.networks');
  if (isPlugins.value) return t('explore.plugins');
  return t('explore.results');
});

const createLink = computed(() => {
  if (isStrategies.value) return 'https://docs.snapshot.org/strategies/create';
  if (isNetworks.value) return 'https://snapshot.box/#/network';
  if (isPlugins.value) return 'https://docs.snapshot.org/plugins/create';
  return 'https://docs.snapshot.org/strategies/create';
});

const { filterNetworks, getNetworksSpacesCount, loadingNetworksSpacesCount } =
  useNetworksFilter();

const { filterPlugins, getPluginsSpacesCount, loadingPluginsSpacesCount } =
  usePlugins();

const { filterStrategies, getStrategies, isLoadingStrategies } =
  useStrategies();
const { env } = useApp();

const onlyMainnetNetworks = n => (env === 'production' ? !n.testnet : true);

const items = computed(() => {
  const q = (route.query.q as string) || '';
  if (isStrategies.value) return filterStrategies(q);
  if (isNetworks.value) return filterNetworks(q).filter(onlyMainnetNetworks);
  if (isPlugins.value) return filterPlugins(q);
  return [];
});

watch(
  () => route.query.filter,
  () => {
    if (isStrategies.value) getStrategies();
    if (isNetworks.value) getNetworksSpacesCount();
    if (isPlugins.value) getPluginsSpacesCount();
  },
  { immediate: true }
);

const loading = computed(() => {
  if (isStrategies.value) return isLoadingStrategies.value;
  if (isNetworks.value) return loadingNetworksSpacesCount.value;
  if (isPlugins.value) return loadingPluginsSpacesCount.value;
  return false;
});

const loadBy = 15;
const limit = ref(loadBy);

useInfiniteScroll(
  document,
  () => {
    limit.value += loadBy;
  },
  { distance: 400 }
);
</script>

<template>
  <div v-if="isSpaces">
    <ExploreSpaces />
  </div>
  <div v-else>
    <BaseContainer class="mb-4 flex items-center">
      <div tabindex="-1" class="mr-auto w-full max-w-[420px]">
        <TheSearchBar />
      </div>
      <div
        class="ml-3 hidden items-center whitespace-nowrap text-right sm:flex"
      >
        <div v-if="items.length" class="flex flex-col">
          {{ formatCompactNumber(items.length) }} {{ resultsStr }}
        </div>

        <BaseLink
          v-if="buttonStr"
          :link="createLink"
          class="ml-3 hidden md:block"
          hide-external-icon
        >
          <TuneButton tabindex="-1">
            {{ buttonStr }}
          </TuneButton>
        </BaseLink>
      </div>
    </BaseContainer>
    <BaseContainer :slim="true">
      <div class="overflow-hidden">
        <ExploreSkeletonLoading
          v-if="
            isLoadingStrategies ||
            loadingNetworksSpacesCount ||
            loadingPluginsSpacesCount
          "
        />
        <template v-else-if="isStrategies">
          <div class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <router-link
              v-for="item in items.slice(0, limit)"
              :key="item.key"
              :to="`/strategy/${item.id}`"
            >
              <BaseStrategyItem :strategy="item" />
            </router-link>
          </div>
        </template>
        <template v-else-if="isNetworks">
          <div class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <div v-for="item in items.slice(0, limit)" :key="item.key">
              <BaseNetworkItem :network="item" />
            </div>
          </div>
        </template>
        <template v-else-if="isPlugins">
          <div class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <div v-for="item in items.slice(0, limit)" :key="item.key">
              <BasePluginItem :plugin="item" />
            </div>
          </div>
        </template>
        <BaseNoResults v-if="items.length < 1 && !loading" use-block />
      </div>
    </BaseContainer>
  </div>
</template>
