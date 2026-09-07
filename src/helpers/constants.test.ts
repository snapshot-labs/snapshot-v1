import { describe, expect, it } from 'vitest';
import { PROVIDER_OPTIONS } from '@/helpers/constants';
import connectors from '@/helpers/connectors';
import getProvider from '@snapshot-labs/snapshot.js/src/utils/provider';
import { getViemClient } from '@snapshot-labs/snapshot.js/src/utils/viem';

describe('brovider client tag', () => {
  it('snapshot.js providers carry ?client=v1', () => {
    const url = 'https://rpc.snapshot.org/1?client=v1';
    expect((getProvider('1', PROVIDER_OPTIONS) as any).connection.url).toBe(
      url
    );
    expect((getViemClient('1', PROVIDER_OPTIONS) as any).transport.url).toBe(
      url
    );
  });

  it('WalletConnect rpcMap carries ?client=v1', () => {
    Object.values(connectors.walletconnect.options.rpcMap).forEach(u =>
      expect(u).toMatch(/\?client=v1$/)
    );
  });
});
