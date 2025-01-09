<script setup lang="ts">
const { isGnosisSafe } = useClient();
const { validationErrors } = useFormSpaceSettings('setup');

defineProps<{
  creatingSpace: boolean;
}>();

const emit = defineEmits(['submit', 'back']);

const showErrors = ref(false);

function handleSubmit() {
  if (validationErrors.value.validation) return (showErrors.value = true);
  emit('submit');
}
</script>

<template>
  <div v-if="isGnosisSafe" class="space-y-4">
    <SettingsMembersBlock context="setup" />

    <SettingsProposalBlock context="setup" />

    <SettingsVotingBlock context="setup" />

    <!-- <SettingsDomainBlock context="setup" /> -->

    <SettingsSubSpacesBlock context="setup" />

    <SettingsTreasuriesBlock context="setup" />

    <SettingsPluginsBlock context="setup" />

    <SettingsValidationBlock context="setup" :show-errors="showErrors" />
  </div>
  <div v-else class="space-y-4">
    <h4 class="-mb-2 px-4 md:px-0">
      {{ $t('setup.validationTitle') }}
    </h4>
    <SettingsMembersBlock context="setup" />
    <SettingsValidationBlock context="setup" :show-errors="showErrors" />
  </div>

  <div class="px-4 md:px-0">
    <SetupButtonCreate
      :creating-space="creatingSpace"
      class="mt-4"
      @create="handleSubmit"
    />
    <SetupButtonBack @click="emit('back')" />
  </div>
</template>
