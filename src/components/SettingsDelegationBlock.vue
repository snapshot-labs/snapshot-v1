<script setup lang="ts">
import schemas from '@snapshot-labs/snapshot.js/src/schemas';

const delegationDefinition =
  schemas.space.properties.delegationPortal.properties;

const props = defineProps<{
  context: 'setup' | 'settings';
  isViewOnly?: boolean;
}>();

const { form, validationErrors, addRef } = useFormSpaceSettings(props.context);

const delegationTypes = computed(() => {
  return delegationDefinition.delegationType.anyOf.map((item: any) => ({
    value: item.const,
    name: item.title
  }));
});
</script>

<template>
  <BaseBlock :title="$t('settings.delegationPortal.title')">
    <BaseMessageBlock level="info" class="mb-3">
      {{ $t('settings.delegationPortal.information') }}
    </BaseMessageBlock>

    <div class="space-y-2">
      <TuneListbox
        :ref="addRef"
        :items="delegationTypes"
        :model-value="form.delegationPortal.delegationType"
        :definition="delegationDefinition.delegationType"
        @update:model-value="
          value => (form.delegationPortal.delegationType = value)
        "
      />
      <TuneInput
        :ref="addRef"
        v-model="form.delegationPortal.delegationContract"
        :definition="delegationDefinition.delegationContract"
        :error="validationErrors.delegationPortal?.delegationContract"
      />

      <ComboboxNetwork
        :ref="addRef"
        label="Delegation network"
        :hint="delegationDefinition.delegationContract.description"
        :network="form.delegationPortal.delegationNetwork"
        @select="value => (form.delegationPortal.delegationNetwork = value)"
      />
      <TuneInput
        :ref="addRef"
        v-model="form.delegationPortal.delegationApi"
        :definition="delegationDefinition.delegationApi"
        :error="validationErrors.delegationPortal?.delegationApi"
      />
    </div>
  </BaseBlock>
</template>
