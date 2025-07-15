import { StaticJsonRpcProvider } from '@ethersproject/providers';
import { BigNumber } from '@ethersproject/bignumber';
import snapshot from '@snapshot-labs/snapshot.js';
import { ORACLE_ABI } from '../constants';

export const retrieveInfoFromOracle = async (
  provider: StaticJsonRpcProvider,
  network: string,
  oracleAddress: string,
  questionId: string | undefined
): Promise<{
  currentBond: BigNumber | undefined;
  isApproved: boolean;
  endTime: number | undefined;
}> => {
  if (questionId) {
    const result = await snapshot.utils.multicall(network, provider, ORACLE_ABI, [
      [oracleAddress, 'getFinalizeTS', [questionId]],
      [oracleAddress, 'getBond', [questionId]],
      [oracleAddress, 'getBestAnswer', [questionId]]
    ]);

    const currentBond = BigNumber.from(result[1][0]);
    const answer = BigNumber.from(result[2][0]);

    return {
      currentBond,
      isApproved: answer.eq(BigNumber.from(1)),
      endTime: BigNumber.from(result[0][0]).toNumber()
    };
  }
  return {
    currentBond: undefined,
    isApproved: false,
    endTime: undefined
  };
};
