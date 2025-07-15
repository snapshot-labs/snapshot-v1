<script setup lang="ts">
import { validateForm } from '@/helpers/validation';
import { clone } from '@snapshot-labs/snapshot.js/src/utils';

type DelegateRowForm = {
  to: string;
  weight: number;
};

const definition = {
  type: 'object',
  properties: {
    to: {
      type: 'string',
      format: 'address',
      title: 'Delegate to',
      description: 'The address of who you want to delegate to',
      examples: ['Address']
    },
    weight: {
      type: 'number',
      minimum: 0,
      maximum: 100
    }
  },
  required: ['to', 'weight'],
  additionalProperties: false,
  errorMessage: {
    properties: {
      to: 'Must be a valid checksum address'
    }
  }
};

const props = defineProps<{
  address: string;
  weight: number;
}>();

const emit = defineEmits(['deleteDelegate', 'update:modelValue']);

const form = ref<DelegateRowForm>({
  to: props.address,
  weight: props.weight ?? 0
});

const validationErrors = computed(() => {
  return validateForm(definition, clone(form.value));
});

const roundedWeight = computed(() => {
  return Math.round(form.value.weight * 10) / 10;
});

const updateFormValue = <T extends keyof DelegateRowForm>(
  value: DelegateRowForm[T],
  field: T
) => {
  if (field === 'weight') {
    form.value[field] = (Math.round(parseFloat(value as string) * 10) /
      10) as DelegateRowForm[T];
  } else {
    form.value[field] = value;
  }
  emit('update:modelValue', clone(form.value));
};

watch(
  () => props.address,
  newAddress => {
    form.value.to = newAddress;
  },
  { immediate: true }
);

watch(
  () => props.weight,
  newWeight => {
    form.value.weight = newWeight;
  },
  { immediate: true }
);
</script>

<template>
  <div class="items-end flex space-x-1">
    <div class="min-w-[66.7%]">
      <TuneInput
        :model-value="form.to"
        :placeholder="definition.properties.to.examples[0]"
        :class="{ 'tune-error-border': validationErrors?.to && form.to }"
        @update:model-value="event => updateFormValue(event, 'to')"
      />
    </div>
    <div class="relative">
      <TuneInput
        :model-value="roundedWeight"
        type="number"
        :class="[
          'text-right pr-5',
          { 'tune-error-border': validationErrors?.weight }
        ]"
        @update:model-value="
          event => updateFormValue(parseFloat(event), 'weight')
        "
      >
        <template #after><span class="-mr-2">%</span></template>
      </TuneInput>
    </div>
    <BaseButtonIcon
      class="h-[42px] min-w-[42px] rounded-full border border-skin-border flex items-center justify-center tune-button"
      @click="() => $emit('deleteDelegate')"
    >
      <i-ho-x class="text-[17px]" />
    </BaseButtonIcon>
  </div>
  <TuneErrorInput
    v-if="validationErrors && form.to"
    :error="validationErrors?.to"
  />
  <TuneErrorInput v-if="validationErrors" :error="validationErrors?.weight" />
</template>
