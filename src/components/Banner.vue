<script setup lang="ts">
const route = useRoute();
const { env, domain } = useApp();

const link = computed(() => {
  const baseUrl =
    env === 'demo'
      ? 'https://testnet.snapshot.box/#/'
      : 'https://snapshot.box/#/';
  let path = 'home';
  const prefix = env === 'demo' ? `s-tn` : 's';

  switch (route.name) {
    case 'home': {
      path = 'explore';
      break;
    }
    case 'spaceProposals': {
      path = `${prefix}:${route.params.key}`;
      break;
    }
    case 'spaceSettings': {
      path = `${prefix}:${route.params.key}/settings`;
      break;
    }
    case 'spaceAbout': {
      path = `${prefix}:${route.params.key}`;
      break;
    }
    case 'spaceProposal': {
      path = `${prefix}:${route.params.key}/proposal/${route.params.id}`;
      break;
    }
    case 'spaceCreate': {
      path = `${prefix}:${route.params.key}/create`;
      break;
    }
    case 'spaceDelegates': {
      path = `${prefix}:${route.params.key}/delegates`;
      break;
    }
    case 'delegate': {
      path = route.params.key
        ? `${prefix}:${route.params.key}/delegates`
        : 'explore';
      break;
    }
    case 'profileAbout': {
      path = `profile/${route.params.address}`;
      break;
    }
    case 'profileActivity': {
      path = `profile/${route.params.address}`;
      break;
    }
  }

  return `${baseUrl}${path}`;
});
</script>

<template>
  <a
    v-if="!domain"
    :href="link"
    class="flex bg-blue-700 text-white rounded-full px-[10px] py-[2px] gap-1"
  >
    <div class="leading-6 hidden md:block">Switch to the new interface</div>
    <div class="leading-6 md:hidden">Switch to v2</div>
    <i-ho-arrow-narrow-right class="shrink-0 hidden xs:block" />
  </a>
</template>
