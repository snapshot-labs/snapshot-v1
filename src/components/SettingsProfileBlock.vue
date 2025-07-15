<script setup lang="ts">
import schemas from '@snapshot-labs/snapshot.js/src/schemas';
import { SPACE_CATEGORIES } from '@/helpers/constants';

const props = defineProps<{
  context: 'setup' | 'settings';
  isViewOnly?: boolean;
}>();

const { form, validationErrors, addRef } = useFormSpaceSettings(props.context);

const avatarNotReactive = ref(form.value.avatar);
</script>

<template>
  <BaseBlock :title="$t('settings.profile')">
    <div class="space-y-2">
      <div class="flex flex-col-reverse sm:flex-row">
        <div class="mt-3 w-full space-y-2 sm:mt-0">
          <div class="flex w-full">
            <div>
              <LabelInput>
                {{ $t('settings.avatar') }}
              </LabelInput>
              <InputUploadAvatar
                :is-view-only="isViewOnly"
                class="h-[80px]"
                @image-uploaded="url => (form.avatar = url)"
                @image-remove="() => (form.avatar = '')"
              >
                <template #avatar="{ uploading, previewFile }">
                  <div class="relative">
                    <AvatarSpace
                      :preview-file="previewFile"
                      size="80"
                      :space="{
                        id:
                          ($route.params.ens as string) ??
                          ($route.params.key as string),
                        avatar: avatarNotReactive
                      }"
                    />
                    <AvatarOverlayEdit
                      :loading="uploading"
                      :avatar="form?.avatar"
                      :is-view-only="isViewOnly"
                    />
                    <div
                      :class="{
                        'cursor-not-allowed': isViewOnly
                      }"
                      class="absolute bottom-[2px] right-0 rounded-full bg-skin-heading p-1"
                    >
                      <i-ho-pencil class="text-[12px] text-skin-bg" />
                    </div>
                  </div>
                </template>
              </InputUploadAvatar>
            </div>
          </div>

          <TuneInput
            :ref="addRef"
            v-model="form.name"
            :label="$t(`settings.name.label`)"
            :error="validationErrors?.name"
            :max-length="schemas.space.properties.name.maxLength"
            :placeholder="$t('settings.name.placeholder')"
            :disabled="isViewOnly"
            autofocus
          />

          <TuneTextarea
            :ref="addRef"
            v-model="form.about"
            :label="$t(`settings.about.label`)"
            :max-length="schemas.space.properties.about.maxLength"
            :placeholder="$t('settings.about.placeholder')"
            :disabled="isViewOnly"
          />

          <TuneListboxMultiple
            :ref="addRef"
            v-model="form.categories"
            :placeholder="$t('settings.categories.select')"
            :label="$t(`settings.categories.label`)"
            :items="
              SPACE_CATEGORIES.map(category => ({
                value: category,
                name: $t(`explore.categories.${category}`)
              }))
            "
            :limit="2"
            :disabled="isViewOnly"
          />

          <TuneInputUrl
            :ref="addRef"
            v-model="form.website"
            :label="$t('settings.website')"
            :error="validationErrors?.website"
            :max-length="schemas.space.properties.website.maxLength"
            :disabled="isViewOnly"
            placeholder="e.g. https://www.example.com"
          />

          <TuneInputUrl
            :ref="addRef"
            v-model="form.terms"
            :label="$t(`settings.terms.label`)"
            :hint="$t('settings.terms.information')"
            :error="validationErrors?.terms"
            :disabled="isViewOnly"
            placeholder="e.g. https://example.com/terms"
          />

          <TuneSwitch
            v-model="form.private"
            :disabled="isViewOnly"
            :label="$t('settings.hideSpace')"
          />
        </div>
      </div>
    </div>
  </BaseBlock>
</template>
