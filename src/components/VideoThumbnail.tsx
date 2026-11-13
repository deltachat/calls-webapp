const containerStyle = {
  // To be on top of the avatar circle, if the screen is really short.
  position: "relative" as const,
  zIndex: 1,

  float: "right" as const,
  margin: "15px",
  height: "100px",
  width: "100px",
  imageRendering: "crisp-edges" as "crisp-edges",
  borderRadius: "5px",
  boxShadow:
    "rgba(0, 0, 0, 0.29) 0px 2px 8px 0px, rgba(0, 0, 0, 0.28) 0px 2px 8px 0px",
};

interface Props {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  /**
   * Whether the video shows a shared screen rather than the camera.
   * A screen must not be mirrored or cropped.
   */
  isScreen?: boolean;
}

export default function VideoThumbnail({ videoRef, isScreen = false }: Props) {
  return (
    <div style={containerStyle}>
      <video
        poster="data:image/gif;base64,R0lGODlhAQABAIAAAP///wAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw=="
        style={{
          borderRadius: "5px",
          objectFit: isScreen ? "contain" : "cover",
          transform: isScreen ? undefined : "scaleX(-1)",
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
