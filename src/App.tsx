import { useRef, useState, useCallback, useMemo, useEffect } from "react";

import { CallsManager, CallState } from "~/lib/calls";

import VideoThumbnail from "~/components/VideoThumbnail";
import FullscreenVideo from "~/components/FullscreenVideo";
import EndCallButton from "~/components/EndCallButton";
import AvatarPlaceholder from "~/components/AvatarPlaceholder";
import AvatarImage from "~/components/AvatarImage";
import Button from "~/components/Button";
import MaterialSymbolsCall from "~icons/material-symbols/call";
import MaterialSymbolsVideocam from "~icons/material-symbols/videocam";
import MaterialSymbolsVideocamOff from "~icons/material-symbols/videocam-off";
import MaterialSymbolsMic from "~icons/material-symbols/mic";
import MaterialSymbolsMicOff from "~icons/material-symbols/mic-off";

import "./App.css";

export default function App() {
  const [state, setState] = useState<CallState>(CallsManager.initialState);
  const outVidRef = useRef<HTMLVideoElement | null>(null);
  const incVidRef = useRef<HTMLVideoElement | null>(null);

  const disableVideoCompletelyRef = useRef<boolean | null>(null);
  if (disableVideoCompletelyRef.current == null) {
    disableVideoCompletelyRef.current = location.search.includes(
      "disableVideoCompletely",
    );
  }
  const disableVideoCompletely = disableVideoCompletelyRef.current;

  const enableVideoInitiallyRef = useRef<boolean | null>(null);
  if (enableVideoInitiallyRef.current == null) {
    enableVideoInitiallyRef.current = !location.search.includes(
      "noOutgoingVideoInitially",
    );
  }
  const enableVideoInitially = enableVideoInitiallyRef.current;

  const [isOutAudioEnabled, setIsOutAudioEnabled] = useState(true);
  const [isOutVideoEnabled_, setIsOutVideoEnabled] =
    useState(enableVideoInitially);
  const isOutVideoEnabled = disableVideoCompletely ? false : isOutVideoEnabled_;
  const isOutAudioEnabledRef = useRef(isOutAudioEnabled);
  isOutAudioEnabledRef.current = isOutAudioEnabled;
  const isOutVideoEnabledRef = useRef(isOutVideoEnabled);
  isOutVideoEnabledRef.current = isOutVideoEnabled;

  const outStreamPromise = useMemo(async () => {
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: !disableVideoCompletely,
        audio: true,
      });
    } catch (error) {
      console.warn("Failed to getUserMedia with video, will try just audio");
      stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
      });
    }

    // Make sure to set the initial `enabled` values
    // before we even from this async function,
    // to make sure that we don't accidentally send a frame or two.
    stream
      .getAudioTracks()
      .forEach((t) => (t.enabled = isOutAudioEnabledRef.current));
    stream
      .getVideoTracks()
      .forEach((t) => (t.enabled = isOutVideoEnabledRef.current));

    return stream;
  }, [disableVideoCompletely]);
  const [outStream, setOutStream] = useState<MediaStream | null>(null);
  useEffect(() => {
    let outdated = false;

    setOutStream(null);
    outStreamPromise.then((s) => {
      if (!outdated) {
        setOutStream(s);
      }
    });

    return () => {
      outdated = true;
    };
  }, [outStreamPromise]);

  if (
    outStream &&
    outVidRef.current &&
    outVidRef.current.srcObject !== outStream
  ) {
    outVidRef.current.srcObject = outStream;
  }

  const manager = useMemo(() => {
    const onIncStream = (incStream: MediaStream) => {
      if (disableVideoCompletely) {
        incStream.getVideoTracks().forEach((t) => incStream.removeTrack(t));
        incStream.addEventListener("addtrack", (e) => {
          if (e.track.kind !== "video") {
            return;
          }
          incStream.removeTrack(e.track);
        });
      }

      const vid = incVidRef.current!;
      if (vid.srcObject !== incStream) {
        vid.srcObject = incStream;
      }

      // On Delta Touch (Ubuntu Touch, Chromium 87)
      // the caller's audio doesn't seem to auto-play
      // on the callee's side for some reason. This fixes it.
      const playIfPaused = () => {
        if (vid.paused) {
          console.log("incoming video not playing, will .play() it");
          vid.play();
        } else {
          console.log("incoming video is playing");
          clearInterval(intervalId);
        }
      };
      const intervalId = setInterval(playIfPaused, 100);
      playIfPaused();
    };
    return new CallsManager(outStreamPromise, onIncStream, setState);
  }, [outStreamPromise, disableVideoCompletely]);

  useEffect(() => {
    if (outStream == undefined) {
      return;
    }

    const enableOrDisableTracks = () => {
      outStream
        .getAudioTracks()
        .forEach((t) => (t.enabled = isOutAudioEnabled));
      outStream
        .getVideoTracks()
        .forEach((t) => (t.enabled = isOutVideoEnabled));
    };
    enableOrDisableTracks();

    outStream.addEventListener("addtrack", enableOrDisableTracks);
    outStream.addEventListener("removetrack", enableOrDisableTracks);
    return () => {
      outStream.removeEventListener("addtrack", enableOrDisableTracks);
      outStream.removeEventListener("removetrack", enableOrDisableTracks);
    };
  }, [outStream, isOutAudioEnabled, isOutVideoEnabled]);

  const outStreamHasVideoTrack =
    !disableVideoCompletely &&
    (outStream == undefined || outStream.getVideoTracks().length >= 1);

  const acceptCall: null | (() => void) =
    state === "promptingUserToAcceptCall" ? () => manager.acceptCall() : null;

  const endCall = useCallback(() => {
    manager.endCall();
  }, [manager]);

  let status: string;
  switch (state) {
    case "promptingUserToAcceptCall":
      status = "Incoming call";
      break;
    case "connecting":
      status = "Connecting...";
      break;
    case "ringing":
      status = "Ringing...";
      break;
    case "in-call":
      status = "";
      break;
  }

  const inCall = state === "in-call";
  const containerStyle = {
    display: inCall ? "block" : "none",
    height: "100%",
  };

  const toggleAudioLabel = isOutAudioEnabled
    ? "Mute microphone"
    : "Unmute microphone";
  const toggleVideoLabel = isOutVideoEnabled ? "Stop camera" : "Start camera";

  const buttonsStyle = {
    color: "white",
    borderRadius: "50%",
    fontSize: "1.5em",
    margin: "0.25em 0.625em",
  };

  return (
    <div style={{ height: "100vh", overflow: "hidden" }}>
      <div style={containerStyle}>
        <FullscreenVideo videoRef={incVidRef} />
        <VideoThumbnail videoRef={outVidRef} />
      </div>

      <div
        role="status"
        style={{
          position: "absolute",
          top: 0,
          width: "100%",
          paddingTop: "1em",
          textAlign: "center",
        }}
      >
        {status}
      </div>
      <div
        style={{
          display: inCall ? "none" : "flex",
          alignItems: "center",
          textAlign: "center",
          justifyContent: "center",
          height: "100%",
        }}
      >
        <div style={{ position: "relative" }}>
          <AvatarPlaceholder />
          {window.calls.getAvatar && (
            <AvatarImage
              url={window.calls.getAvatar()}
              style={{ position: "absolute", inset: 0 }}
            />
          )}
        </div>
      </div>
      <div
        style={{
          position: "absolute",
          bottom: "0.75em",
          width: "100%",
          textAlign: "center",
        }}
      >
        <EndCallButton onClick={endCall} style={buttonsStyle} />
        <Button
          aria-label={toggleAudioLabel}
          title={toggleAudioLabel}
          onClick={() => setIsOutAudioEnabled((v) => !v)}
          style={buttonsStyle}
        >
          {isOutAudioEnabled ? (
            <MaterialSymbolsMic />
          ) : (
            <MaterialSymbolsMicOff />
          )}
        </Button>
        {outStreamHasVideoTrack && (
          <Button
            aria-label={toggleVideoLabel}
            title={toggleVideoLabel}
            onClick={() => setIsOutVideoEnabled((v) => !v)}
            style={buttonsStyle}
          >
            {isOutVideoEnabled ? (
              <MaterialSymbolsVideocam />
            ) : (
              <MaterialSymbolsVideocamOff />
            )}
          </Button>
        )}
        {acceptCall != null && (
          <Button
            aria-label="Answer call"
            title="Answer call"
            onClick={acceptCall}
            className="acceptCallButton"
            style={{
              backgroundColor: "#00b000",
              ...buttonsStyle,
            }}
          >
            <MaterialSymbolsCall />
          </Button>
        )}
      </div>
    </div>
  );
}
