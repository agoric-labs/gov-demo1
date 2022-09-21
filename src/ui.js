// @ts-check

const { entries } = Object;

/**
 * @param { Document } document
 * @returns { UI }
 * @typedef {{
 *   show: (sel: string) => void
 *   hide: (sel: string) => void
 *   setDisabled: (sel: string, state: boolean) => void
 *   onClick: (sel: string, l: EventListener) => void
 *   onBlur: (sel: string, l: EventListener) => void
 *   onChange: (sel: string, l: EventListener) => void
 *   onInput: (sel: string, l: EventListener) => void
 *   busy: (sel: string, thunk: () => Promise<void>) => Promise<void>
 *   getField: (sel: string) => string
 *   setField: (sel: string, value: string) => void
 *   setOptions: (sel: string, items: { value: string, label: string }[]) => void
 *   setRadioGroup: (sel: string, name: string, items: { value: string, label: string }[]) => void
 *   setItems: (sel: string, items: string[][]) => void
 * }} UI
 */
export const makeUI = document => {
  const theElt = s => document.querySelector(s) || assert.fail(s);
  const textNode = txt => document.createTextNode(txt);

  /**
   * @param {string} tag
   * @param {Record<string, string>} attrs
   * @param {Array<Node | string>=} children
   */
  const elt = (tag, attrs = {}, children = []) => {
    const it = document.createElement(tag);
    entries(attrs).forEach(([name, value]) => {
      it.setAttribute(name, value);
    });
    children.forEach(child => {
      it.appendChild(typeof child === 'string' ? textNode(child) : child);
    });
    return it;
  };

  return {
    show: sel => theElt(sel).classList.remove('hidden'),
    hide: sel => theElt(sel).classList.add('hidden'),
    setDisabled: (sel, state) => (theElt(sel).disabled = state),
    onClick: (sel, l) => theElt(sel).addEventListener('click', l),
    onBlur: (sel, l) => theElt(sel).addEventListener('blur', l),
    onChange: (sel, l) => theElt(sel).addEventListener('change', l),
    onInput: (sel, l) => theElt(sel).addEventListener('input', l),
    busy: async (sel, thunk) => {
      try {
        theElt(sel).classList.add('wait');
        await thunk();
      } finally {
        theElt(sel).classList.remove('wait');
      }
    },
    getField: sel => theElt(sel).value,
    setField: (sel, value) => (theElt(sel).value = value),
    setOptions: (sel, items) => {
      const select = theElt(sel);
      select.innerHTML = '';
      items.forEach(({ value, label }) => {
        select.appendChild(elt('option', { value }, [label]));
      });
    },
    setRadioGroup: (sel, name, items) => {
      const list = theElt(sel);
      list.innerHTML = '';
      items.forEach(({ value, label }) => {
        list.appendChild(
          elt('li', {}, [
            elt('label', {}, [
              elt('input', { type: 'radio', name, value }),
              label,
            ]),
          ]),
        );
      });
    },
    setItems: (sel, items) => {
      const list = theElt(sel);
      list.innerHTML = '';
      items.forEach(item => {
        list.appendChild(elt('li', {}, item));
      });
    },
  };
};

/**
 * @param {UI} ui
 */
export const setupTabs = ui => {
  const sections = ['member', 'creator', 'registrar'];
  sections.forEach(section => {
    ui.onChange(`nav input[value="${section}"]`, () => {
      sections.forEach(candidate => {
        if (candidate === section) {
          ui.show(`section#${section}`);
        } else {
          ui.hide(`section#${candidate}`);
        }
      });
    });
  });
};
