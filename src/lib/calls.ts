const iceServers = window.calls.getIceServers
  ? JSON.parse(window.calls.getIceServers())
  : [
      {
        urls: "turn:c20.testrun.org",
        username: "ohV8aec1",
        credential: "zo3theiY",
      },
    ];
const rtcConfiguration = {
  iceServers,
  iceTransportPolicy: "all",
  //iceTransportPolicy: "relay",

  // This is primarily to ensure that we gather only one TURN ICE candidate,
  // to avoid a situation when we send the local description
  // after gathering just one candidate without waiting
  // for the other TURN candidates to get gathered,
  // resulting in the connection failing, because our WebRTC agent
  // wanted to use other TURN candidates for the data channel or something.
  // You may be able to reproduce this on a Chromium browser,
  // by commenting out this line.
  //
  // Either way, this is the preferable policy, as long as it's supported,
  // and it is. From
  // https://developer.mozilla.org/en-US/docs/Web/API/RTCDtlsTransport#allocation_of_dtls_transports
  // > All browsers support bundling, so when both endpoints are browsers,
  // > you can rest assured that bundling will be used.
  bundlePolicy: "max-bundle",
} as RTCConfiguration;

export type CallState = "connecting" | "ringing" | "in-call";

export class CallsManager {
  private peerConnection: RTCPeerConnection;
  private state: CallState;

  private iceTricklingDataChannel: RTCDataChannel;
  /**
   * Stores local ICE candidates to be sent to the remote peer
   * when the data channel opens.
   */
  private iceTricklingBuffer: Array<RTCIceCandidate | null>;

  private onStateChanged = (_state: CallState) => {};

  constructor() {
    this.peerConnection = new RTCPeerConnection(rtcConfiguration);
    this.state = "connecting";

    this.iceTricklingBuffer = [];
    this.iceTricklingDataChannel = this.peerConnection.createDataChannel(
      "iceTrickling",
      {
        negotiated: true,
        id: 1,
      },
    );
    this.iceTricklingDataChannel.onmessage = (e) => {
      console.log("received ICE candidate from remote peer", e.data);
      this.peerConnection.addIceCandidate(JSON.parse(e.data));
    };
    this.iceTricklingDataChannel.onopen = () => {
      console.log(
        "iceTricklingDataChannel open: sending buffered ICE candidates",
        this.iceTricklingBuffer,
      );
      for (const candidate of this.iceTricklingBuffer) {
        sendIceCandidateToDataChannel(this.iceTricklingDataChannel, candidate);
      }
      this.iceTricklingBuffer = [];
    };
  }

  async init(
    outStream: MediaStream,
    onIncomingStream: (stream: MediaStream) => void,
    onStateChanged: (state: CallState) => void,
  ) {
    this.onStateChanged = onStateChanged;
    this.peerConnection.ontrack = (e: RTCTrackEvent) => {
      const stream = e.streams[0];
      onIncomingStream(stream);
      this.state = "in-call";
      this.onStateChanged(this.state);
    };
    outStream
      .getTracks()
      .forEach((track) => this.peerConnection.addTrack(track, outStream));

    const onIncomingCall = async (payload: string) => {
      const gatheredEnoughIceP = gatheredEnoughIce(this.peerConnection);

      const offerObject = {
        type: "offer",
        sdp: payload,
      } as RTCSessionDescriptionInit;
      const offerDescription = new RTCSessionDescription(offerObject);
      this.peerConnection.setRemoteDescription(offerDescription);
      this.peerConnection.setLocalDescription(
        await this.peerConnection.createAnswer(),
      );

      await gatheredEnoughIceP;
      const answer = this.peerConnection.localDescription!.sdp;
      this.peerConnection.onicecandidate =
        this.trickleIceOverDataChannel.bind(this);
      window.calls.acceptCall(answer);
    };
    const onAcceptedCall = (payload: string) => {
      const answerObject = {
        type: "answer",
        sdp: payload,
      } as RTCSessionDescriptionInit;
      const answerDescription = new RTCSessionDescription(answerObject);

      this.peerConnection.setRemoteDescription(answerDescription);
    };

    const onHashChange = async () => {
      const hash = decodeURIComponent(window.location.hash.substring(1));
      if (hash === "startCall") {
        console.log("URL hash CMD: ", hash);
        await this.startCall();
      } else if (hash.startsWith("acceptCall=")) {
        const offer = window.atob(hash.substring(11));
        console.log("URL hash CMD: acceptCall:", offer);
        await onIncomingCall(offer);
      } else if (hash.startsWith("onAnswer=")) {
        const answer = window.atob(hash.substring(9));
        console.log("URL hash CMD: onAnswer:", answer);
        onAcceptedCall(answer);
      } else {
        console.log("unexpected URL hash: ", hash);
      }
    };
    onHashChange();
    window.addEventListener("hashchange", onHashChange);
  }

