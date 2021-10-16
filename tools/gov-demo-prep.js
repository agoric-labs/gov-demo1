// @ts-check
import { E } from '@agoric/eventual-send';
import { resolve as importMetaResolve } from 'import-meta-resolve';
import { AmountMath } from '@agoric/ertp';
import { governedParameterTerms } from '@agoric/treasury/src/params.js';

import '@agoric/ertp/exported.js';
import '@agoric/zoe/exported.js';
import '@agoric/governance/exported.js';
import '@agoric/vats/exported.js';

const SECONDS_PER_HOUR = 60n * 60n;
const SECONDS_PER_DAY = 24n * SECONDS_PER_HOUR;

const DEFAULT_POOL_FEE = 24n;
const DEFAULT_PROTOCOL_FEE = 6n;

const pursePetnames = {
  RUN: 'Agoric RUN currency',
};

/**
 * @template T
 * @typedef { import('@agoric/eventual-send').ERef<T> } ERef<T>
 */

/**
 * @typedef {{ moduleFormat: unknown }} Bundle
 */

const { entries, fromEntries, keys, values } = Object;

/**
 * @param {X[]} xs
 * @param {Y[]} ys
 * @template X
 * @template Y
 * @returns {[X, Y][]}
 */
const zip = (xs, ys) => xs.map((x, i) => [x, ys[i]]);

/**
 * @param {Record<string, Promise<V>>} obj
 * @template V
 */
const allValues = async (obj) => {
  const data = await Promise.all(values(obj));
  return fromEntries(zip(keys(obj), data));
};

/**
 * @param {bigint} natValue
 * @param {number} [decimalPlaces]
 * @param {number} [placesToShow]
 * @returns {string}
 */
const stringifyNat = (natValue, decimalPlaces = 0, placesToShow = 2) => {
  const str = `${natValue}`.padStart(decimalPlaces, '0');
  const leftOfDecimalStr = str.substring(0, str.length - decimalPlaces) || '0';
  const strPadded = `${str.substring(str.length - decimalPlaces)}`.padEnd(
    decimalPlaces,
    '0',
  );
  const rightOfDecimalStr = strPadded.substring(0, placesToShow);

  if (rightOfDecimalStr === '') {
    return leftOfDecimalStr;
  }

  return `${leftOfDecimalStr}.${rightOfDecimalStr}`;
};

/**
 * @param {Record<string, T>} obj
 * @param {(x: T) => U} f
 * @template T
 * @template U
 */
const mapValues = (obj, f) =>
  fromEntries(entries(obj).map(([prop, val]) => [prop, f(val)]));

/**
 * @param {Home} home
 */
async function allocateFees(home) {
  const { faucet, wallet } = home;

  function disp(amount) {
    return stringifyNat(amount.value, 6, 6);
  }

  // console.log('purses:', await E(wallet).getPurses());
  /** @type { ERef<Purse> } */
  const feePurse = E(faucet).getFeePurse(); // faucet? why?
  console.log('await feesAvailable...');
  const feesAvailable = await E(feePurse).getCurrentAmount();
  console.log({ feesAvailable });
  if (feesAvailable.value > 10_000_000n) {
    return feesAvailable;
  }

  const runPurse = E(wallet).getPurse(pursePetnames.RUN);

  console.error(`allocateFees: getCurrentAmount`);
  console.log('await runPurse currentAmount...');
  const run = await E(runPurse).getCurrentAmount();
  if (AmountMath.isEmpty(run)) {
    throw Error(`no RUN, collect-votes cannot proceed`);
  }
  const someRun = AmountMath.make(run.brand, run.value / 3n);

  // TODO: change to the appropriate amounts
  // setup: transfer 33% of our initial RUN to the feePurse
  console.error(
    `collect-votes: depositing ${disp(someRun)} into the fee purse`,
  );
  const feePayment = await E(runPurse).withdraw(someRun);
  await E(feePurse).deposit(feePayment);
  return E(feePurse).getCurrentAmount();
}

/**
 * @param {ERef<ZoeService>} zoe
 * @param {Record<string, Installation>} installations
 * @param {Brand} brand
 */
const startElectorate = async (zoe, installations, brand) => {
  const electorateTerms = {
    committeeName: 'The Three Stooges',
    committeeSize: 3,
    brands: { Central: brand },
  };
  /** @type {{ creatorFacet: GovernedContractFacetAccess, instance: Instance }} */
  const { creatorFacet: electorateCreatorFacet, instance: electorateInstance } =
    await E(zoe).startInstance(installations.committee, {}, electorateTerms);
  return { electorateCreatorFacet, electorateInstance };
};

/**
 * @param {ERef<Home>} homeP
 * @param {{
 *   bundleSource: (path: string) => Promise<Bundle>,
 *   resolvePath: (ref: string) => string,
 * }} _deployPowers
 * @typedef {{
 *   chainTimerService: ERef<Timer>,
 *   scratch: ERef<Store>,
 *   zoe: ERef<ZoeService>,
 *   faucet: Faucet,
 *   wallet: UserWallet,
 *   board: ERef<Board>,
 *   agoricNames: ERef<NameHub>,
 *   priceAuthority: PriceAuthority,
 * }} Home
 * @typedef {{ get: (key: unknown) => any, set: (k: unknown, v: unknown) => void }} Store
 * @typedef { * } UserWallet TODO: see @agoric/dapp-svelte-wallet-api
 * @typedef { * } Faucet TODO: ???
 * @typedef {{ getId: (value: unknown) => Promise<string> }} Board
 */
export default async function deploy(homeP, _deployPowers) {
  const home = await homeP;
  await allocateFees(home);

  const { board, chainTimerService, agoricNames } = home;

  console.log('await get board Ids...');
  const boardIds = await allValues(
    mapValues({ agoricNames, chainTimerService }, (inst) =>
      E(board).getId(inst),
    ),
  );

  console.log(boardIds);
}
