// @ts-check
import { E } from '@agoric/eventual-send';
import { resolve as importMetaResolve } from 'import-meta-resolve';
import { AmountMath } from '@agoric/ertp';

import '@agoric/zoe/exported.js';

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
const stringifyNat = (natValue = null, decimalPlaces = 0, placesToShow = 2) => {
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

  console.log('purses:', await E(wallet).getPurses());

  const runPurse = E(wallet).getPurse(pursePetnames.RUN);

  console.error(`allocateFees: getCurrentAmount`);
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
  const feePurse = E(faucet).getFeePurse(); // faucet? why?
  const feePayment = await E(runPurse).withdraw(someRun);
  await E(feePurse).deposit(feePayment);
  return E(feePurse).getCurrentAmount();
}

/**
 * @param {ERef<Home>} homeP
 * @param {{ bundleSource: (path: string) => Promise<Bundle> }} deployPowers
 * @typedef {{
 *   chainTimerService: ERef<Timer>,
 *   scratch: ERef<Store>,
 *   zoe: ERef<ZoeService>,
 *   faucet: Faucet,
 *   wallet: UserWallet,
 *   board: ERef<Board>,
 * }} Home
 * @typedef {{ get: (key: unknown) => any, set: (k: unknown, v: unknown) => void }} Store
 * @typedef { * } UserWallet TODO: see @agoric/dapp-svelte-wallet-api
 * @typedef { * } Faucet TODO: ???
 * @typedef {{ getId: (value: unknown) => Promise<string> }} Board
 */
export default async function deploy(homeP, { bundleSource }) {
  const home = await homeP;
  await allocateFees(home);

  const { board, zoe } = home;

  /** @param { string } specifier */
  const bundle = (specifier) =>
    importMetaResolve(specifier, import.meta.url).then((url) =>
      bundleSource(new URL(url).pathname),
    );
  const bundles = await allValues({
    committee: bundle(`@agoric/governance/src/committee.js`),

    binaryVoteCounter: bundle(`@agoric/governance/src/binaryVoteCounter.js`),
    contractGovernor: bundle(`@agoric/governance/src/contractGovernor.js`),
  });

  const installations = await allValues(
    mapValues(bundles, (b) => E(zoe).install(b)),
  );

  const boardIds = await allValues(
    mapValues(installations, (inst) => E(board).getId(inst)),
  );

  console.log(boardIds);
}