  async startCall(): Promise<void> {
    const gatheredEnoughIceP = gatheredEnoughIce(this.peerConnection);
    this.peerConnection.setLocalDescription(
      await this.peerConnection.createOffer(),
    );
    await gatheredEnoughIceP;
    const offer = this.peerConnection.localDescription!.sdp;
    this.peerConnection.onicecandidate =
      this.trickleIceOverDataChannel.bind(this);
    window.calls.startCall(offer);
    this.state = "ringing";
    this.onStateChanged(this.state);
  }

  async endCall(): Promise<void> {
    this.peerConnection.close();
    window.calls.endCall();
  }

  getState() {
    return this.state;
  }

  private trickleIceOverDataChannel(e: RTCPeerConnectionIceEvent) {
    if (this.iceTricklingDataChannel.readyState !== "open") {
      console.log(
        "Gathered new ICE candidate, but iceTricklingDataChannel is not yet open, will buffer it",
        e.candidate,
      );
      this.iceTricklingBuffer.push(e.candidate);
      return;
    }
    sendIceCandidateToDataChannel(this.iceTricklingDataChannel, e.candidate);
  }
}

function gatheredEnoughIce(pc: RTCPeerConnection): Promise<void> {
  if (pc.localDescription != null || pc.remoteDescription != null) {
    console.warn(
      "gatheredEnoughIce called after setLocalDescription " +
        "or setRemoteDescription: " +
        "it might not have captured all ICE candidate events",
    );
  }

  const gotTurnCandidate = new Promise<void>((r) => {
    const listener = (e: RTCPeerConnectionIceEvent) => {
      if (e.candidate != null && e.candidate.type === "relay") {
        // `setTimeout` to wait just a bit,
        // just in case we receive more ICE candidates in burst.
        // But we only expect one, thanks to `bundlePolicy: "max-bundle"`.
        setTimeout(r, 0);

        pc.removeEventListener("icecandidate", listener);
      }
    };
    pc.addEventListener("icecandidate", listener);
  });

  const iceGatheringComplete = new Promise<void>((r) => {
    const listener = () => {
      if (pc.iceGatheringState === "complete") {
        r();
        pc.removeEventListener("icegatheringstatechange", listener);
      }
    };
    pc.addEventListener("icegatheringstatechange", listener);
  });

  return Promise.race([
    // The fact that we got a TURN candidate should mean that
    // we are gonna be able to continue signaling over the TURN server,
    // thus we can send the local description now.
    //
    // TODO can there be multiple "relay" candidates,
    // such that one does _not_ guarantee that we'll succeed
    // in establishing the connection?
    // See https://stackoverflow.com/questions/79750433/is-ice-trickling-signaling-over-turn-data-channel-a-good-idea
    gotTurnCandidate,

    iceGatheringComplete,
  ]);
}

function sendIceCandidateToDataChannel(
  dataChannel: RTCDataChannel,
  candidate: null | RTCIceCandidate,
) {
  console.log("sending ICE candidate to remote peer", candidate);
  dataChannel.send(
    JSON.stringify(candidate === null ? candidate : candidate.toJSON()),
  );
}
