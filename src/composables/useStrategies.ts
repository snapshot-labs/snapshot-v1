/**
 * Orders strategies by spaces count and returns a list of strategies
 * filtered by the search string (case insensitive).
 */

import { STRATEGIES_QUERY, EXTENDED_STRATEGY_QUERY } from '@/helpers/queries';
import { Strategy } from '@/helpers/interfaces';

const strategies = ref<Strategy[]>([]);
const extendedStrategies = ref<Strategy[]>([]);

export function useStrategies() {
  const isLoadingStrategies = ref(false);
  const extendedStrategy = ref<Strategy | null>(null);
  const loadingExtendedStrategy = ref(false);

  const strategyDefinition = computed(() => {
    if (extendedStrategy.value?.schema?.$ref) {
      return extendedStrategy.value.schema.definitions.Strategy;
    }
    return false;
  });

  const filterStrategies = (q = '') =>
    strategies.value.filter(s => s.id.toLowerCase().includes(q.toLowerCase()));

  const { apolloQuery } = useApolloQuery();

  // Get full list of strategies without about, schema and examples
  async function getStrategies() {
    if (strategies.value.length > 0) return;
    isLoadingStrategies.value = true;
    strategies.value = await apolloQuery(
      {
        query: STRATEGIES_QUERY
      },
      'strategies'
    );

    strategies.value = strategies.value.filter(
      strategy => strategy.id !== 'pagination'
    );

    isLoadingStrategies.value = false;
  }

  // Get extended strategy by Id and save it in extendedStrategies
  // don't load strategy if it's already loaded
  async function getExtendedStrategy(id: string) {
    if (extendedStrategies.value.some(st => st?.id === id)) {
      extendedStrategy.value =
        extendedStrategies.value.find(st => st?.id === id) ?? null;
      return;
    }
    loadingExtendedStrategy.value = true;
    const strategyObj = await apolloQuery(
      {
        query: EXTENDED_STRATEGY_QUERY,
        variables: { id }
      },
      'strategy'
    );

    if (strategyObj) {
      extendedStrategies.value.push(strategyObj);
      extendedStrategy.value = strategyObj;
    }

    loadingExtendedStrategy.value = false;
  }

  return {
    filterStrategies,
    getStrategies,
    getExtendedStrategy,
    strategies,
    isLoadingStrategies,
    extendedStrategy,
    strategyDefinition,
    loadingExtendedStrategy
  };
}
