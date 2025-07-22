import { Result } from '@ethersproject/abi';
import { isAddress } from '@ethersproject/address';
import { isHexString } from '@ethersproject/bytes';
import { toUtf8Bytes } from '@ethersproject/strings';
import { Contract } from '@ethersproject/contracts';
import { BigNumber } from '@ethersproject/bignumber';
import { _TypedDataEncoder } from '@ethersproject/hash';
import { StaticJsonRpcProvider } from '@ethersproject/providers';
import { keccak256 as solidityKeccak256 } from '@ethersproject/solidity';
import { isBigNumberish } from '@ethersproject/bignumber/lib/bignumber';

import snapshot from '@snapshot-labs/snapshot.js';
import getProvider from '@snapshot-labs/snapshot.js/src/utils/provider';
import {
  SafeTransaction,
  RealityOracleProposal,
  UmaOracleProposal
} from '@/helpers/interfaces';
import {
  EIP712_TYPES,
  REALITY_MODULE_ABI,
  UMA_MODULE_ABI,
  ORACLE_ABI,
  ERC20_ABI
} from './constants';
import {
  buildQuestion,
  checkPossibleExecution,
  getModuleDetailsReality,
  getProposalDetails
} from './utils/realityModule';
import { getModuleDetailsUma, getModuleDetailsUmaGql } from './utils/umaModule';
import { retrieveInfoFromOracle } from './utils/realityETH';
import { getNativeAsset } from '@/plugins/safeSnap/utils/coins';
import { Network } from './types';

export * from './constants';

export * from './utils/abi';
export * from './utils/safe';
export * from './utils/coins';
export * from './utils/index';
export * from './utils/decoder';
export * from './utils/multiSend';
export * from './utils/realityETH';
export * from './utils/transactions';
export * from './utils/realityModule';

const broviderUrl = import.meta.env.VITE_BROVIDER_URL;
export default class Plugin {
  validateTransaction(transaction: SafeTransaction) {
    const addressEmptyOrValidate =
      transaction.to === '' || isAddress(transaction.to);
    return (
      isBigNumberish(transaction.value) &&
      addressEmptyOrValidate &&
      (!transaction.data || isHexString(transaction.data)) &&
      ['0', '1'].includes(transaction.operation) &&
      isBigNumberish(transaction.nonce)
    );
  }

  calcTransactionHash(
    network: string,
    moduleAddress: string,
    transaction: SafeTransaction
  ) {
    const chainId = parseInt(network);
    const domain = {
      chainId,
      verifyingContract: moduleAddress
    };
    return _TypedDataEncoder.hash(domain, EIP712_TYPES, transaction);
  }

  calcTransactionHashes(
    chainId: number,
    moduleAddress: string,
    transactions: SafeTransaction[]
  ) {
    const domain = {
      chainId: chainId,
      verifyingContract: moduleAddress
    };
    return transactions.map(tx => {
      return _TypedDataEncoder.hash(domain, EIP712_TYPES, {
        ...tx,
        nonce: tx.nonce || '0',
        data: tx.data || '0x'
      });
    });
  }

  async getExecutionDetailsWithHashes(
    network: string,
    moduleAddress: string,
    proposalId: string,
    txHashes: string[]
  ): Promise<Omit<RealityOracleProposal, 'transactions'>> {
    const provider: StaticJsonRpcProvider = getProvider(network, {
      broviderUrl
    });
    const question = await buildQuestion(proposalId, txHashes);
    const questionHash = solidityKeccak256(['string'], [question]);

    const proposalDetails = await getProposalDetails(
      provider,
      network,
      moduleAddress,
      questionHash,
      txHashes
    );
    const moduleDetails = await getModuleDetailsReality(
      provider,
      network,
      moduleAddress
    );
    const questionState = await checkPossibleExecution(
      provider,
      network,
      moduleDetails.oracle,
      proposalDetails.questionId
    );
    const infoFromOracle = await retrieveInfoFromOracle(
      provider,
      network,
      moduleDetails.oracle,
      proposalDetails.questionId
    );
    return {
      ...moduleDetails,
      proposalId,
      ...questionState,
      ...proposalDetails,
      txHashes,
      ...infoFromOracle
    };
  }

