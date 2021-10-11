/* eslint-disable no-debugger */
// @ts-check
/* global HTMLSelectElement */
import { E, makeCapTP } from '@agoric/captp';
import { makePromiseKit } from '@agoric/promise-kit';
import { observeIteration } from '@agoric/notifier';
import { Far } from '@agoric/marshal';

// yarn link and snowpack don't get along?
// import { QuorumRule, ElectionType, ChoiceMethod } from '@agoric/governance';
// import '@agoric/zoe/exported.js';
// import '@agoric/governance/exported.js';

// Avoid packing all of governance, zoe into the web runtime.
const ChoiceMethod = { UNRANKED: 'unranked' };
const ElectionType = { SURVEY: 'survey' };
const QuorumRule = { MAJORITY: 'majority' };

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

  return { board, zoe };
};

/**
 * @param {(err: Error) => void} oops
 * @param {(ev: Event) => Promise<void>} go
 * @returns {EventListener}
 */
const withCatch = (oops, go) => (ev) => go(ev).catch((err) => oops(err));

/**
 * @param { UI } ui
 * @param {{ board: any, zoe: ERef<ZoeService> } } chain
 */
export const voter = (ui, { board, zoe }) => {
  /** @type { QuestionDetails[] } */
  const questions = [];
  /** @type { string[][] } */
  const outcomes = [];

  const renderPositions = (qix) => {
    const {
      positions,
      closingRule: { deadline },
    } = questions[qix];
    ui.setField(
      'input[name="deadline"]',
      new Date(Number(deadline) * 1000).toString(),
    );
    ui.setRadioGroup(
      '#positions',
      // @ts-ignore
      positions.map(({ text }) => ({
        value: text,
        label: text,
      })),
    );
  };

  const renderQuestions = () => {
    ui.setOptions(
      'select[name="question"]',
      // @ts-ignore we know the issue has .text
      questions.map(({ issue: { text: label } }, value) => ({
        value: `${value}`,
        label,
      })),
    );

    if (questions.length > 0) {
      renderPositions(questions.length - 1);
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

    assert('text' in details.issue); // SimpleIssue only
    questions.push(details);
    renderQuestions();

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
        outcomes.push([deadlineDisplay, ' ', issue.text, ': ', outcome.text]);
        ui.setItems('#outcomes', outcomes);
      })
      .catch((e) => {
        console.error('vote failed:', issue, e);
        outcomes.push([
          deadlineDisplay,
          ' vote failed: ',
          `${e}`,
          ' question: ',
          issue.text,
        ]);
        ui.setItems('#outcomes', outcomes);
      });
  };

  const voterRights = makePromiseKit();

  ui.onClick(
    'form button#claim',
    withCatch(
      (err) => {
        debugger;
        console.log(err);
      },
      async (_ev) => {
        ui.setDisabled('form button#claim', true);

        // TODO: route this invitation via the wallet
        const voterInvitation = await E(board).getValue(
          ui.getField('input[name="voterInvitation"]'),
        );
        const registrarPublicFacet = await E(zoe).getPublicFacet(
          await E(zoe).getInstance(voterInvitation),
        );

        E(E(zoe).offer(voterInvitation))
          .getOfferResult()
          .then((rights) => voterRights.resolve(rights));

        // reset list of questions whenever registrar changes
        questions.splice(0, questions.length);

        observeIteration(
          E(registrarPublicFacet).getQuestionSubscription(),
          Far('voting observer', {
            /** @param { QuestionDetails } details */
            updateState: gotQuestion,
          }),
        );

        console.log('subscribed to questions from', voterInvitation);

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
          const { questionHandle } =
            questions[parseInt(ui.getField('select[name="question"]'), 10)];
          const position = {
            text: ui.getField('#positions input[type="radio"]:checked'),
          };

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
 * @param {{ board: any, zoe: ERef<ZoeService> } } chain
 */
export const registrar = (ui, { board }) => {
  ui.onClick(
    'form button#voteOnParamChange',
    withCatch(
      (err) => {
        debugger;
        console.log(err);
      },
      async (_ev) => {
        const form = {
          governor: ui.getField('input[name="governor"]'),
          counterInstallation: ui.getField('input[name="counterInstallation"]'),
          timer: ui.getField('input[name="chainTimerService"]'),
          key: ui.getField('input[name="key"]'),
          parameterName: ui.getField('input[name="parameterName"]'),
          collateral: ui.getField('input[name="collateral"]'),
          secondsTillClose: parseInt(
            ui.getField('input[name="secondsTillClose"]'),
            10,
          ),
        };
        const lookup = (id) => E(board).getValue(id);
        const paramSpec = { key: form.key, parameterName: form.parameterName };
        console.log('await form values: collateral, time, counter...');
        const [proposedValue, current, counter] = await Promise.all([
          lookup(form.collateral),
          E(lookup(form.timer)).getCurrentTimestamp(),
          lookup(form.counterInstallation),
        ]);
        console.log('proposing change...', { paramSpec, proposedValue });
        const deadline = current + BigInt(form.secondsTillClose);
        /** @type {ERef<GovernedContractFacetAccess>} */
        const governor = lookup(form.governor);
        const result = await E(governor).voteOnParamChange(
          paramSpec,
          proposedValue,
          counter,
          deadline,
        );
        console.log({ result });
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
            issue: ui.getField('textarea[name="issue"]'),
            timer: E(board).getValue(
              ui.getField('input[name="chainTimerService"]'),
            ),
            creatorFacet: E(board).getValue(
              ui.getField('input[name="registrarCreatorFacet"]'),
            ),
            counterInstallation: E(board).getValue(
              ui.getField('input[name="counterInstallation"]'),
            ),
            secondsTillClose: parseInt(
              ui.getField('input[name="secondsTillClose"]'),
              10,
            ),
          };
          const [timer, current] = await Promise.all([
            the.timer,
            E(the.timer).getCurrentTimestamp(),
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
            .addQuestion(the.counterInstallation, questionSpec)
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
 * @param {{ board: any, zoe: ERef<ZoeService> } } chain
 */
export const creator = (ui, { board, zoe }) => {
  ui.onClick(
    'form button#createRegistrar',
    withCatch(
      (err) => {
        debugger;
        console.error(err);
      },
      async (_ev) => {
        const committeeTerms = {
          committeeName: ui.getField('input[name="committeeName"]'),
          committeeSize: parseInt(
            ui.getField('input[name="committeeSize"]'),
            10,
          ),
        };
        await ui.busy('body', async () => {
          const installation = E(board).getValue(
            ui.getField('input[name="registrarInstallation"]'),
          );
          const { creatorFacet, publicFacet } = await E(zoe).startInstance(
            installation,
            {},
            committeeTerms,
          );
          const invitations = await Promise.all(
            await E(creatorFacet).getVoterInvitations(),
          );
          const [creatorId, publicId, ...invitationIds] = await Promise.all([
            E(board).getId(creatorFacet),
            E(board).getId(publicFacet),
            ...invitations.map((i) => E(board).getId(i)),
          ]);
          console.log({ invitations, invitationIds });
          ui.setField('input[name="registrarCreatorFacet"]', creatorId);
          ui.setField('input[name="registrarPublicFacet"]', publicId);
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
    board: E(walletBridge).getBoard(),
    zoe: E(walletBridge).getZoe(),
  };
  voter(ui, chain);
  registrar(ui, chain);
  creator(ui, chain);
};
