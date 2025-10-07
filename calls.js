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
  getIceServers: () => {
    const defaultIceServers = [
      // { urls: "stun:stun.l.google.com:19302" },
      {
        urls: "turn:turn.jami.net",
        username: "ring",
        credential: "ring",
      },
    ];
    return JSON.stringify(defaultIceServers);
  },
  getAvatar: () => {
    return "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAGQAAABkBAMAAACCzIhnAAAAD1BMVEVWGxtgYJd8ktWtpprw696hLMBYAAADUklEQVRYw+2YbW7sIAxFTckCIG8DQ1aABAuIRPa/pmfAgPlIOvO3GlSp1Sgn1/bYxi5cHx/4In8eCc5/iAQAkJ8hFoQGcB8gAQk8IP3biAWdjloIwZNIYiYheBSJtgH4N5AqciSdQQhuRZTej3SM7oXgRkQJAhKkOLNCTtCgj+5oxqwQ9Hg/hsN0YEoTWBHIyCXyQBymykAfqd3sh14RkVkgAdYPF0ROCMb2gTiUJ9OgM+sZOeWABPg5HhFHDwMTeSSOl7zC1iHPvlOUXYc8+56/TH96hpy/iaQou40hNyIGq2BveSZlQ6KImZ9Xzl32hzQ0MqohKBKLsHscX3nGtwmSwGwSxhcERXLhVrMBm+V2RXcZchixFcRirSvREJWiKTmCCR4t/EdIqlz8rCGeSm1QwV+EYHvAT1zLmKxiByTlQEZQJPVsW8NpUhsKHKEyQv8hOZ+7fEMOIMvwl+XZatSWEEstXnQ5mO6Y/kUxkgkJdJME0af6lK5GWWllRE6q0IgM3nQ1YaKdISGWChT9fLVAq8y06qYbKiKhdBs0WrGWpOJl6Wp1l8Yca/MsPa0gotjh8AD0REKsb0hs8lXGQHtBa/6Od5j8qIbmrwZVP6wv5ghdD4aXp9prrB6QvmpGYoHouYl3xISYVd/vrrAJUQtE9YPJAhmvCjOMMpNheojY4MiIkEVK3DsyfZUU0a4GphlmgSjY7x2hTG5W6mz7k1nXtXVI/C5f/GJajFbOc+TMyH73jaRm0CMhIgadV3ejGFZjGBBd3k6nmFUT38fGzu/9UveFKGYF+gNvjnj1ccTqvVUjR+KzCLgs2CFCL5HTxx5o5TUjZ7bsVZCtuYA/uT36cYZJluWewVRctC3ktjZNSn3MJPOeQuBG5Gy9ckTylHD5eYSrBRYZarFsxQgT0iyrTHCWpWaYZ8sT+GAAscV2WeNW46ioTP56ujTLUYN5Di/MC8a1x67m5DztMxmO5HFsGq0dtEFHDVuF9etpPK0ITYYhQd4M8Mm0JiMnkcXMbxvz4hFz8n5NsDUERrXKDPC0WWSmXF85X9zdZlG3BaG5kHOCOQV3qysxhrqN/HVJtATVVdG/s/ACmTetfLebuIN23Lv7vo99yOVe9P13xxfJ5z/2veayt741BwAAAABJRU5ErkJggg==";
  },
};

window.webxdc.setUpdateListener(
  (update) => {
    let { cmd, payload, peer } = update.payload;
    payload = encodeURIComponent(window.btoa(payload));

    if (cmd === "end") {
      window.location.hash = "";
      window.location.reload();
    }

    if (peer === selfAddr) {
    } else if (cmd === "start") {
      console.log("INCOMING CALL!");
      const autoAccept = false;
      window.location.hash =
        (autoAccept ? "#acceptCall=" : "#offerIncomingCall=") + payload;
    } else if (cmd === "accept") {
      console.log("CALL ACCEPTED!");
      window.location.hash = "#onAnswer=" + payload;
    }
    localStorage.maxSerial = update.serial;
  },
  parseInt(localStorage.maxSerial || "0"),
);
