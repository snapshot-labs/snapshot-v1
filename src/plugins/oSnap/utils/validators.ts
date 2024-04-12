import { isAddress } from '@ethersproject/address';
import {
  JsonRpcProvider,
  StaticJsonRpcProvider
} from '@ethersproject/providers';
import memoize from 'lodash/memoize';
import { Contract } from '@ethersproject/contracts';
import { isBigNumberish } from '@ethersproject/bignumber/lib/bignumber';
import { isBytesLike, isHexString } from '@ethersproject/bytes';
import getProvider from '@snapshot-labs/snapshot.js/src/utils/provider';
import { OPTIMISTIC_GOVERNOR_ABI } from '../constants';
import { BaseTransaction, NFT, Token, Transaction, GnosisSafe } from '../types';
import { parseUnits } from '@ethersproject/units';
import { useMemoize } from '@vueuse/core';

/**
 * Validates that the given `address` is a valid Ethereum address
 */
export const mustBeEthereumAddress = memoize((address: string) => {
  const startsWith0x = address?.startsWith('0x');
  const isValidAddress = isAddress(address);
  return startsWith0x && isValidAddress;
});

/**
 * Validates that the given `address` is a valid Ethereum contract address
 */
export const mustBeEthereumContractAddress = memoize(
  async (network: string, address: string) => {
    const provider = getProvider(network) as JsonRpcProvider;
    const contractCode = await provider.getCode(address);

    return (
      contractCode && contractCode.replace(/^0x/, '').replace(/0/g, '') !== ''
    );
  },
  (url, contractAddress) => `${url}_${contractAddress}`
);

/**
 * Validates a transaction.
 */
export function validateTransaction(transaction: BaseTransaction) {
  const addressNotEmptyOrInvalid =
    transaction.to !== '' && isAddress(transaction.to);
  const isBN = isBigNumberish(transaction.value);
  return (
    isBN &&
    addressNotEmptyOrInvalid &&
    (!transaction.data || isHexString(transaction.data))
  );
}

/**
 * Validates a module address.
 */
export async function validateModuleAddress(
  network: string,
  moduleAddress: string
): Promise<boolean> {
  if (!isAddress(moduleAddress)) return false;
  const provider: StaticJsonRpcProvider = getProvider(network);
  const moduleContract = new Contract(
    moduleAddress,
    OPTIMISTIC_GOVERNOR_ABI,
    provider
  );

  return moduleContract
    .rules()
    .then(() => true)
    .catch(() => false);
}

export function isTransferFundsValid(params: {
  token: Token;
  recipient: string;
  amount: string;
}): boolean {
  if (!amountPositive(params.amount, params.token.decimals)) {
    return false;
  }
  if (!params.recipient || !isAddress(params.recipient)) {
    return false;
  }
  if (!(params.token.address === 'main') && !isAddress(params.token.address)) {
    return false;
  }

  return true;
}

export function isTransferNftValid(params: {
  collectable: NFT | undefined;
  recipient: string;
}): boolean {
  // check NFT transfer variables are correct
  if (!params.collectable) {
    return false;
  }
  if (
    !isAddress(params.recipient) ||
    !isAddress(params.collectable.address) ||
    !params.collectable.id
  ) {
    return false;
  }

  return true;
}

export function amountPositive(amount: string, decimals = 18) {
  try {
    const isBigNumber = isBigNumberish(parseUnits(amount, decimals)); // checks for underflow
    const isPositive = parseFloat(amount) > 0;
    return isBigNumber && isPositive;
  } catch {
    return false;
  }
}

export function isBytesLikeSafe(value: string): boolean {
  try {
    return isBytesLike(value);
  } catch {
    return false;
  }
}

export function allTransactionsValid(transactions: Transaction[]): boolean {
  return transactions.every(tx => tx.isValid === true);
}

export async function isContractAddress(
  address: string,
  network: string
): Promise<boolean> {
  const provider = getProvider(network);
  const code = await provider.getCode(address);
  return code !== '0x' && code !== '0x0';
}

export const checkIsContract = useMemoize(
  async (address: string, network: string) =>
    await isContractAddress(address, network)
);

// check if json is a safe json type
export const isSafeFile = (input: any): input is GnosisSafe.BatchFile => {
  const $io0 = (input: any): boolean =>
    'string' === typeof input.version &&
    'string' === typeof input.chainId &&
    'number' === typeof input.createdAt &&
    'object' === typeof input.meta &&
    null !== input.meta &&
    $io1(input.meta) &&
    Array.isArray(input.transactions) &&
    input.transactions.every(
      (elem: any) => 'object' === typeof elem && null !== elem && $io2(elem)
    );
  const $io1 = (input: any): boolean =>
    (null === input.txBuilderVersion ||
      undefined === input.txBuilderVersion ||
      'string' === typeof input.txBuilderVersion) &&
    (null === input.checksum ||
      undefined === input.checksum ||
      'string' === typeof input.checksum) &&
    (null === input.createdFromSafeAddress ||
      undefined === input.createdFromSafeAddress ||
      'string' === typeof input.createdFromSafeAddress) &&
    (null === input.createdFromOwnerAddress ||
      undefined === input.createdFromOwnerAddress ||
      'string' === typeof input.createdFromOwnerAddress) &&
    'string' === typeof input.name &&
    (null === input.description ||
      undefined === input.description ||
      'string' === typeof input.description);
  const $io2 = (input: any): boolean =>
    'string' === typeof input.to &&
    'string' === typeof input.value &&
    (null === input.data ||
      undefined === input.data ||
      'string' === typeof input.data) &&
    (null === input.contractMethod ||
      undefined === input.contractMethod ||
      ('object' === typeof input.contractMethod &&
        null !== input.contractMethod &&
        $io3(input.contractMethod))) &&
    (null === input.contractInputsValues ||
      undefined === input.contractInputsValues ||
      ('object' === typeof input.contractInputsValues &&
        null !== input.contractInputsValues &&
        false === Array.isArray(input.contractInputsValues) &&
        $io5(input.contractInputsValues)));
  const $io3 = (input: any): boolean =>
    Array.isArray(input.inputs) &&
    input.inputs.every(
      (elem: any) => 'object' === typeof elem && null !== elem && $io4(elem)
    ) &&
    'string' === typeof input.name &&
    'boolean' === typeof input.payable;
  const $io4 = (input: any): boolean =>
    (undefined === input.internalType ||
      'string' === typeof input.internalType) &&
    'string' === typeof input.name &&
    'string' === typeof input.type &&
    (null === input.components ||
      undefined === input.components ||
      (Array.isArray(input.components) &&
        input.components.every(
          (elem: any) => 'object' === typeof elem && null !== elem && $io4(elem)
        )));
  const $io5 = (input: any): boolean =>
    Object.keys(input).every((key: any) => {
      const value = input[key];
      if (undefined === value) return true;
      return 'string' === typeof value;
    });
  return 'object' === typeof input && null !== input && $io0(input);
};