  async getModuleDetailsReality(network: string, moduleAddress: string) {
    const provider: StaticJsonRpcProvider = getProvider(network, {
      broviderUrl
    });
    return getModuleDetailsReality(provider, network, moduleAddress);
  }

  async validateUmaModule(network: string, umaAddress: string) {
    if (!isAddress(umaAddress)) return 'reality';

    const provider: StaticJsonRpcProvider = getProvider(network, {
      broviderUrl
    });
    const moduleContract = new Contract(umaAddress, UMA_MODULE_ABI, provider);

    return moduleContract
      .rules()
      .then(() => 'uma')
      .catch(() => 'reality');
  }

  async getExecutionDetailsUma(
    network: Network,
    moduleAddress: string,
    proposalId: string,
    explanation: string,
    transactions: any
  ) {
    const moduleDetails = await this.getModuleDetailsUma(
      network,
      moduleAddress,
      explanation,
      transactions
    );

    return {
      ...moduleDetails,
      proposalId,
      explanation
    };
  }

  async *approveBondUma(
    network: Network,
    web3: any,
    moduleAddress: string,
    transactions?: any
  ) {
    const moduleDetails = await this.getModuleDetailsUma(
      network,
      moduleAddress,
      '',
      transactions
    );

    const approveTx = await snapshot.utils.sendTransaction(
      web3,
      moduleDetails.collateral,
      ERC20_ABI,
      'approve',
      [moduleAddress, moduleDetails.minimumBond],
      {}
    );
    yield approveTx;
    const approvalReceipt = await approveTx.wait();
    console.log('[DAO module] token transfer approved:', approvalReceipt);
    yield;
  }

  async getModuleDetailsUma(
    network: Network,
    moduleAddress: string,
    explanation: string,
    transactions: any
  ) {
    const provider: StaticJsonRpcProvider = getProvider(network, {
      broviderUrl
    });
    try {
      // try optimized calls, which use the graph over web3 event queries
      return await getModuleDetailsUmaGql(
        provider,
        network,
        moduleAddress,
        explanation,
        transactions
      );
    } catch (err) {
      console.warn('Error querying module details from the graph:', err);
      // fall back to web3 event queries.
      return getModuleDetailsUma(
        provider,
        network,
        moduleAddress,
        explanation,
        transactions
      );
    }
  }

  async *submitProposalWithHashes(
    web3: any,
    moduleAddress: string,
    proposalId: string,
    txHashes: string[]
  ) {
    const tx = await snapshot.utils.sendTransaction(
      web3,
      moduleAddress,
      REALITY_MODULE_ABI,
      'addProposal',
      [proposalId, txHashes]
    );
    yield tx;
    const receipt = await tx.wait();
    console.log('[DAO module] submitted proposal:', receipt);
  }

  async *submitProposalUma(
    web3: any,
    moduleAddress: string,
    explanation: string,
    transactions: any
  ) {
    const explanationBytes = toUtf8Bytes(explanation);
    const tx = await snapshot.utils.sendTransaction(
      web3,
      moduleAddress,
      UMA_MODULE_ABI,
      'proposeTransactions',
      [transactions, explanationBytes]
      // [[["0xB8034521BB1a343D556e5005680B3F17FFc74BeD", 0, "0", "0x"]], '0x']
    );
    yield tx;
    const receipt = await tx.wait();
    console.log('[DAO module] submitted proposal:', receipt);
  }

