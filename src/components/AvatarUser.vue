<script setup lang="ts">
import { getAddress } from '@ethersproject/address';

const props = withDefaults(
  defineProps<{
    address: string;
    size?: string;
    previewFile?: File | undefined;
  }>(),
  {
    size: '22',
    previewFile: undefined
  }
);

const { profilesCreated } = useProfiles();

const normalizedAddress = computed(() => getAddress(props.address));

const timestamp = computed(() => {
  if (
    !normalizedAddress.value ||
    !profilesCreated.value?.[normalizedAddress.value]
  ) {
    return '';
  }

  return `&ts=${profilesCreated.value[normalizedAddress.value]}`;
});
</script>

<template>
  <BaseAvatar
    :src="`https://cdn.stamp.fyi/avatar/eth:${normalizedAddress}?s=${
      Number(size) * 2
    }${timestamp}`"
    :preview-file="previewFile"
    :size="size"
  />
</template>
