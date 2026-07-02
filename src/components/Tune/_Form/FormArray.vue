<script setup lang="ts">
import cloneDeep from 'lodash/cloneDeep';

import TuneForm from '../TuneForm.vue';
import FormString from './FormString.vue';
import FormNumber from './FormNumber.vue';
import FormBoolean from './FormBoolean.vue';

const props = defineProps<{
  modelValue: any[];
  definition: any;
  error: any;
}>();

const emit = defineEmits(['update:modelValue']);

const input = computed({
  get: () => props.modelValue,
  set: value => emit('update:modelValue', value)
});

const getComponent = (type: string) => {
  switch (type) {
    case 'object':
      return TuneForm;
    case 'string':
      return FormString;
    case 'number':
      return FormNumber;
    case 'boolean':
      return FormBoolean;
    default:
      return null;
  }
};

// Build a fresh array item. Object items must start as an object, otherwise
// TuneForm renders their fields against a throwaway object and edits are never
// written back (the item stays undefined/'' and fails "Must be object").
function createItem() {
  const items = props.definition?.items;
  if (items?.default !== undefined) return cloneDeep(items.default);
  return items?.type === 'object' ? {} : '';
}

function addItem() {
  const array = cloneDeep(input.value);
  array.push(createItem());
  input.value = array;
}

const componentRefs = ref();

function forceShowError() {
  if (componentRefs?.value?.forceShowError)
    componentRefs?.value?.forceShowError();
  else
    componentRefs?.value?.forEach((ref: any) => {
      if (ref?.forceShowError) ref?.forceShowError();
    });
}

defineExpose({
  forceShowError
});

onMounted(() => {
  if (props.definition?.title === 'Strategies') return;
  if (!props.modelValue) input.value = [createItem()];
});
</script>

<template>
  <div v-if="definition?.title === 'Strategies'" />

  <TuneListboxMultiple
    v-else-if="definition?.items?.anyOf && definition?.items?.type === 'string'"
    ref="componentRefs"
    v-model="input"
    :items="
      definition.items.anyOf.map((item: any) => ({
        value: item.const,
        name: item.title
      }))
    "
    :definition="definition"
    :error="error"
  />

  <TuneTextareaArray
    v-else-if="definition?.items?.type === 'string'"
    v-model="input"
    :definition="definition"
    :error="error"
  />

  <div v-else-if="definition?.items" class="space-y-2">
    <TuneLabelInput v-if="definition?.title" :hint="definition?.description">
      {{ definition?.title }}
    </TuneLabelInput>
    <div
      v-for="(_, i) in input"
      :key="i"
      :class="{
        'tune-form-array-objects': definition?.items?.type === 'object'
      }"
    >
      <div class="mb-2">
        <TuneTag :label="i + 1" />
      </div>
      <component
        :is="getComponent(definition.items.type)"
        ref="componentRefs"
        v-model="input[i]"
        :definition="definition.items"
        :error="error"
      />
    </div>
    <TuneButton class="w-full" @click="addItem"> Add </TuneButton>
  </div>
</template>