  async loadClaimBondData(
    web3: any,
    network: Network,
    questionId: string,
    oracleAddress: string,
    block: string
  ) {
    const contract = new Contract(oracleAddress, ORACLE_ABI, web3);
    const provider: StaticJsonRpcProvider = getProvider(network, {
      broviderUrl
    });
    const account = (await web3.listAccounts())[0];

    const [[userBalance], [bestAnswer], [historyHash], [isFinalized]] =
      await snapshot.utils.multicall(network, provider, ORACLE_ABI, [
        [oracleAddress, 'balanceOf', [account]],
        [oracleAddress, 'getBestAnswer', [questionId]],
        [oracleAddress, 'getHistoryHash', [questionId]],
        [oracleAddress, 'isFinalized', [questionId]]
      ]);

    const nativeToken = getNativeAsset(network);
    let token = {
      symbol: nativeToken.symbol,
      decimals: nativeToken.decimals
    };

    try {
      const tokenCall = await snapshot.utils.call(provider, ORACLE_ABI, [
        oracleAddress,
        'token',
        []
      ]);
      const [[symbol], [decimals]] = await snapshot.utils.multicall(
        network,
        provider,
        ERC20_ABI,
        [
          [tokenCall, 'symbol', []],
          [tokenCall, 'decimals', []]
        ]
      );

      token = {
        symbol,
        decimals
      };
    } catch (e) {
      console.log('[Realitio] Info: Oracle is not ERC20 based.');
    }

    const answersFilter = contract.filters.LogNewAnswer(null, questionId);
    const events = await contract.queryFilter(answersFilter, parseInt(block));

    const users: Result[] = [];
    const historyHashes: Result[] = [];
    const bonds: Result[] = [];
    const answers: Result[] = [];

    // We need to send the information from last to first
    events.reverse();
    events.forEach(({ args }) => {
      users.push(args?.user.toLowerCase());
      historyHashes.push(args?.history_hash);
      bonds.push(args?.bond);
      answers.push(args?.answer);
    });

    const alreadyClaimed = BigNumber.from(historyHash).eq(0);
    const address = account.toLowerCase();

    // Check if current user has submitted an answer
    const currentUserAnswers = users.map((user, i) => {
      if (user === address) return answers[i];
    });

    // If the user has answers, check if one of them is the winner
    const votedForCorrectQuestion =
      currentUserAnswers.some(answer => {
        if (answer) {
          return BigNumber.from(answer).eq(bestAnswer);
        }
      }) && isFinalized;

    // If user has balance in the contract, he should be able to withdraw
    const hasBalance = !userBalance.eq(0) && isFinalized;

    // Remove the first history and add an empty one
    // More info: https://github.com/realitio/realitio-contracts/blob/master/truffle/contracts/Realitio.sol#L502
    historyHashes.shift();
    const firstHash =
      '0x0000000000000000000000000000000000000000000000000000000000000000' as unknown;
    historyHashes.push(firstHash as Result);

    return {
      tokenSymbol: token.symbol,
      tokenDecimals: token.decimals,
      canClaim: (!alreadyClaimed && votedForCorrectQuestion) || hasBalance,
      data: {
        length: [bonds.length.toString()],
        historyHashes,
        users,
        bonds,
        answers
      }
    };
  }

  async *claimBond(
    web3: any,
    oracleAddress: string,
    questionId: string,
    claimParams: [string[], string[], number[], string[]]
  ) {
    const currentHistoryHash = await snapshot.utils.call(web3, ORACLE_ABI, [
      oracleAddress,
      'getHistoryHash',
      [questionId]
    ]);

    if (BigNumber.from(currentHistoryHash).eq(0)) {
      const withdrawTx = await snapshot.utils.sendTransaction(
        web3,
        oracleAddress,
        ORACLE_ABI,
        'withdraw',
        []
      );
      yield withdrawTx;
      const withdrawReceipt = await withdrawTx.wait();
      console.log('[Realitio] executed withdraw:', withdrawReceipt);
      return;
    }

    const tx = await snapshot.utils.sendTransaction(
      web3,
      oracleAddress,
      ORACLE_ABI,
      'claimMultipleAndWithdrawBalance',
      [[questionId], ...claimParams]
    );
    yield tx;
    const receipt = await tx.wait();
    console.log(
      '[Realitio] executed claimMultipleAndWithdrawBalance:',
      receipt
    );
  }

