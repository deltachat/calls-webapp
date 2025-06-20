/* fake window.calls API */

const selfAddr = window.webxdc.selfAddr;

window.calls = {
  startCall: (payload) => {
    window.webxdc.sendUpdate(
      { payload: { cmd: "start", payload, peer: selfAddr } },
      "",
    );
  },
  acceptCall: (payload) => {
    window.webxdc.sendUpdate(
      { payload: { cmd: "accept", payload, peer: selfAddr } },
      "",
    );
  },
  endCall: () => {
    window.webxdc.sendUpdate(
      { payload: { cmd: "end", payload: null, peer: selfAddr } },
      "",
    );
  },
};

window.webxdc.setUpdateListener(
  (update) => {
    const { cmd, payload, peer } = update.payload;

    if (cmd === "end") {
      window.location.hash = "";
      window.location.reload();
    }

    if (peer === selfAddr) {
    } else if (cmd === "start") {
      console.log("INCOMING CALL!");
      window.location.hash = "#offer=" + payload;
    } else if (cmd === "accept") {
      console.log("CALL ACCEPTED!");
      window.location.hash = "#answer=" + payload;
    }
    localStorage.maxSerial = update.serial;
  },
  parseInt(localStorage.maxSerial || "0"),
);
