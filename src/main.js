// @ts-check
import '@agoric/install-ses';
import { E, makeCapTP } from '@agoric/captp';
import { makePromiseKit } from '@agoric/promise-kit';

/**
 * @param {{
 *   show: (sel: string) => void,
 *   hide: (sel: string) => void,
 *   onClick: (sel: string, l: EventListener) => void,
 *   busy: (sel: string, thunk: () => Promise<void>) => Promise<void>
 *   getField: (sel: string) => string
 *   setField: (sel: string, value: string) => void
 * }} ui
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
          committeeSize: BigInt(ui.getField('input[name="committeeSize"]')),
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
          const [creatorId, publicId] = await Promise.all([
            E(board).getId(creatorFacet),
            E(board).getId(publicFacet),
          ]);
          ui.setField('input[name="registrarCreatorFacet"]', creatorId);
          ui.setField('input[name="registrarPublicFacet"]', publicId);
        });
      },
    ),
  );
};

console.log({ E, makeCapTP });
