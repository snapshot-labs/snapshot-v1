<script setup lang="ts">
const route = useRoute();

const { getExtendedStrategy, extendedStrategy: strategy } = useStrategies();

useMeta({
  title: {
    key: 'metaInfo.strategy.title',
    params: {
      strategy: route.params.name as string
    }
  },
  description: {
    key: 'metaInfo.strategy.description'
  }
});

onMounted(async () => {
  await getExtendedStrategy(route.params.name as string);
});
</script>

<template>
  <TheLayout>
    <template #content-left>
      <div class="mb-3 px-4 md:px-0">
        <router-link
          :to="{ path: '/', query: { type: 'strategies' } }"
          class="text-skin-text"
        >
          <BaseIcon name="back" size="22" class="!align-middle" />
          {{ $t('strategiesPage') }}
        </router-link>
      </div>
      <LoadingPage v-if="!strategy" />
      <div v-else class="px-4 md:px-0">
        <h1 class="mb-2">
          {{ strategy.id }}
        </h1>
        <span
          class="text-skin-text"
          v-text="`In ${strategy.spacesCount} space(s)`"
        />
        <BaseMarkdown
          v-if="strategy.about"
          :body="strategy.about"
          class="mb-6 mt-4"
        />
      </div>
    </template>
    <template #sidebar-right>
      <BaseBlock v-if="strategy" :title="$t('information')">
        <div class="mb-1">
          <b>{{ $t('author') }}</b>
          <BaseLink
            class="float-right"
            :link="`https://github.com/${strategy.author}`"
            hide-external-icon
          >
            <BaseIcon name="github" class="ml-1" />
            {{ strategy.author }}
          </BaseLink>
        </div>
        <div>
          <div class="mb-1">
            <b>{{ $t('version') }}</b>
            <BaseLink
              class="float-right"
              :link="`https://github.com/snapshot-labs/score-api/tree/master/src/strategies/strategies/${strategy.id}`"
            >
              {{ strategy.version }}
            </BaseLink>
          </div>
        </div>
        <router-link :to="`/playground/${$route.params.name}`">
          <TuneButton tabindex="-1" class="mt-2 w-full">{{
            $t('playground')
          }}</TuneButton>
        </router-link>
      </BaseBlock>
    </template>
  </TheLayout>
</template>
