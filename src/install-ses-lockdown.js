// cribbed from https://github.com/Agoric/agoric-sdk/tree/master/packages/wallet-connection#setup
import 'ses'; // adds lockdown, harden, and Compartment
import '@agoric/eventual-send/shim.js'; // adds support needed by E

// Help lock down the JS environment.  The start compartment (current evaluation context)
// can still access powerful globals, but this start compartment can use `new Compartment(...)`
// to evaluate code with stricter confinement.
lockdown({
  errorTaming: 'unsafe',
  overrideTaming: 'severe',
});

Error.stackTraceLimit = Infinity;
