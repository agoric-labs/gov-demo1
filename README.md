
## Dependencies: `contractGovernanceMgr-3185`

 - Check out the `contractGovernanceMgr-3185` (or maybe `manageTreasury-3189`?) branch and do `yarn link` in `packages/governance`

Then in your clone of this repo:

```
yarn
yarn link @agoric/governance
yarn start
```

Oh... and you'll want your wallet started. Preferably on devnet.

Then to get the contract bundles installed, `yarn loadgen` in my (un-pushed?) branch of `testnet-load-generator`.

Then use the REPL to `E(home.board).getId(...)` board ids for various things that this UI asks for.

## Usage

 1. create a registrar
 2. add a question
 3. vote

In the voting section at the top, in order to get subscribed to new questions, you may need to wiggle the **Registrar Public Facet boardID** value; e.g. add a space and then delete it.
