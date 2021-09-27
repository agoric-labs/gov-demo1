# Agoric Governance Demo

_context: [Internal Governance Demo #3869](https://github.com/Agoric/agoric-sdk/issues/3869)_

**Feeling lucky?** Try it at https://gov-demo-ag-2.netlify.app/ along with a [devnet client / wallet](https://github.com/Agoric/agoric-sdk/wiki/Setting-up-an-Agoric-Dapp-Client-with-docker-compose).

![image](https://user-images.githubusercontent.com/150986/134783403-d213ed12-cbc3-4ffe-85f6-719758c571a6.png)

## Usage: Creator, Registrar, Voter

As explained in the [governance package docs](https://github.com/Agoric/agoric-sdk/tree/contractGovernanceMgr-3185/packages/governance#governance):

> Any occasion of governance starts with the creation of a Registrar.

On the **Committee Creator** tab, you'll see the **Registrar Installation boardID** defaults to 495234043.
The committee registrar contract (from the `contractGovernanceMgr-3185` branch) is installed under that board id
on devnet, which means anyone can create a committee.

Then share the resulting invitations (by their board id, for now) with the voters (or use them yourself).

Creating a committee fills in the **Registrar Creator Facet boardID** on the **Committee Registrar** tab. So you have the power to create questions, or you may delegate that power to others.

On the **Committee Member** tab, you can claim a voter invitation. This subscribes you to questions as they are created. Choose your position and vote. Claiming a voter invitation also subscribes you to the outcomes of questions, which are displayed shortly after their deadlines pass.

## TODO

 - route invitations via depositfacets. But how then how does the app get the offer result, i.e. the voting right?
