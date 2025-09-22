const containerStyle = {
  imageRendering: "crisp-edges" as "crisp-edges",
  width: "100%",
  height: "100%",
};

interface Props {
  videoRef: React.RefObject<HTMLVideoElement | null>;
}

export default function FullscreenVideo({ videoRef }: Props) {
  return (
    <div style={containerStyle}>
      <video width="100%" height="100%" autoPlay playsInline ref={videoRef} />
    </div>
  );
}
