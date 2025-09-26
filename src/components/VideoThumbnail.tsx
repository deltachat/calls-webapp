const containerStyle = {
  position: "absolute" as "absolute",
  right: "15px",
  top: "15px",
  height: "100px",
  width: "100px",
  zIndex: 1,
  imageRendering: "crisp-edges" as "crisp-edges",
  borderRadius: "5px",
  boxShadow:
    "rgba(0, 0, 0, 0.29) 0px 2px 8px 0px, rgba(0, 0, 0, 0.28) 0px 2px 8px 0px",
};

interface Props {
  videoRef: React.RefObject<HTMLVideoElement | null>;
}

export default function VideoThumbnail({ videoRef }: Props) {
  return (
    <div style={containerStyle}>
      <video
        poster="data:image/gif;base64,R0lGODlhAQABAIAAAP///wAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw=="
        style={{
          borderRadius: "5px",
          objectFit: "cover",
          transform: "scaleX(-1)",
        }}
        width="100%"
        height="100%"
        muted
        autoPlay
        playsInline
        ref={videoRef}
      />
    </div>
  );
}
