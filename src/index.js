/* global document, window */
import { makeUI, setupTabs } from './ui.js';
import { main } from './main.js';

console.log('hi from index.js');

const ui = makeUI(document);
setupTabs(ui);
main(ui, { fetch: (...args) => window.fetch(...args), kelpr: window.keplr })
  .then(() => console.log('ready.'))
  .catch(err => console.error('main:', err));
