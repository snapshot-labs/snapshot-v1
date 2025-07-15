<script setup lang="ts">
const socials = [
  {
    icon: 'x',
    link: 'https://x.com/SnapshotLabs'
  },
  {
    icon: 'discord',
    link: 'https://discord.snapshot.org/'
  }
];
</script>

<template>
  <div
    class="flex items-center justify-center space-x-3 pt-2 md:mt-4 md:justify-start lg:mt-0 lg:justify-end"
  >
    <span v-for="social in socials" :key="social.icon">
      <BaseLink :link="social.link" hide-external-icon>
        <FooterSocialsItem v-if="social.icon === 'x'">
          <i-s-x class="text-[23px]" />
        </FooterSocialsItem>
        <FooterSocialsItem v-else-if="social.icon === 'discord'">
          <i-s-discord class="text-[23px]" />
        </FooterSocialsItem>
      </BaseLink>
    </span>
  </div>
</template>
