import { StaticJsonRpcProvider } from '@ethersproject/providers';
import snapshot from '@snapshot-labs/snapshot.js';
import { REALITY_MODULE_ABI, ORACLE_ABI } from '../constants';
import { HashZero } from '@ethersproject/constants';
import { BigNumber } from '@ethersproject/bignumber';
import { keccak256 as solidityKeccak256 } from '@ethersproject/solidity';

export const buildQuestion = async (proposalId: string, txHashes: string[]) => {
  const hashesHash = solidityKeccak256(['bytes32[]'], [txHashes]).slice(2);
  return `${proposalId}␟${hashesHash}`;
};

export const getProposalDetails = async (
  provider: StaticJsonRpcProvider,
  network: string,
  moduleAddress: string,
  questionHash: string,
  txHashes: string[]
): Promise<{ questionId: string; nextTxIndex: number | undefined }> => {
  const proposalInfo = (
    await snapshot.utils.multicall(
      network,
      provider,
      REALITY_MODULE_ABI,
      [[moduleAddress, 'questionIds', [questionHash]]].concat(
        txHashes.map(txHash => [
          moduleAddress,
          'executedProposalTransactions',
          [questionHash, txHash]
        ])
      )
    )
  ).map(res => res[0]);
  const questionId = proposalInfo[0];
  // We need to offset the index by -1 the first element is the questionId
  const nextIndexToExecute = proposalInfo.indexOf(false, 1) - 1;
  return {
    questionId: questionId !== HashZero ? questionId : undefined,
    nextTxIndex:
      nextIndexToExecute < 0 || nextIndexToExecute >= txHashes.length
        ? undefined
        : nextIndexToExecute
  };
};

export const getModuleDetailsReality = async (
  provider: StaticJsonRpcProvider,
  network: string,
  moduleAddress: string
): Promise<{
  dao: string;
  oracle: string;
  cooldown: number;
  minimumBond: number;
  expiration: number;
}> => {
  let moduleDetails;
  try {
    // Assume module is Reality Module
    moduleDetails = await snapshot.utils.multicall(network, provider, REALITY_MODULE_ABI, [
      [moduleAddress, 'avatar'],
      [moduleAddress, 'oracle'],
      [moduleAddress, 'questionCooldown'],
      [moduleAddress, 'minimumBond'],
      [moduleAddress, 'answerExpiration']
    ]);
  } catch (err) {
    // The Reality Module doesn't have an avatar field, causing tx to fails.
    // Assume module is Dao Module (old version)
    moduleDetails = await snapshot.utils.multicall(network, provider, REALITY_MODULE_ABI, [
      [moduleAddress, 'executor'],
      [moduleAddress, 'oracle'],
      [moduleAddress, 'questionCooldown'],
      [moduleAddress, 'minimumBond'],
      [moduleAddress, 'answerExpiration']
    ]);
  }

  return {
    dao: moduleDetails[0][0],
    oracle: moduleDetails[1][0],
    cooldown: moduleDetails[2][0],
    minimumBond: moduleDetails[3][0],
    expiration: moduleDetails[4][0]
  };
};

export const checkPossibleExecution = async (
  provider: StaticJsonRpcProvider,
  network: string,
  oracleAddress: string,
  questionId: string | undefined
): Promise<{
  executionApproved: boolean;
  finalizedAt: number | undefined;
}> => {
  if (questionId) {
    try {
      const result = await snapshot.utils.multicall(network, provider, ORACLE_ABI, [
        [oracleAddress, 'resultFor', [questionId]],
        [oracleAddress, 'getFinalizeTS', [questionId]]
      ]);

      return {
        executionApproved: BigNumber.from(result[0][0]).eq(BigNumber.from(1)),
        finalizedAt: BigNumber.from(result[1][0]).toNumber()
      };
    } catch (e) {
      // We expect an error while the question is not answered yet
    }
  }
  return {
    executionApproved: false,
    finalizedAt: undefined
  };
};