  async *executeProposalWithHashes(
    web3: any,
    moduleAddress: string,
    proposalId: string,
    txHashes: string[],
    moduleTx: SafeTransaction,
    transactionIndex: number
  ) {
    const tx = await snapshot.utils.sendTransaction(
      web3,
      moduleAddress,
      REALITY_MODULE_ABI,
      'executeProposalWithIndex',
      [
        proposalId,
        txHashes,
        moduleTx.to,
        moduleTx.value,
        moduleTx.data || '0x',
        moduleTx.operation,
        transactionIndex
      ]
    );
    yield tx;
    const receipt = await tx.wait();
    console.log('[DAO module] executed proposal:', receipt);
  }

  async *executeProposalUma(
    web3: any,
    moduleAddress: string,
    transactions: any
  ) {
    const tx = await snapshot.utils.sendTransaction(
      web3,
      moduleAddress,
      UMA_MODULE_ABI,
      'executeProposal',
      [transactions]
    );
    yield tx;
    const receipt = await tx.wait();
    console.log('[DAO module] executed proposal:', receipt);
  }

  async *voteForQuestion(
    network: string,
    web3: any,
    oracleAddress: string,
    questionId: string,
    minimumBondInDaoModule: string,
    answer: '1' | '0'
  ) {
    const currentBond = await snapshot.utils.call(web3, ORACLE_ABI, [
      oracleAddress,
      'getBond',
      [questionId]
    ]);

    let bond;
    let methodName;
    const txOverrides = {};
    let parameters = [
      questionId,
      `0x000000000000000000000000000000000000000000000000000000000000000${answer}`
    ];

    const currentBondIsZero = currentBond.eq(BigNumber.from(0));
    if (currentBondIsZero) {
      // DaoModules can have 0 minimumBond, if it happens, the initial bond will be 1 token
      const daoBondIsZero = BigNumber.from(minimumBondInDaoModule).eq(0);
      bond = daoBondIsZero ? BigNumber.from(10) : minimumBondInDaoModule;
    } else {
      bond = currentBond.mul(2);
    }

    // fetch token attribute from Realitio contract, if it works, it means it is
    // a RealitioERC20, otherwise the catch will handle the currency as ETH
    try {
      const account = (await web3.listAccounts())[0];
      const token = await snapshot.utils.call(web3, ORACLE_ABI, [
        oracleAddress,
        'token',
        []
      ]);
      const [[tokenDecimals], [allowance]] = await snapshot.utils.multicall(
        network,
        web3,
        ERC20_ABI,
        [
          [token, 'decimals', []],
          [token, 'allowance', [account, oracleAddress]]
        ]
      );

      if (bond.eq(10)) {
        bond = bond.pow(tokenDecimals);
      }

      // Check if contract has allowance on user tokens,
      // if not, trigger approve method
      if (allowance.lt(bond)) {
        const approveTx = await snapshot.utils.sendTransaction(
          web3,
          token,
          ERC20_ABI,
          'approve',
          [oracleAddress, bond],
          {}
        );
        yield 'erc20-approval';
        const approvalReceipt = await approveTx.wait();
        console.log('[DAO module] token transfer approved:', approvalReceipt);
        yield;
      }
      parameters = [...parameters, bond, bond];
      methodName = 'submitAnswerERC20';
    } catch (e) {
      if (bond.eq(10)) {
        bond = bond.pow(18);
      }
      parameters = [...parameters, bond];
      txOverrides['value'] = bond.toString();
      methodName = 'submitAnswer';
    }

    const tx = await snapshot.utils.sendTransaction(
      web3,
      oracleAddress,
      ORACLE_ABI,
      methodName,
      parameters,
      txOverrides
    );
    yield tx;
    const receipt = await tx.wait();
    console.log('[DAO module] executed vote on oracle:', receipt);
  }
}
