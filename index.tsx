import React, { useState } from "react";
import ReactDOM from "react-dom";

const rtcConfiguration = {
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
  iceTransportPolicy: "all",
};

// Alternative configuration for a TURN relay with a static password.
// Set to "relay" to only use TURN and avoid exposing IP addresses
/*
const rtcConfiguration = {
  iceServers: [
    {
      urls: "turn:example.org",
      username: "yourUsernameHere",
      credential: "yourPasswordHere",
    },
  ],
  iceTransportPolicy: "relay",
};
*/

function PhoneButtons({ onAccept, onCall }) {
  const [offer, setOffer] = useState("");
  return (
    <div>
      <textarea
        value={offer}
        rows="24"
        cols="80"
        placeholder="offer"
        onChange={(event) => {
          setOffer(event.target.value);
        }}
      />
      <p>
        <button onClick={(event) => onAccept(offer)}>Accept an offer</button>
        <button onClick={(event) => onCall()}>Make a new offer</button>
      </p>
    </div>
  );
}

function AnswerControls({ offer, onAnswer }) {
  const [answer, setAnswer] = useState("");
  return (
    <div>
      <textarea rows="24" cols="80" value={offer} readOnly />
      <textarea
        placeholder="answer"
        rows="24"
        cols="80"
        value={answer}
        onChange={(event) => {
          setAnswer(event.target.value);
        }}
      />
      <p>
        <button onClick={() => onAnswer(answer)}>Accept answer</button>
      </p>
    </div>
  );
}

class App extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      selected: false,
      offer: null,
      answer: null,
    };
    this.localVideo = React.createRef();
    this.remoteVideo = React.createRef();

    this.peerConnection = new RTCPeerConnection(rtcConfiguration);
    this.peerConnection.ontrack = (e: RTCTrackEvent) => {
      const stream = e.streams[0];

      this.remoteVideo.srcObject = stream;

      stream.getTracks()[0].onunmute = () => {
        // If at least one remote track unmutes, answer has been delivered successfully.
        this.setState((state) => ({
          answer: null,
        }));
      };
    };
  }

  onCall = () => {
    this.setState((state) => ({
      selected: true,
    }));

    const mediaDevices = navigator.mediaDevices;
    mediaDevices
      .getUserMedia({ video: true, audio: true })
      .then((stream: MediaStream) => {
        this.localVideo.srcObject = stream;
        stream
          .getTracks()
          .forEach((track) => this.peerConnection.addTrack(track, stream));

        this.peerConnection.onicecandidate = (
          event: RTCPeerConnectionIceEvent
        ) => {
          if (event.candidate == null) {
            this.setState((state) => ({
              offer: this.peerConnection.localDescription.sdp,
            }));
          }
        };

        this.peerConnection
          .createOffer()
          .then((offer) => {
            return this.peerConnection.setLocalDescription(offer);
          })
          .catch((error) => {
            console.warn(error);
          });
      })
      .catch((error) => {
        console.error(error);
      });
  };

  onAccept = (offer) => {
    navigator.mediaDevices
      .getUserMedia({ video: true, audio: true })
      .then((stream: MediaStream) => {
        this.localVideo.srcObject = stream;
        stream
          .getTracks()
          .forEach((track) => this.peerConnection.addTrack(track, stream));

        const offerObject = { type: "offer", sdp: offer };
        const offerDescription = new RTCSessionDescription(offerObject);

        this.peerConnection.onicecandidate = (e: RTCPeerConnectionIceEvent) => {
          if (e.candidate == null) {
            this.setState((state) => ({
              answer: this.peerConnection.localDescription.sdp,
            }));
          }
        };

        this.peerConnection.setRemoteDescription(offerDescription);
        this.peerConnection
          .createAnswer()
          .then((answerDescription) => {
            this.peerConnection.setLocalDescription(answerDescription);
          })
          .catch((error) => {
            console.error(error);
          });

        this.setState((state) => ({
          selected: true,
        }));
      })
      .catch((error) => {
        console.error(error);
      });
  };

  onAnswer = (answer) => {
    const answerObject = { type: "answer", sdp: answer };
    const answerDescription = new RTCSessionDescription(answerObject);

    this.peerConnection.setRemoteDescription(answerDescription);
    this.setState((state) => ({
      offer: null,
    }));
  };

  render() {
    return (
      <>
        <div>
          <video
            width="320"
            height="240"
            style={{ border: "1px solid black" }}
            muted
            autoPlay
            ref={(video) => {
              this.localVideo = video;
            }}
          />
          <video
            width="320"
            height="240"
            autoPlay
            style={{ border: "1px solid black" }}
            ref={(video) => {
              this.remoteVideo = video;
            }}
          />
        </div>

        {!this.state.selected && (
          <PhoneButtons onAccept={this.onAccept} onCall={this.onCall} />
        )}

        {this.state.offer && (
          <AnswerControls offer={this.state.offer} onAnswer={this.onAnswer} />
        )}

        {this.state.answer && (
          <textarea rows="24" cols="80" value={this.state.answer} readOnly />
        )}
      </>
    );
  }
}

ReactDOM.render(<App />, document.getElementById("root"));
