// @ts-check

// Agoric Treasury add collateral deployment script

import { E } from '@endo/eventual-send';
import '@agoric/zoe/exported.js';

import { makeRatio } from '@agoric/zoe/src/contractSupport/index.js';
import { AmountMath } from '@agoric/ertp';

/**
 * @typedef { import('@agoric/eventual-send').ERef<T> } ERef<T>
 * @template T
 */

import '@agoric/ertp/exported.js';

// addCollateral.js runs in an ephemeral Node.js outside of swingset. The
// spawner runs within ag-solo, so is persistent.  Once the deploy.js
// script ends, connections to any of its objects are severed.

const { details: X } = assert;

const BASIS_POINTS_DENOM = 10000n;

const makeMemo = (scratch) => {
  /**
   * @param {string} key
   * @param {() => Promise<T>} thunk
   * @returns {Promise<T>}
   * @template T
   */
  const memo = async (key, thunk) => {
    const found = await E(scratch).get(key);
    if (found) {
      return found;
    }
    const value = await thunk();
    await E(scratch).set(key, value);
    return value;
  };
  return memo;
};

/**
 * @param {*} walletAdmin
 * @param {Petname} petname
 * @param {bigint} denom
 * @typedef { string | string[] } Petname
 */
const withdrawPart = async (walletAdmin, petname, denom) => {
  /** @type { Promise<Issuer> } */
  const issuerP = E(walletAdmin).getIssuer(petname);
  const [issuer, brand] = await Promise.all([issuerP, E(issuerP).getBrand()]);

  /** @type {[string, Purse][]} */
  const purses = await E(walletAdmin).getPurses();

  const purseBrands = await Promise.all(
    purses.map(([_name, p]) => E(p).getAllegedBrand()),
  );
  console.log(purseBrands, purses);

  const [purseName, purse] =
    purses.find((_, i) => purseBrands[i] === brand) ||
    assert.fail(X`no purse with brand ${brand}`);

  console.log('Withdrawing from', purseName);
  const { value } = await E(purse).getCurrentAmount();
  assert.typeof(value, 'bigint');
  const payment = E(purse).withdraw(AmountMath.make(brand, value / denom));

  return { payment, issuer, brand };
};

/**
 * @param {string} issuerPetname
 * @param {bigint} brandDecimalPlaces
 * @param {Issuer} issuer
 * @param {ERef<Payment>} collateral
 * @param {Brand} brand
 * @param {{ central: Brand, gov: Brand}} brands
 * @param {{ zoe: ERef<ZoeService>, treasuryCreator: any }} powers
 */
const addCollateralType = async (
  issuerPetname,
  brandDecimalPlaces,
  issuer,
  collateral,
  brand,
  { central, gov },
  { zoe, treasuryCreator },
) => {
  const amount = await E(issuer).getAmountOf(collateral);

  const rates = {
    initialPrice: makeRatio(
      34_610_000n,
      central,
      10n ** brandDecimalPlaces,
      brand,
    ),
    initialMargin: makeRatio(150n, central),
    liquidationMargin: makeRatio(125n, central),
    interestRate: makeRatio(250n, central, BASIS_POINTS_DENOM),
    loanFee: makeRatio(1n, central, BASIS_POINTS_DENOM),
  };

  const addTypeInvitation = await E(treasuryCreator).makeAddTypeInvitation(
    issuer,
    `Peg${issuerPetname}`,
    rates,
  );

  const seat = E(zoe).offer(
    addTypeInvitation,
    harden({
      give: {
        Collateral: amount,
      },
      want: {
        // We just throw away our governance tokens.
        Governance: AmountMath.makeEmpty(gov),
      },
    }),
    harden({
      Collateral: collateral,
    }),
  );

  // const payout = await E(seat).getPayout('Collateral');
  // await E(scratch).set('collateralPayout', payout);
  await E(seat).getOfferResult();
};

/**
 * @param {ERef<ZoeService>} zoe
 * @param {*} agoricNames
 * @param {Brand} brand
 * @param {Brand} centralBrand
 * @param {*} priceAuthorityAdmin
 */
const registerPriceAuthorities = async (
  zoe,
  agoricNames,
  brand,
  centralBrand,
  priceAuthorityAdmin,
) => {
  const ammInstance = await E(agoricNames).lookup('instance', 'autoswap');
  const ammPublicFacetP = E(zoe).getPublicFacet(ammInstance);

  console.log('Registering AMM-based price authorities');
  const { toCentral, fromCentral } = await E(
    ammPublicFacetP,
  ).getPriceAuthorities(brand);
  const [paToCentral, paFromCentral] = await Promise.all([
    toCentral,
    fromCentral,
  ]);
  await Promise.all([
    E(priceAuthorityAdmin).registerPriceAuthority(
      paToCentral,
      brand,
      centralBrand,
    ),
    E(priceAuthorityAdmin).registerPriceAuthority(
      paFromCentral,
      centralBrand,
      brand,
    ),
  ]);
};

/**
 * @typedef {{ zoe: ZoeService, agoricNames, wallet, scratch, treasuryCreator, priceAuthorityAdmin}} Home
 * @param {Promise<Home>} homePromise
 * A promise for the references available from REPL home
 */
export default async function deployApi(homePromise) {
  // Let's wait for the promise to resolve.
  const home = await homePromise;

  // Unpack the references.
  const {
    // *** LOCAL REFERENCES ***

    // *** ON-CHAIN REFERENCES ***
    agoricNames,
    zoe,

    // This is a scratch pad specific to the current ag-solo and inaccessible
    // from the chain.
    scratch,

    treasuryCreator,
    priceAuthorityAdmin,

    wallet,
  } = home;

  const issuerPetname = 'FungibleFaucet.Token'.split('.');
  const brandDecimalPlaces = 2n;

  const feeIssuerP = E(zoe).getFeeIssuer();
  const memo = makeMemo(scratch);

  const [{ payment: collateral, issuer, brand }, govBrand, centralBrand] =
    await Promise.all([
      memo('collateralPayment', async () =>
        withdrawPart(E(wallet).getAdminFacet(), issuerPetname, 2n),
      ),
      E(agoricNames).lookup('brand', 'TreasuryGovernance'),
      E(feeIssuerP).getBrand(),
    ]);

  await addCollateralType(
    typeof issuerPetname === 'string' ? issuerPetname : issuerPetname.join(''),
    brandDecimalPlaces,
    issuer,
    collateral,
    brand,
    { central: centralBrand, gov: govBrand },
    { zoe, treasuryCreator },
  );

  await registerPriceAuthorities(
    zoe,
    agoricNames,
    brand,
    centralBrand,
    priceAuthorityAdmin,
  );
}
