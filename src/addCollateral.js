// @ts-check

// Agoric Treasury add collateral deployment script

import { E } from '@agoric/eventual-send';
import '@agoric/zoe/exported.js';

import { makeRatio } from '@agoric/zoe/src/contractSupport/index.js';
import { AmountMath, AssetKind } from '@agoric/ertp';

// addCollateral.js runs in an ephemeral Node.js outside of swingset. The
// spawner runs within ag-solo, so is persistent.  Once the deploy.js
// script ends, connections to any of its objects are severed.

/**
 * @typedef {Object} Board
 * @property {(id: string) => any} getValue
 * @property {(value: any) => string} getId
 * @property {(value: any) => boolean} has
 * @property {() => [string]} ids
 */

const BASIS_POINTS_DENOM = 10000n;

/**
 * @typedef {{ zoe: ZoeService, board: Board, spawner, wallet, uploads, http }} Home
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

  // const issuerPetname = 'USDC';
  // const brandDecimalPlaces = 18n;
  const issuerPetname = 'ATOM';
  const brandDecimalPlaces = 2n;

  console.log(`Retrieving issuers for ${issuerPetname} and brands`);
  // const issuer = await E(board).getValue('');
  const walletAdmin = E(wallet).getAdminFacet();

  const issuerP = E(walletAdmin).getIssuer(issuerPetname);
  const feeIssuerP = E(zoe).getFeeIssuer();
  const [
    govBrand,
    feeBrand,
    issuer,
    brand,
    purses,
    ammInstance,
  ] = await Promise.all([
    E(agoricNames).lookup('brand', 'TreasuryGovernance'),
    E(feeIssuerP).getBrand(),
    issuerP,
    E(issuerP).getBrand(),
    E(walletAdmin).getPurses(),
    E(agoricNames).lookup('instance', 'autoswap'),
  ]);

  const ammPublicFacetP = E(zoe).getPublicFacet(ammInstance);

  const rates = {
    initialPrice: makeRatio(
      34_610_000n,
      feeBrand,
      10n ** brandDecimalPlaces,
      brand,
    ),
    initialMargin: makeRatio(150n, feeBrand),
    liquidationMargin: makeRatio(125n, feeBrand),
    interestRate: makeRatio(250n, feeBrand, BASIS_POINTS_DENOM),
    loanFee: makeRatio(1n, feeBrand, BASIS_POINTS_DENOM),
  };

  let payment = await E(scratch).get('collateralPayment');
  if (!payment) {
    // Withdraw payment.
    const purseBrands = await Promise.all(
      purses.map(([_name, p]) => E(p).getAllegedBrand()),
    );
    console.log(purseBrands, purses);
    const [purseName, purse] = purses.find((_, i) => purseBrands[i] === brand);
    console.log('Withdrawing from', purseName);
    const { value } = await E(purse).getCurrentAmount(purse);
    payment = await E(purse).withdraw(AmountMath.make(brand, value / 2n));
    await E(scratch).set('collateralPayment', payment);
  }

  const amount = await E(issuer).getAmountOf(payment);

  const proposal = harden({
    give: {
      Collateral: amount,
    },
    want: {
      // We just throw away our governance tokens.
      Governance: AmountMath.makeEmpty(govBrand, AssetKind.NAT),
    },
  });
  const paymentKeywords = harden({
    Collateral: payment,
  });

  const addTypeInvitation = await E(treasuryCreator).makeAddTypeInvitation(
    issuer,
    `Peg${issuerPetname}`,
    rates,
  );
  const seat = E(zoe).offer(addTypeInvitation, proposal, paymentKeywords);

  // const payout = await E(seat).getPayout('Collateral');
  // await E(scratch).set('collateralPayout', payout);
  await E(seat).getOfferResult();

  console.log('Registering AMM-based price authorities');
  const { toCentral, fromCentral } = await E(
    ammPublicFacetP,
  ).getPriceAuthorities(brand);
  const [paToCentral, paFromCentral] = await Promise.all([
    toCentral,
    fromCentral,
  ]);
  await Promise.all([
    E(priceAuthorityAdmin).registerPriceAuthority(paToCentral, brand, feeBrand),
    E(priceAuthorityAdmin).registerPriceAuthority(
      paFromCentral,
      feeBrand,
      brand,
    ),
  ]);
}
