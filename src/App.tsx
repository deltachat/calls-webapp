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

  const [remoteReportedMutedState, setRemoteReportedMutedState] = useState<{
    audioEnabled: boolean;
    videoEnabled: boolean;
  } | null>(null);

  const [isRelayUsed, setIsRelayUsed] = useState<null | boolean>(null);

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

  const [incStream, setIncStream] = useState<MediaStream | null>(null);
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

      setIncStream(incStream);
    };
    return new CallsManager(
      outStreamPromise,
      onIncStream,
      setState,
      setRemoteReportedMutedState,
      setIsRelayUsed,
    );
  }, [outStreamPromise, disableVideoCompletely]);

  useEffect(() => {
    // For debugging.
    (window as any).__callsManager = manager;
  }, [manager]);

  const [incStreamVideoTracks, setIncStreamVideoTracks] = useState<
    undefined | MediaStreamTrack[]
  >(undefined);
  useEffect(() => {
    if (incStream == null) {
      setIncStreamHasVideo(undefined);
      return;
    }

    const checkTracks = () => {
      setIncStreamVideoTracks(incStream.getVideoTracks());
    };
    checkTracks();

    incStream.addEventListener("addtrack", checkTracks);
    incStream.addEventListener("removetrack", checkTracks);
    return () => {
      incStream.removeEventListener("addtrack", checkTracks);
      incStream.removeEventListener("removetrack", checkTracks);
    };
  }, [incStream]);
  const [incStreamHasVideo, setIncStreamHasVideo] = useState<
    undefined | boolean
  >(undefined);
  useEffect(() => {
    if (incStreamVideoTracks == undefined) {
      setIncStreamHasVideo(undefined);
      return;
    }

    const checkMuted = () => {
      setIncStreamHasVideo(incStreamVideoTracks.some((t) => !t.muted));

      console.log(
        "incStream.videoTracks() muted states:",
        incStreamVideoTracks.map((t) => t.muted),
      );
    };
    checkMuted();

    incStreamVideoTracks.forEach((t) => {
      t.addEventListener("mute", checkMuted);
      t.addEventListener("unmute", checkMuted);
    });
    return () => {
      incStreamVideoTracks.forEach((t) => {
        t.removeEventListener("mute", checkMuted);
        t.removeEventListener("unmute", checkMuted);
      });
    };
  }, [incStreamVideoTracks]);

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

      manager.reportMutedStateToRemote({
        audioEnabled: isOutAudioEnabled,
        videoEnabled: isOutVideoEnabled,
      });
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

  useEffect(() => {
    if (state === "ringing") {
      const stopSound = startRingingTone();
      return stopSound;
    }
  }, [state]);

  const showIncVideo =
    state === "in-call" &&
    incStreamHasVideo &&
    // `incStreamHasVideo === true` does not always mean that the remote
    // is actually sending any non-black frames to us.
    // Namely `track.enabled = false` makes us send black frames,
    // but does not set `track.muted === true` on the remote side.
    // Also, doing `replaceTrack(null)` only sets `track.muted === true`
    // with a delay of ~1.5s on Chromium 144,
    // resuling in the last frame you sent to the remote being frozen for them.
    // On top of that, sometimes `replaceTrack(null)` does not change
    // `track.muted` on the remote side at all.
    // See
    // - https://github.com/deltachat/calls-webapp/issues/62.
    // - https://github.com/deltachat/calls-webapp/pull/84#issuecomment-3805147182.
    // - https://github.com/deltachat/calls-webapp/issues/50.
    (remoteReportedMutedState == undefined ||
      remoteReportedMutedState.videoEnabled);
  const containerStyle = {
    display: state === "in-call" ? "block" : "none",
    position: "absolute",
    top: 0,
    width: "100%",
    // Otherwise there is vertical scroll. IDK if this is right,
    // but does the job.
    overflow: "hidden",
    height: "100%",
  } as const;

  const toggleAudioLabel = isOutAudioEnabled
    ? "Mute microphone"
    : "Unmute microphone";
  const toggleVideoLabel =
    isOutVideoEnabled && outStreamHasVideoTrack
      ? "Stop camera"
      : "Start camera";

  const buttonsStyle = {
    color: "white",
    borderRadius: "50%",
    fontSize: "1.5em",
    margin: "0.25em 0.625em",
  };

  return (
    <div style={{ height: "100vh", overflow: "hidden" }}>
      <div style={containerStyle}>
        <FullscreenVideo mediaStream={incStream} hide={!showIncVideo} />
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
          display: showIncVideo ? "none" : "flex",
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

      {process.env.NODE_ENV !== "production" && isRelayUsed != null && (
        <div role="status" className="isRelayUsedText">
          {isRelayUsed ? "non-P2P" : "P2P"}
        </div>
      )}

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
        {/* If `enableVideoInitially`, which is the case for calls
        that have been started as video (and not only-audio) calls,
        then we want to make it clear to the user
        that they can't enable the camera. */}
        {(outStreamHasVideoTrack || enableVideoInitially) && (
          <Button
            aria-label={toggleVideoLabel}
            title={toggleVideoLabel}
            disabled={!outStreamHasVideoTrack}
            onClick={() => setIsOutVideoEnabled((v) => !v)}
            style={buttonsStyle}
          >
            {/* TODO `isOutVideoEnabled` should never be `true`
            if `outStreamHasVideoTrack === false`? */}
            {isOutVideoEnabled && outStreamHasVideoTrack ? (
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

/**
 * @returns "stop" function
 */
function startRingingTone(): () => void {
  const ctx = new AudioContext({ latencyHint: "playback" });

  // Start a little ahead to avoid glitches.
  const startTime = ctx.currentTime + 0.05;

  // https://en.wikipedia.org/wiki/Call-progress_tone#ETSI_guidelines_(EU)
  const frequency = 425;
  const onTime = 1;
  const offTime = 4;
  const period = onTime + offTime;
  // This is not in the guidelines, but this removes glitches.
  const fadeTime = 1 / frequency;

  const oscillator = ctx.createOscillator();
  oscillator.type = "sine";
  oscillator.frequency.value = frequency;
  oscillator.start(startTime);

  const generalGain = ctx.createGain();
  generalGain.gain.value = 0.2;

  const periodicGain = ctx.createGain();
  periodicGain.gain.value = 0;
  let lastWaveInd = 0;
  const addPeriodicGainWave = () => {
    const onStartTime = lastWaveInd * period + startTime;
    const onEndTime = onStartTime + onTime;
    // The gain is at 0 currently.
    periodicGain.gain.setValueAtTime(0, onStartTime);
    periodicGain.gain.linearRampToValueAtTime(1, onStartTime + fadeTime);

    periodicGain.gain.setValueAtTime(1, onEndTime);
    periodicGain.gain.linearRampToValueAtTime(0, onEndTime + fadeTime);
    lastWaveInd++;
  };
  // Probably not the nicest way, we could solve this
  // with another oscillator, but it works.
  addPeriodicGainWave();
  addPeriodicGainWave();
  addPeriodicGainWave();
  addPeriodicGainWave();
  const intervalId = setInterval(addPeriodicGainWave, period * 1000);

  oscillator
    .connect(generalGain)
    .connect(periodicGain)
    .connect(ctx.destination);

  return () => {
    clearInterval(intervalId);

    const now = ctx.currentTime;
    const fadeoutStart = now + 0.05;
    const fadeoutEnd = fadeoutStart + fadeTime;
    generalGain.gain.setValueAtTime(generalGain.gain.value, fadeoutStart);
    generalGain.gain.linearRampToValueAtTime(0, fadeoutEnd);

    setTimeout(
      () => {
        ctx.close();
      },
      (fadeoutEnd - now) * 1000,
    );
  };
}
