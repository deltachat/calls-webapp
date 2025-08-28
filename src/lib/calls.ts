// TURN server:
const rtcConfiguration = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    /*
    {
      urls: "turn:c20.testrun.org",
      username: "ohV8aec1",
      credential: "zo3theiY",
      },
      */
  ],
  iceTransportPolicy: "all",
  //iceTransportPolicy: "relay",
} as RTCConfiguration;

export type CallState = "connecting" | "ringing" | "in-call";

export class CallsManager {
  private peerConnection: RTCPeerConnection;
  private state: CallState;
  private onStateChanged = (_state: CallState) => {};

  constructor() {
    this.peerConnection = new RTCPeerConnection(rtcConfiguration);
    this.state = "connecting";
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
      const offerObject = {
        type: "offer",
        sdp: payload,
      } as RTCSessionDescriptionInit;
      const offerDescription = new RTCSessionDescription(offerObject);
      this.peerConnection.setRemoteDescription(offerDescription);
      this.peerConnection.setLocalDescription(
        await this.peerConnection.createAnswer(),
      );

      await iceGatheringComplete(this.peerConnection);
      const answer = this.peerConnection.localDescription!.sdp;
      window.calls.acceptCall(encodeURIComponent(answer));
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
      console.log("hash changed", hash);
      if (hash === "call") {
        await this.startCall();
      } else if (hash.startsWith("offer=")) {
        await onIncomingCall(hash.substring(6));
      } else if (hash.startsWith("answer=")) {
        onAcceptedCall(hash.substring(7));
      }
    };
    onHashChange();
    window.addEventListener("hashchange", onHashChange);
  }

  async startCall(): Promise<void> {
    this.peerConnection.setLocalDescription(
      await this.peerConnection.createOffer(),
    );
    await iceGatheringComplete(this.peerConnection);
    const offer = this.peerConnection.localDescription!.sdp;
    window.calls.startCall(encodeURIComponent(offer));
    this.state = "ringing";
    this.onStateChanged(this.state);
  }

  async endCall(): Promise<void> {
    window.calls.endCall();
  }

  getState() {
    return this.state;
  }
}

function iceGatheringComplete(pc: RTCPeerConnection): Promise<void> {
  if (pc.iceGatheringState === "complete") {
    return Promise.resolve();
  }

  return new Promise<void>((r) => {
    const listener = () => {
      if (pc.iceGatheringState === "complete") {
        r();
        pc.removeEventListener("icegatheringstatechange", listener);
      }
    };
    pc.addEventListener("icegatheringstatechange", listener);
  });
}
