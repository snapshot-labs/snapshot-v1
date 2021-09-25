import namehash from 'eth-ens-namehash';
import getProvider, {
  getBatchedProvider
} from '@snapshot-labs/snapshot.js/src/utils/provider';
import { subgraphRequest, call } from '@snapshot-labs/snapshot.js/src/utils';
import zipObject from 'lodash/zipObject';

function get3BoxProfiles(addresses) {
  return new Promise((resolove, reject) => {
    subgraphRequest('https://api.3box.io/graph', {
      profiles: {
        __args: {
          ids: addresses
        },
        name: true,
        eth_address: true,
        image: true
      }
    })
      .then(({ profiles }) => {
        const _3BoxProfiles = {};
        profiles.forEach(profile => {
          _3BoxProfiles[profile.eth_address.toLowerCase()] = profile;
        });
        resolove(_3BoxProfiles);
      })
      .catch(error => {
        reject(error);
      });
  });
}

function ensReverseRecordRequest(addresses) {
  const network = '1';
  const provider = getProvider(network);
  const abi = [
    {
      inputs: [
        { internalType: 'address[]', name: 'addresses', type: 'address[]' }
      ],
      name: 'getNames',
      outputs: [{ internalType: 'string[]', name: 'r', type: 'string[]' }],
      stateMutability: 'view',
      type: 'function'
    }
  ];
  return call(
    provider,
    abi,
    ['0x3671aE578E63FdF66ad4F3E12CC0c0d71Ac7510C', 'getNames', [addresses]],
    { blockTag: 'latest' }
  );
}

function lookupAddresses(addresses) {
  return new Promise((resolove, reject) => {
    ensReverseRecordRequest(addresses)
      .then(reverseRecords => {
        const validNames = reverseRecords.map(n =>
          namehash.normalize(n) === n ? n : ''
        );
        const ensNames = Object.fromEntries(
          addresses.map((address, index) => {
            return [address.toLowerCase(), validNames[index]];
          })
        );

        resolove(ensNames);
      })
      .catch(error => {
        reject(error);
      });
  });
}

async function getENSAvatars(ensNames: string[], provider) {
  const avatars = await Promise.all(
    ensNames.map(ens => {
      if (ens) {
        return provider.getResolver(ens).then(resolver => {
          return resolver?.getText('avatar').then(avatar => {
            if (avatar && avatar.length > 0) {
              return avatar;
            }
            return '';
          });
        });
      }
      return '';
    })
  );

  return zipObject(ensNames, avatars);
}

export async function getProfiles(addresses) {
  addresses = addresses.slice(0, 1000);
  let ensNames: any = {};
  let _3BoxProfiles: any = {};
  let ensAvatars: any = {};
  const provider = getBatchedProvider('1');
  try {
    [ensNames, _3BoxProfiles] = await Promise.all([
      lookupAddresses(addresses),
      get3BoxProfiles(addresses)
    ]);
    ensAvatars = await getENSAvatars(Object.values(ensNames), provider);
  } catch (e) {
    console.log(e);
  }

  const profiles = Object.fromEntries(addresses.map(address => [address, {}]));
  return Object.fromEntries(
    await Promise.all(
      Object.entries(profiles).map(async ([address, profile]) => {
        profile = _3BoxProfiles[address.toLowerCase()] || {};
        profile.ens = ensNames[address.toLowerCase()] || '';
        if (profile.ens) {
          const ensAvatar = ensAvatars[profile.ens];
          if (ensAvatar?.length > 0) {
            profile.image = ensAvatar;
          }
        }
        return [address, profile];
      })
    )
  );
}
