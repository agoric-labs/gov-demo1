// @ts-check
import '@agoric/install-ses';
import { E, makeCapTP } from '@agoric/captp';
import {
  activateWebSocket,
  deactivateWebSocket,
  getActiveSocket,
} from './utils/fetch-websocket.js';

export const main = () => {
  const setup = () => {
    let walletAbort;
    let walletDispatch;

    const otherSide = harden({
      needDappApproval: (_origin, _pet) => {
        console.log('need approval');
      },
      dappApproved: (_origin) => {
        console.log('approved');
      },
    });

    const onConnect = async () => {
      debugger;

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
      console.log('@@@got it!', { walletP });
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

    return deactivateWebSocket;
  };

  return harden({ setup });
};

console.log({ E, makeCapTP });
