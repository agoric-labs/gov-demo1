/* global document, window */
// @ts-check
import { makeUI, setupTabs } from './ui.js';
import { main } from './main.js';

console.log('hi from index.js');

// keplr might not be available until DOM content is loaded
window.addEventListener('DOMContentLoaded', _event => {
  // @ts-expect-error window keys
  const { keplr } = window;
  console.log({ keplr });
  if (!keplr) {
    // eslint-disable-next-line no-alert
    window.alert('please install keplr extension');
    return;
  }
  const ui = makeUI(document);
  setupTabs(ui);
  main(ui, { fetch: (...args) => window.fetch(...args), keplr })
    .then(() => console.log('ready.'))
    .catch(err => console.error('main:', err));
});
