import { useRef, useEffect, useState, useCallback } from "react";

import { CallsManager, CallState } from "~/lib/calls";

import VideoThumbnail from "~/components/VideoThumbnail";
import FullscreenVideo from "~/components/FullscreenVideo";
import EndCallButton from "~/components/EndCallButton";
import AvatarPlaceholder from "~/components/AvatarPlaceholder";

import "./App.css";

const manager = new CallsManager();

export default function App() {
  const [state, setState] = useState<CallState>(manager.getState());
  const outVidRef = useRef<HTMLVideoElement | null>(null);
  const incVidRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    (async () => {
      const outStream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });
      outVidRef.current!.srcObject = outStream;

      const onIncStream = (incStream: MediaStream) => {
        incVidRef.current!.srcObject = incStream;
      };
      await manager.init(outStream, onIncStream, setState);
    })();
  }, []);

  const endCall = useCallback(() => {
    manager.endCall();
  }, [manager]);

  let status = "";
  if (state === "connecting") {
    status = "Connecting...";
  } else if (state === "ringing") {
    status = "Ringing...";
  }

  const inCall = state === "in-call";
  const containerStyle = {
    display: inCall ? "block" : "none",
    height: "100%",
  };

  return (
    <div style={{ height: "100vh" }}>
      <div style={containerStyle}>
        <FullscreenVideo videoRef={incVidRef} />
        <VideoThumbnail videoRef={outVidRef} />
      </div>

      <div
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
          display: "flex",
          alignItems: "center",
          textAlign: "center",
          justifyContent: "center",
          height: "100%",
        }}
      >
        <AvatarPlaceholder />
      </div>
      <div
        style={{
          position: "absolute",
          bottom: "1em",
          width: "100%",
          textAlign: "center",
        }}
      >
        <EndCallButton onClick={endCall} />
      </div>
    </div>
  );
}
