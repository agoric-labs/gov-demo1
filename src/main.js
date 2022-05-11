/* eslint-disable no-debugger */
// @ts-check
/* global HTMLSelectElement */
import { E, makeCapTP } from '@agoric/captp';
import { makePromiseKit } from '@agoric/promise-kit';
import { observeIteration } from '@agoric/notifier';
import { Far } from '@agoric/marshal';
import { AmountMath } from '@agoric/ertp';
// import { makeRatio } from '@agoric/zoe/src/contractSupport/ratio.js';

const { details: X, quote: q } = assert;

const PERCENT = 100n;
const Nat = BigInt; // WARNING

const show = (it) => ('text' in it ? it.text : `${q(it)}`);

export const makeRatio = (
  numerator,
  numeratorBrand,
  denominator = PERCENT,
  denominatorBrand = numeratorBrand,
) => {
  assert(
    denominator > 0n,
    X`No infinite ratios! Denominator was 0/${q(denominatorBrand)}`,
  );

  return harden({
    numerator: AmountMath.make(numeratorBrand, Nat(numerator)),
    denominator: AmountMath.make(denominatorBrand, Nat(denominator)),
  });
};

// yarn link and snowpack don't get along?
// import { QuorumRule, ElectionType, ChoiceMethod } from '@agoric/governance';
// import '@agoric/zoe/exported.js';
// import '@agoric/governance/exported.js';

// Avoid packing all of governance, zoe into the web runtime.
/** @type { Record<string, ChoiceMethod> } */
const ChoiceMethod = { UNRANKED: 'unranked' };
/** @type { Record<string, ElectionType> } */
const ElectionType = { SURVEY: 'survey' };
/** @type { Record<string, QuorumRule> } */
const QuorumRule = { MAJORITY: 'majority' };

const BASIS_POINTS = 10000n;

/**
 * @typedef { import('@agoric/eventual-send').ERef<T>} ERef<T>
 * @template T
 */

/**
 * @param {UI} ui
 * @param {*} io
 * @typedef { import('./ui.js').UI } UI
 */
export const networkSetup = (ui, { activateWebSocket, getActiveSocket }) => {
  let walletAbort;
  let walletDispatch;

  const otherSide = harden({
    needDappApproval: (_origin, _pet) => {
      console.log('need approval');
      ui.show('#needDappApproval');
    },
    dappApproved: (_origin) => {
      console.log('approved');
      ui.hide('#needDappApproval');
    },
  });

  const { promise: board, resolve: boardR } = makePromiseKit();
  const { promise: zoe, resolve: zoeR } = makePromiseKit();
  const { promise: agoricNames, resolve: agoricNamesR } = makePromiseKit();
  const onConnect = async () => {
    const socket = getActiveSocket();
    const {
      abort: ctpAbort,
      dispatch: ctpDispatch,
      getBootstrap,
    } = makeCapTP(
      'Governance Demo',
      (obj) => socket.send(JSON.stringify(obj)),
      otherSide,
    );
    walletAbort = ctpAbort;
    walletDispatch = ctpDispatch;
    const walletP = getBootstrap();

    boardR(E(walletP).getBoard());
    zoeR(E(walletP).getZoe());
    agoricNamesR(E(walletP).getAgoricNames());
  };

  const onDisconnect = () => {
    // setWalletConnected(false);
    walletAbort && walletAbort();
  };

  const onMessage = (data) => {
    const obj = JSON.parse(data);
    walletDispatch && walletDispatch(obj);
  };

  activateWebSocket({
    onConnect,
    onDisconnect,
    onMessage,
  });

  return { agoricNames, board, zoe };
};

/**
 * @param {(err: Error) => void} oops
 * @param {(ev: Event) => Promise<void>} go
 * @returns {EventListener}
 */
const withCatch = (oops, go) => (ev) => go(ev).catch((err) => oops(err));

/**
 * @param { UI } ui
 * @param {*} walletBridge
 * @param {{ agoricNames: ERef<NameHub>, zoe: ERef<ZoeService> } } chain
 */
