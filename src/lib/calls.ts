import { logSDP } from "../utils/readable-spd-log";

const initialRtcConfiguration = {
  iceServers: [], // To be set later by `setConfig`.
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
  // This should make the connection establish faster,
  // by gathering candidates prior to the `setLocalDescription` call.
  // `setLocalDescription` call.
  // Most notably, the `setLocalDescription` call is not performed
  // until `getUserMedia` resolves,
  // and sometimes it takes up to a second or two.
  //
  // TODO figure out what would be the appropriate number for this.
  // For example, https://github.com/webrtc/FirebaseRTC/issues/7#issue-587573275
  // says:
  // > a setting of more than one usually does not make sense
  iceCandidatePoolSize: 1,
} as RTCConfiguration;

export type CallState =
  | "promptingUserToAcceptCall"
  | "connecting"
  | "ringing"
  | "in-call";

export class CallsManager {
  private peerConnection: RTCPeerConnection;
  private setIceServersPromise: Promise<void>;
  private state: CallState;
  static initialState = "connecting" as const;

  resolveCallAcceptedPromise?: (accepted: boolean) => void;

  private iceTricklingDataChannel: RTCDataChannel;
  /**
   * Stores local ICE candidates to be sent to the remote peer
   * when the data channel opens.
   */
  private iceTricklingBuffer: Array<RTCIceCandidate | null>;

  constructor(
    private outStreamPromise: Promise<MediaStream>,
    onIncomingStream: (stream: MediaStream) => void,
    private onStateChanged: (state: CallState) => void,
  ) {
    this.peerConnection = new RTCPeerConnection(initialRtcConfiguration);

    const setIceServers = (iceServers: RTCConfiguration["iceServers"]) => {
      this.peerConnection.setConfiguration({
        ...initialRtcConfiguration,
        iceServers: iceServers,
      });
    };
    const ret = window.calls.getIceServers();
    if (typeof ret === "string") {
      setIceServers(JSON.parse(ret));
      this.setIceServersPromise = Promise.resolve();
    } else {
      this.setIceServersPromise = ret.then((r) => {
        setIceServers(JSON.parse(r));
      });
    }

    this.state = CallsManager.initialState;

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

    this.peerConnection.ontrack = (e: RTCTrackEvent) => {
      const stream = e.streams[0];
      onIncomingStream(stream);
      this.state = "in-call";
      this.onStateChanged(this.state);
    };

    const acceptCall = async (payload: string) => {
      this.state = "connecting";
      this.onStateChanged(this.state);

      await this.setIceServersPromise;
      const gatheredEnoughIceP = gatheredEnoughIce(this.peerConnection);

      const offerObject = {
        type: "offer",
        sdp: payload,
      } as RTCSessionDescriptionInit;
      const offerDescription = new RTCSessionDescription(offerObject);
      this.peerConnection.setRemoteDescription(offerDescription);
      const outStream = await outStreamPromise;
      console.log("getUserMedia() completed");
      outStream
        .getTracks()
        .forEach((track) => this.peerConnection.addTrack(track, outStream));
      this.peerConnection.setLocalDescription(
        await this.peerConnection.createAnswer(),
      );

      await gatheredEnoughIceP;
      const answer = this.peerConnection.localDescription!.sdp;
      this.peerConnection.onicecandidate =
        this.trickleIceOverDataChannel.bind(this);
      logSDP("Answering incoming call with answer:", answer);
      window.calls.acceptCall(answer);
    };
    const onAnswer = (payload: string) => {
      const answerObject = {
        type: "answer",
        sdp: payload,
      } as RTCSessionDescriptionInit;
      const answerDescription = new RTCSessionDescription(answerObject);

      this.peerConnection.setRemoteDescription(answerDescription);
    };

    const onHashChange = async () => {
      const hash = decodeURIComponent(window.location.hash.substring(1));
      if (!hash || hash.length === 0) {
        console.log("empty URL hash: ", window.location.href);
        return;
      }

      // A new command, most likely `#acceptCall`, has been issued.
      // Let's interrupt the previously started `#offerIncomingCall`,
      // if any.
      this.resolveCallAcceptedPromise?.(false);

      if (hash === "startCall") {
        console.log("URL hash CMD: ", hash);
        await this.startCall();
      } else if (hash.startsWith("offerIncomingCall=")) {
        const offer = window.atob(hash.split("offerIncomingCall=", 2)[1]);
        logSDP("Incoming call (with user prompt) with offer:", offer);

        this.state = "promptingUserToAcceptCall";
        this.onStateChanged(this.state);

        // Wait for the user to accept the call, do _not_ do anything
        // with the other party's offer yet,
        // i.e. don't establish the connection, for privacy reasons.
        const accepted: boolean = await new Promise((r) => {
          const fn = (val: boolean) => {
            r(val);
            if (this.resolveCallAcceptedPromise === fn) {
              this.resolveCallAcceptedPromise = undefined;
            }
          };
          this.resolveCallAcceptedPromise = fn;
        });
        console.log(
          "Accept call prompt resolved: " +
            (accepted ? "accepted" : "not accepted"),
        );

        if (!accepted) {
          // "Not accepted" doesn't mean "declined".
          // If "declined", `window.calls.endCall()` will be called
          // in a separate place.
          return;
        }
        await acceptCall(offer);
      } else if (hash.startsWith("acceptCall=")) {
        const offer = window.atob(hash.substring(11));
        logSDP("Incoming call with offer:", offer);
        await acceptCall(offer);
      } else if (hash.startsWith("onAnswer=")) {
        const answer = window.atob(hash.substring(9));
        logSDP("Outgoing call was accepted with answer:", answer);
        onAnswer(answer);
      } else {
        console.log("unexpected URL hash: ", hash);
      }
    };
    onHashChange();
    window.addEventListener("hashchange", onHashChange);
  }

  async startCall(): Promise<void> {
    await this.setIceServersPromise;
    const gatheredEnoughIceP = gatheredEnoughIce(this.peerConnection);
    const outStream = await this.outStreamPromise;
    console.log("getUserMedia() completed");
    outStream
      .getTracks()
      .forEach((track) => this.peerConnection.addTrack(track, outStream));
    this.peerConnection.setLocalDescription(
      await this.peerConnection.createOffer(),
    );
    await gatheredEnoughIceP;
    const offer = this.peerConnection.localDescription!.sdp;
    this.peerConnection.onicecandidate =
      this.trickleIceOverDataChannel.bind(this);
    logSDP("Start outgoing call with offer:", offer);
    window.calls.startCall(offer);
    this.state = "ringing";
    this.onStateChanged(this.state);
  }

  acceptCall() {
    if (this.resolveCallAcceptedPromise == undefined) {
      console.warn("acceptCall invoked, but we were not waiting for it");
      return;
    }
    this.resolveCallAcceptedPromise(true);
  }

  async endCall(): Promise<void> {
    this.peerConnection.close();
    window.calls.endCall();

    this.resolveCallAcceptedPromise?.(false);
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
