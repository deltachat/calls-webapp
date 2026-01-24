import { useEffect, useRef } from "react";

const containerStyle = {
  imageRendering: "crisp-edges" as "crisp-edges",
  width: "100%",
  height: "100%",
};

interface Props {
  mediaStream: MediaStream | null;
}

export default function FullscreenVideo({ mediaStream }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current == null) {
      throw new Error(
        "cannot start media playback: media element is not mounted",
      );
    }
    const vid = videoRef.current;

    if (vid.srcObject !== mediaStream) {
      vid.srcObject = mediaStream;
    }

    if (mediaStream == null) {
      return;
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
  }, [mediaStream, videoRef]);

  return (
    <div style={containerStyle}>
      <video
        poster="data:image/gif;base64,R0lGODlhAQABAIAAAP///wAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw=="
        width="100%"
        height="100%"
        autoPlay
        playsInline
        ref={videoRef}
      />
    </div>
  );
}