export const voter = (ui, walletBridge, { zoe, agoricNames }) => {
  /** @type { QuestionDetails[] } */
  const questions = [];
  /** @type { string[][] } */
  const outcomes = [];

  const renderPositions = async (qix) => {
    const {
      positions,
      closingRule: { deadline },
    } = questions[qix];
    ui.setField(
      'input[name="deadline"]',
      new Date(Number(deadline) * 1000).toString(),
    );
    const items = await Promise.all(
      positions.map(async (position, ix) => {
        // if (position.keyword === 'Collateral') {
        //   E(walletBridge).getPetNameForIssuer(...)
        // }
        return { value: `${ix}`, label: `${q(position)}` };
      }),
    );

    ui.setRadioGroup('#positions', 'choice', items);
  };

  const renderQuestions = async () => {
    ui.setOptions(
      'select[name="question"]',
      // @ts-ignore we know the issue has .text
      questions.map(({ issue }, value) => ({
        value: `${value}`,
        label: show(issue),
      })),
    );

    if (questions.length > 0) {
      await renderPositions(questions.length - 1);
    }

    ui.onInput(
      'select[name="question"]',
      withCatch(
        (err) => console.error(err),
        async (ev) => {
          assert(ev.target);
          assert(ev.target instanceof HTMLSelectElement);
          const qix = parseInt(ev.target.value, 10);
          renderPositions(qix);
        },
      ),
    );
  };

  /** @param { QuestionDetails } details */
  const gotQuestion = async (details) => {
    console.log({ details });

    questions.push(details);
    await renderQuestions();

    const {
      issue,
      counterInstance,
      closingRule: { deadline },
    } = details;
    const deadlineDisplay = new Date(Number(deadline) * 1000).toISOString();

    E(E(zoe).getPublicFacet(counterInstance))
      .getOutcome()
      .then((outcome) => {
        console.log('got outcome', issue, outcome);
        outcomes.push([deadlineDisplay, ' ', show(issue), ': ', outcome.text]);
        ui.setItems('#outcomes', outcomes);
      })
      .catch((e) => {
        console.error('vote failed:', issue, e);
        outcomes.push([
          deadlineDisplay,
          ' vote failed: ',
          `${e}`,
          ' question: ',
          show(issue),
        ]);
        ui.setItems('#outcomes', outcomes);
      });
  };

  const voterRights = makePromiseKit();

  ui.onClick(
    'form button#subscribe',
    withCatch(
      (err) => {
        debugger;
        console.log(err);
      },
      async (_ev) => {
        ui.setDisabled('form button#subscribe', true);

        const instanceName = ui.getField('input[name="instanceName"]');
        const instance = await E(agoricNames).lookup('instance', instanceName);
        const electoratePublicFacet = E(zoe).getPublicFacet(instance);

        // reset list of questions whenever registrar changes
        questions.splice(0, questions.length);

        observeIteration(
          E(electoratePublicFacet).getQuestionSubscription(),
          Far('voting observer', {
            /** @param { QuestionDetails } details */
            updateState: gotQuestion,
          }),
        );

        console.log('subscribed to questions from', instance);

        // reset outcomes
        outcomes.splice(0, outcomes.length);
        ui.setItems('#outcomes', outcomes);
      },
    ),
  );

  voterRights.promise.then(() => ui.setDisabled('form button#vote', false));

  ui.onClick(
    'form button#vote',
    withCatch(
      (err) => {
        debugger;
        console.log(err);
      },
      async (_ev) => {
        await ui.busy('body', async () => {
          const qix = parseInt(ui.getField('select[name="question"]'), 10);
          const { questionHandle } = questions[qix];

          const pix = parseInt(
            ui.getField('#positions input[type="radio"]:checked'),
            10,
          );
          const position = questions[qix].positions[pix];
          console.log('voting for', { position, qix, pix });

          await E(voterRights.promise).castBallotFor(questionHandle, [
            position,
          ]);
        });
      },
    ),
  );
};

/**
 * @param { UI } ui
 * @param {{
 *   board: ERef<Board>,
 *   zoe: ERef<ZoeService>,
 * } } chain
 */
