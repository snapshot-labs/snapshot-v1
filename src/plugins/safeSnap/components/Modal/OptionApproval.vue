<script>
import { BigNumber } from '@ethersproject/bignumber';
import { formatUnits } from '@ethersproject/units';
import { getEnsTextRecord } from '@snapshot-labs/snapshot.js/src/utils';
import { PROVIDER_OPTIONS } from '@/helpers/constants';

export default {
  props: [
    'spaceId',
    'open',
    'isApproved',
    'bond',
    'questionId',
    'minimumBond',
    'tokenSymbol',
    'tokenDecimals',
    'oracle'
  ],
  emits: ['close', 'setApproval'],
  setup() {
    const { safesnap } = useSafe();
    const { isValidEnsDomain } = useEns();
    return { safesnap, isValidEnsDomain };
  },
  data() {
    return { criteriaLink: '' };
  },
  computed: {
    answer() {
      return this.isApproved ? 'Yes' : 'No';
    },
    bondData() {
      const bondNotSet = BigNumber.from(this.bond).eq(0);
      const minimumBond = BigNumber.from(this.minimumBond).eq(0)
        ? BigNumber.from(10).pow(this.tokenDecimals)
        : this.minimumBond;
      const toSet = bondNotSet ? minimumBond : BigNumber.from(this.bond).mul(2);
      return {
        toSet: formatUnits(toSet, this.tokenDecimals),
        current: bondNotSet ? '--' : formatUnits(this.bond, this.tokenDecimals),
        tokenSymbol: this.tokenSymbol
      };
    },
    questionLink() {
      if (this.tokenSymbol && this.tokenSymbol !== 'ETH') {
        return `https://reality.eth.link/app/#!/token/${this.tokenSymbol}/question/${this.oracle}-${this.questionId}`;
      }
      return `https://reality.eth.link/app/#!/question/${this.oracle}-${this.questionId}`;
    }
  },
  mounted() {
    setTimeout(this.getCriteriaLink, 800);
  },
  methods: {
    async handleSetApproval(option) {
      await this.$emit('setApproval', option);
      this.$emit('close');
    },
    async getCriteriaLink() {
      if (this.isValidEnsDomain(this.spaceId)) {
        try {
          this.criteriaLink = await getEnsTextRecord(
            this.spaceId,
            'daorequirements',
            '1',
            PROVIDER_OPTIONS
          );
        } catch (err) {
          console.warn(
            '[safesnap] failed to get the "daorequirements" text record'
          );
        }
      }
    }
  }
};
</script>

<template>
  <BaseModal :open="open" @close="$emit('close')">
    <template #header>
      <h3 class="title">SafeSnap</h3>
    </template>
    <div class="m-4 mb-5">
      <p v-if="criteriaLink">
        {{ $t('safeSnap.labels.question') }}
        <a
          class="question-link"
          rel="noreferrer noopener"
          target="_blank"
          :href="criteriaLink"
        >
          {{ $t('safeSnap.labels.criteria') }}
        </a>
      </p>
      <p v-if="!criteriaLink">{{ $t('safeSnap.labels.proposalPassed') }}</p>
      <div style="text-align: right">
        <a
          :href="questionLink"
          class="text-skin-text"
          rel="noreferrer noopener"
          target="_blank"
          style="font-size: 16px"
        >
          Question
          <em style="font-size: 14px" class="iconfont iconexternal-link" />
        </a>
      </div>

      <div class="my-3 rounded-lg border p-3">
        <div>
          <strong class="pr-3">{{ $t('safeSnap.currentOutcome') }}:</strong>
          <span class="float-right text-skin-link">
            {{ answer }}
          </span>
        </div>
        <div>
          <strong class="pr-3">{{ $t('safeSnap.currentBond') }}:</strong>
          <span class="float-right text-skin-link">
            {{ bondData.current + ' ' + tokenSymbol }}
          </span>
        </div>
        <div>
          <strong class="pr-3">{{ $t('safeSnap.nextBond') }}:</strong>
          <span class="float-right text-skin-link">
            {{ bondData.toSet + ' ' + bondData.tokenSymbol }}
          </span>
        </div>
      </div>

      <div class="mt-5">
        <h4 class="text-center">
          {{ $t('safeSnap.setOutcomeTo') }}
        </h4>
        <div class="vote-button-row">
          <TuneButton class="button vote-button" @click="handleSetApproval(0)">
            No
          </TuneButton>
          <TuneButton class="vote-button" primary @click="handleSetApproval(1)">
            Yes
          </TuneButton>
        </div>
      </div>
    </div>
  </BaseModal>
</template>

<style>
.vote-button {
  width: 187px;
}
.vote-button-row {
  padding-top: 15px;
  display: flex;
  justify-content: space-between;
}
.title {
  text-align: left;
  padding-left: 20px;
}
.question-link {
  color: var(--link-color);
  text-decoration: underline;
}
</style>
