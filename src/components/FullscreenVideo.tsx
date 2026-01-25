import { useEffect, useRef, useState } from "react";

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
  /**
   * This element will play the same source as the video element.
   * If the video is for some reason stuck,
   * we mute the video element and unmute the audio element.
   *
   * This is a workaround for the issue we're having
   * with the remote side utilizing
   * `videoTransceiver.sender.replaceTrack(null)` for muting the video.
   * In such a case the video element will not start playback
   * until the remote enables video once. After that everything is working fine.
   * See https://github.com/deltachat/calls-webapp/issues/79.
   */
  const audioRef = useRef<HTMLAudioElement>(null);

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
    if (audioRef.current) {
      if (audioRef.current.srcObject !== mediaStream) {
        audioRef.current.srcObject = mediaStream;
      }
    } else {
      console.warn(
        "cannot set source for fallback audio element: element is not mounted",
      );
    }

    if (mediaStream == null) {
      return;
    }

    for (const el of [vid, audioRef.current]) {
      if (el == null) {
        continue;
      }
      // On Delta Touch (Ubuntu Touch, Chromium 87)
      // the caller's audio doesn't seem to auto-play
      // on the callee's side for some reason. This fixes it.
      const playIfPaused = () => {
        if (el.paused) {
          console.log("incoming media not playing, will .play() it");
          el.play();
        } else {
          console.log("incoming media is playing");
          clearInterval(intervalId);
        }
      };
      const intervalId = setInterval(playIfPaused, 100);
      playIfPaused();
    }
  }, [mediaStream, videoRef, audioRef]);

  const [fallBackToAudioEl, setFallBackToAudioEl] = useState(false);
  useEffect(() => {
    if (videoRef.current == null || audioRef.current == null) {
      throw new Error(
        "cannot start fallback audio element media playback: media elements are not mounted",
      );
    }
    const video = videoRef.current;
    const audio = audioRef.current;

    const checkReadyState = () => {
      setFallBackToAudioEl(
        video.readyState < audio.readyState &&
          audio.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA,
      );
    };

    // `loadeddata` corresponds to `HTMLMediaElement.HAVE_CURRENT_DATA`.
    checkReadyState();
    audio.addEventListener("loadeddata", checkReadyState);
    video.addEventListener("loadeddata", checkReadyState);
    return () => {
      audio.removeEventListener("loadeddata", checkReadyState);
      video.removeEventListener("loadeddata", checkReadyState);
    };
  }, [mediaStream, videoRef, audioRef]);

  return (
    <div style={containerStyle}>
      <video
        muted={fallBackToAudioEl}
        poster="data:image/gif;base64,R0lGODlhAQABAIAAAP///wAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw=="
        width="100%"
        height="100%"
        autoPlay
        playsInline
        ref={videoRef}
      />
      <audio
        muted={!fallBackToAudioEl}
        style={{ display: "none" }}
        autoPlay
        playsInline
        ref={audioRef}
      />
    </div>
  );
}