export const registrar = (ui, { board }) => {
  ui.onClick(
    'form button#voteOnContractUpdate',
    withCatch(
      (err) => {
        debugger;
        console.log(err);
      },
      async (_ev) => {
        const form = {
          names: ui.getField('input[name="agoricNames"]'),
          timer: ui.getField('input[name="chainTimerService"]'),
          collateral: ui.getField('input[name="collateral"]'),
          secondsTillClose: parseInt(
            ui.getField('input[name="secondsTillClose"]'),
            10,
          ),
        };
        const lookup = (id) => E(board).getValue(id);
        /** @type { ERef<NameHub> } */
        const agoricNames = lookup(form.names);
        /** @type {ERef<Installation>} */
        const counterP = E(agoricNames).lookup('installation', 'binaryCounter');
        /** @type {ERef<GovernedContractFacetAccess>} */
        const governor = E(agoricNames).lookup('demo', 'governorCreatorFacet');
        Promise.all([governor, counterP]).then(
          ([voteCreator, binaryCounter]) => {
            ui.setField('input[name="governor"]', `${voteCreator}`);
            ui.setField(
              'input[name="counterInstallation"]',
              `${binaryCounter}`,
            );
          },
        );

        console.log('await form values: collateral, time, counter...');
        const [newIssuer, current, counter, runBrand] = await Promise.all([
          lookup(form.collateral),
          // @ts-ignore ISSUE: zoe API missing getCurrentTimestamp?
          E(lookup(form.timer)).getCurrentTimestamp(),
          counterP,
          E(agoricNames).lookup('brand', 'RUN'),
        ]);
        console.log('proposing change...', { newIssuer });
        const deadline = current + BigInt(form.secondsTillClose);

        const rates = harden({
          initialMargin: makeRatio(120n, runBrand),
          interestRate: makeRatio(100n, runBrand, BASIS_POINTS),
          liquidationMargin: makeRatio(105n, runBrand),
          loanFee: makeRatio(530n, runBrand, BASIS_POINTS),
        });

        const update = {
          keyword: 'Collateral',
          collateralIssuer: newIssuer,
          rates,
        };
        const updateResults = E(governor).voteOnContractUpdate(
          update,
          counter,
          deadline,
        );

        console.log({ updateResults });
      },
    ),
  );

  ui.onClick(
    'form button#addQuestion',
    withCatch(
      (err) => {
        debugger;
        console.log(err);
      },
      async (_ev) => {
        await ui.busy('body', async () => {
          const the = {
            names: ui.getField('input[name="agoricNames"]'),
            issue: ui.getField('textarea[name="issue"]'),
            timer: ui.getField('input[name="chainTimerService"]'),
            creatorFacet: E(board).getValue(
              ui.getField('input[name="registrarCreatorFacet"]'),
            ),
            secondsTillClose: parseInt(
              ui.getField('input[name="secondsTillClose"]'),
              10,
            ),
          };

          /** @type { ERef<NameHub> } */
          const agoricNames = E(board).getValue(the.names);
          /** @type {ERef<Installation>} */
          const counterP = E(agoricNames).lookup(
            'installation',
            'binaryCounter',
          );

          const [timer, current, counterInstallation] = await Promise.all([
            E(board).getValue(the.timer),
            // @ts-ignore ISSUE: zoe API missing getCurrentTimestamp?
            E(E(board).getValue(the.timer)).getCurrentTimestamp(),
            counterP,
          ]);

          const deadline = current + BigInt(the.secondsTillClose);
          const [issue, ...positions] = the.issue.split('\n');
          /** @type { QuestionSpec } */
          const questionSpec = {
            method: ChoiceMethod.UNRANKED,
            issue: { text: issue },
            positions: positions.map((text) => ({ text })),
            electionType: ElectionType.SURVEY,
            maxChoices: 1,
            closingRule: {
              deadline,
              // ISSUE: a Promise<TimerService> is no good?
              // Timer must be a timer (an object)
              timer,
            },
            quorumRule: QuorumRule.MAJORITY,
            tieOutcome: { text: positions[0] },
          };

          console.log('adding question', questionSpec);
          E(the.creatorFacet)
            .addQuestion(counterInstallation, questionSpec)
            .then((qr) => {
              console.log('question added', qr);
            })
            .catch((err) => {
              console.error(err);
              debugger;
            });
        });
      },
    ),
  );
};

/**
 * @param { UI } ui
 * @param {{
 *   board: ERef<Board>,
 * }} chain
 */
export const creator = (ui, { board }) => {
  ui.onClick(
    'form button#createRegistrar',
    withCatch(
      (err) => {
        debugger;
        console.error(err);
      },
      async (_ev) => {
        await ui.busy('body', async () => {
          const form = {
            names: ui.getField('input[name="agoricNames"]'),
          };
          /** @type { ERef<NameHub> } */
          const agoricNames = E(board).getValue(form.names);

          /** @type {Promise<CommitteeElectorateCreatorFacet>} */
          const electorateCreatorFacet = E(agoricNames).lookup(
            'demo',
            'electorateCreatorFacet',
          );
          const invitations = await Promise.all(
            await E(electorateCreatorFacet).getVoterInvitations(),
          );

          const [creatorLocal, ...invitationIds] = await Promise.all([
            // cast to unknown to be compatible with other items in this list
            /** @type { unknown } */ (electorateCreatorFacet),
            ...invitations.map((i) => E(board).getId(i)),
          ]);
          console.log({ invitations, invitationIds });
          ui.setField('input[name="registrarCreatorFacet"]', `${creatorLocal}`);
          // TODO? ui.setField('input[name="registrarPublicFacet"]', publicId);
          ui.setField('textarea[name="invitations"]', invitationIds.join('\n'));
        });
      },
    ),
  );
};

/**
 * @param { UI } ui
 * @param { * } walletBridge
 */
export const main = async (ui, walletBridge) => {
  const chain = {
    agoricNames: E(walletBridge).getAgoricNames(),
    board: E(walletBridge).getBoard(),
    zoe: E(walletBridge).getZoe(),
  };
  voter(ui, walletBridge, chain);
  registrar(ui, chain);
  creator(ui, chain);
};
