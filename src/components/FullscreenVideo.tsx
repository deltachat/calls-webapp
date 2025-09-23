const containerStyle = {
  imageRendering: "crisp-edges" as "crisp-edges",
  width: "100%",
  height: "100%",
};

interface Props {
  videoRef: React.RefObject<HTMLAudioElement | null>;
}

export default function FullscreenVideo({ videoRef }: Props) {
  return (
    <div style={containerStyle}>
      <audio autoPlay playsInline ref={videoRef} />
    </div>
  );
}
