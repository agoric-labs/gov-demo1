// @ts-check

import { handleParamGovernance, ParamType } from '@agoric/governance';

const COLLATERAL = 'Collateral';

/** @type {ParameterNameList} */
const governedParameterTerms = {
  main: [COLLATERAL],
};

/** @type {(b: Brand) => ParamDescriptions} */
const makeInitialValues = (brand) => {
  assert(brand, 'no brand???');
  return harden([
    {
      name: COLLATERAL,
      value: brand,
      type: ParamType.BRAND,
    },
  ]);
};
harden(makeInitialValues);

/** @type {ContractStartFn} */
const start = async (zcf) => {
  const { initialBrand } = zcf.getTerms();
  assert(initialBrand, 'no initialBrand???');

  const { makePublicFacet, makeCreatorFacet } = handleParamGovernance(
    zcf,
    makeInitialValues(initialBrand),
  );

  return {
    publicFacet: makePublicFacet({}),
    creatorFacet: makeCreatorFacet({}),
  };
};

harden(start);
harden(COLLATERAL);
harden(governedParameterTerms);

export { start, governedParameterTerms, COLLATERAL, makeInitialValues };
