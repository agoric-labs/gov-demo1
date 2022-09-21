/* global document, fetch, keplr */
import { makeUI, setupTabs } from './ui.js';
import { main } from './main.js';

console.log('hi from index.js');

const ui = makeUI(document);
setupTabs(ui);
main(ui, { fetch: (...args) => fetch(...args), kelpr })
  .then(() => console.log('ready.'))
  .catch(err => console.error('main:', err));
