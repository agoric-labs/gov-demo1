// @ts-check
/* global HTMLSelectElement */
import '@agoric/install-ses';
import { E, makeCapTP } from '@agoric/captp';
import { makePromiseKit } from '@agoric/promise-kit';
import { observeIteration } from '@agoric/notifier';
import { Far, fulfillToStructure } from '@agoric/marshal';

// yarn link and snowpack don't get along?
// import {
//   QuorumRule,
//   ElectionType,
//   ChoiceMethod,
// } from '@agoric/governance/src/question.js';
// import '@agoric/governance/exported.js';

/**
 * @param { import('./ui.js').UI } ui
 * @param {*} net
 */
export const main = (
  ui,
  { activateWebSocket, deactivateWebSocket, getActiveSocket },
) => {
  const networkSetup = () => {
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

    return { deactivateWebSocket, board, zoe };
  };

  const { board, zoe } = networkSetup();

  const withCatch = (oops, go) => (ev) => go(ev).catch((err) => oops(err));

  /** @type { QuestionDetails[] } */
  const questions = [];

  const renderPositions = (qix) => {
    ui.setRadioGroup(
      '#positions',
      // @ts-ignore
      questions[qix].positions.map(({ text }) => ({
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
        /** @type { EventListener } */
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
  };

  ui.onInput(
    'input[name="registrarPublicFacet"]',
    withCatch(
      (err) => {
        debugger;
        console.log(err);
      },
      /** @type { EventListener } */
      async (_ev) => {
        const the = {
          registrarPublicFacet: E(board).getValue(
            ui.getField('input[name="registrarPublicFacet"]'),
          ),
        };

        // reset list of questions whenever registrar changes
        questions.splice(0, questions.length);

        observeIteration(
          E(the.registrarPublicFacet).getQuestionSubscription(),
          Far('voting observer', {
            /** @param { QuestionDetails } details */
            updateState: gotQuestion,
          }),
        );
        console.log(
          'subscribed to questions from',
          ui.getField('input[name="registrarPublicFacet"]'),
        );
      },
    ),
  );

  ui.onClick(
    'form button#vote',
    withCatch(
      (err) => {
        debugger;
        console.log(err);
      },
      /** @type { EventListener } */
      async (_ev) => {
        await ui.busy('body', async () => {
          const the = {
            question:
              questions[parseInt(ui.getField('select[name="question"]'), 10)],
            position: ui.getField('#positions input[type="radio"]:checked'),
            voterInvitation: await E(board).getValue(
              ui.getField('input[name="voterInvitation"]'),
            ),
          };

          const rightsP = E(E(zoe).offer(the.voterInvitation)).getOfferResult();
          await E(rightsP).castBallotFor(the.question.questionHandle, [
            { text: the.position },
          ]);
        });
      },
    ),
  );

  /** @type { string[][] } */
  const outcomes = [];

  ui.onClick(
    'form button#addQuestion',
    withCatch(
      (err) => {
        debugger;
        console.log(err);
      },
      /** @type { EventListener } */
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
              ui.getField('input[name="counterInstallation"]'),
              10,
            ),
          };
          const [timer, current] = await Promise.all([
            the.timer,
            E(the.timer).getCurrentTimestamp(),
          ]);

          const [issue, ...positions] = the.issue.split('\n');
          /** @type { QuestionSpec } */
          const questionSpec = {
            method: 'unranked', // ChoiceMethod.UNRANKED,
            issue: { text: issue },
            positions: positions.map((text) => ({ text })),
            electionType: 'survey', // ElectionType.SURVEY,
            maxChoices: 1,
            closingRule: {
              deadline: current + BigInt(the.secondsTillClose),
              // a Promise<TimerService> is no good?
              // Timer must be a timer (an object)
              timer,
            },
            quorumRule: 'majority', // QuorumRule.MAJORITY,
            tieOutcome: { text: positions[0] },
          };

          console.log('adding question', questionSpec);
          E(the.creatorFacet)
            .addQuestion(the.counterInstallation, questionSpec)
            .then((qr) => {
              console.log('question added; standing by for outcome:', qr);
              E(E(zoe).getPublicFacet(qr.instance))
                .getOutcome()
                .then((outcome) => {
                  console.log('got outcome', issue, outcome);
                  outcomes.push([issue, outcome]);
                  ui.setItems('#outcomes', outcomes);
                })
                .catch((e) => {
                  console.error('vote failed', issue, e);
                  outcomes.push(['vote failed', e.name, e.message]);
                  ui.setItems('#outcomes', outcomes);
                });
            })
            .catch((err) => {
              console.error(err);
              debugger;
            });
        });
      },
    ),
  );

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

console.log({ E, makeCapTP });
