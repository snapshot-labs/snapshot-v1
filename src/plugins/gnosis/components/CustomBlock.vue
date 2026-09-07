<script>
import Plugin from '../index';
import getProvider from '@snapshot-labs/snapshot.js/src/utils/provider';
import { PROVIDER_OPTIONS } from '@/helpers/constants';
import { shorten } from '@/helpers/utils';

export default {
  props: ['proposalConfig', 'choices'],
  setup() {
    return { shorten };
  },
  data() {
    return {
      loading: false,
      plugin: new Plugin(),
      baseToken: {},
      baseTokenUrl: '',
      quoteToken: {},
      baseProductMarketMaker: {},
      quoteProductMarketMaker: {},
      quoteCurrencyPrice: 0.0,
      priceFirstOption: 0.0,
      priceSecondOption: 0.0,
      predictPriceImpact: 0.0
    };
  },
  async created() {
    this.loading = true;
    const network = this.proposalConfig.network || '1';
    const provider = getProvider(network, PROVIDER_OPTIONS);
    this.baseToken = await this.plugin.getTokenInfo(
      provider,
      this.proposalConfig.baseTokenAddress
    );
    this.baseTokenUrl = this.getLogoUrl(this.baseToken.checksumAddress);
    this.quoteToken = await this.plugin.getTokenInfo(
      provider,
      this.proposalConfig.quoteCurrencyAddress
    );
    const conditionQuery = await this.plugin.getOmenCondition(
      network,
      this.proposalConfig.conditionId
    );
    this.baseProductMarketMaker =
      conditionQuery.condition.fixedProductMarketMakers.find(
        market =>
          market.collateralToken === this.proposalConfig.baseTokenAddress
      );
    this.quoteProductMarketMaker =
      conditionQuery.condition.fixedProductMarketMakers.find(
        market => market.collateralToken === this.quoteToken.address
      );

    const tokenPairQuery = await this.plugin.getUniswapPair(
      network,
      this.proposalConfig.quoteCurrencyAddress,
      this.proposalConfig.baseTokenAddress
    );
    if (
      tokenPairQuery !== undefined &&
      tokenPairQuery.token0Price !== undefined
    ) {
      this.quoteCurrencyPrice = parseFloat(tokenPairQuery.token0Price);
    }
    this.priceFirstOption = this.getTokenPrice(0);
    this.priceSecondOption = this.getTokenPrice(1);
    this.predictPriceImpact =
      ((this.priceFirstOption - this.priceSecondOption) /
        this.priceSecondOption) *
      100;
    this.loading = false;
  },
  methods: {
    getLogoUrl(checksumAddress) {
      return `https://gnosis-safe-token-logos.s3.amazonaws.com/${checksumAddress}.png`;
    },
    getMarketUrl(marketIndex) {
      const network = this.proposalConfig.network || '1';
      if (network === '100') {
        return `https://xdai.omen.eth.link/#/${marketIndex.id}`;
      }
      return `https://omen.eth.link/#/${marketIndex.id}`;
    },
    getTokenPrice(outcomeIndex) {
      return (
        this.quoteCurrencyPrice *
        (parseFloat(
          this.baseProductMarketMaker.outcomeTokenMarginalPrices[outcomeIndex]
        ) /
          parseFloat(
            this.quoteProductMarketMaker.outcomeTokenMarginalPrices[
              outcomeIndex
            ]
          ))
      );
    }
  }
};
</script>

<template>
  <div v-if="choices.length > 1">
    <div v-if="loading" class="loading">
      {{ $t('loading') }}
    </div>
    <div class="mb-1">
      <b>
        {{ $t('predictedImpact') }}
      </b>
      <div class="float-right">
        <span :aria-label="baseToken.name" class="tooltipped tooltipped-n">
          <img
            class="circle inline-block border !align-middle leading-none"
            :src="baseTokenUrl"
            :alt="baseToken.name"
            width="22"
            height="22"
          />
        </span>
        {{ predictPriceImpact.toFixed(2) }}%
      </div>
    </div>
    <div class="mb-1" :title="choices[0]">
      <b>{{ shorten(choices[0], 'name') }}</b>
      <span class="float-right">
        1
        {{ baseToken.symbol }}
        =
        {{ priceFirstOption.toFixed(2) }}
        {{ quoteToken.symbol }}
      </span>
    </div>
    <div
      :title="choices[1]"
      class="mb-1 rounded-t-none border-b bg-skin-header-bg md:rounded-t-md"
      style="padding-bottom: 12px"
    >
      <b>{{ shorten(choices[1], 'name') }}</b>
      <span class="float-right">
        1
        {{ baseToken.symbol }}
        =
        {{ priceSecondOption.toFixed(2) }}
        {{ quoteToken.symbol }}
      </span>
    </div>
    <div class="mb-1" style="padding-top: 12px">
      <b>{{ $tc('marketSymbol', [baseToken.symbol]) }}</b>
      <a
        :href="getMarketUrl(baseProductMarketMaker)"
        target="_blank"
        class="float-right"
      >
        <BaseIcon name="external-link" class="ml-1" />
      </a>
    </div>
    <div>
      <div class="mb-1">
        <b>{{ $tc('marketSymbol', [baseToken.symbol]) }}</b>
        <a
          :href="getMarketUrl(quoteProductMarketMaker)"
          target="_blank"
          class="float-right"
        >
          <BaseIcon name="external-link" class="ml-1" />
        </a>
      </div>
    </div>
  </div>
  <div v-else>
    {{ $t('twoChoicesRequired') }}
  </div>
</template>
