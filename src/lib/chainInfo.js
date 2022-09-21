// @ts-check

export const AGORIC_COIN_TYPE = 564;
export const COSMOS_COIN_TYPE = 118;

/** @type {import('@keplr-wallet/types').Currency} */
export const stakeCurrency = {
  coinDenom: 'BLD',
  coinMinimalDenom: 'ubld',
  coinDecimals: 6,
  coinGeckoId: undefined,
};
/** @type {import('@keplr-wallet/types').Currency} */
export const stableCurrency = {
  coinDenom: 'IST',
  coinMinimalDenom: 'uist',
  coinDecimals: 6,
  coinGeckoId: undefined,
};

/** @type {import('@keplr-wallet/types').Bech32Config} */
export const bech32Config = {
  bech32PrefixAccAddr: 'agoric',
  bech32PrefixAccPub: 'agoricpub',
  bech32PrefixValAddr: 'agoricvaloper',
  bech32PrefixValPub: 'agoricvaloperpub',
  bech32PrefixConsAddr: 'agoricvalcons',
  bech32PrefixConsPub: 'agoricvalconspub',
};

/**
 * @param {string} networkConfig URL
 * @param {string} rpcAddr URL or origin
 * @param {string} chainId
 * @param {string} [caption]
 * @returns {import('@keplr-wallet/types').ChainInfo}
 */
export const makeChainInfo = (networkConfig, rpcAddr, chainId, caption) => {
  const coinType = Number(
    new URL(networkConfig).searchParams.get('coinType') || AGORIC_COIN_TYPE,
  );
  const hostname = new URL(networkConfig).hostname;
  const network = hostname.split('.')[0];
  let rpc;
  let api;

  if (network !== hostname) {
    rpc = `https://${network}.rpc.agoric.net`;
    api = `https://${network}.api.agoric.net`;
  } else {
    rpc = rpcAddr.match(/:\/\//) ? rpcAddr : `http://${rpcAddr}`;
    api = rpc.replace(/(:\d+)?$/, ':1317');
  }

  return {
    rpc,
    rest: api,
    chainId,
    chainName: caption || `Agoric ${network}`,
    stakeCurrency,
    walletUrlForStaking: `https://${network}.staking.agoric.app`,
    bip44: {
      coinType,
    },
    bech32Config,
    currencies: [stakeCurrency, stableCurrency],
    feeCurrencies: [stableCurrency],
    features: ['stargate', 'ibc-transfer'],
    // gasPriceStep is no more?
  };
};
