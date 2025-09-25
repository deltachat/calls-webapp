// Constants
const CODEC_QUALITY_MAP = {
  opus: " (High Quality)",
  G722: " (Good Quality)",
  VP8: " (WebRTC Standard)",
  VP9: " (Efficient)",
  H264: " (Compatible)",
  AV1: " (Modern/Efficient)",
} as const;

const MEDIA_ICONS = {
  audio: "🔊",
  video: "📹",
  default: "📊",
} as const;

const DYNAMIC_PORT = 9;

interface SessionInfo {
  version?: string;
  name?: string;
  origin?: {
    sessId: string;
    sessVersion: string;
    address: string;
  };
}

interface MediaConnection {
  address: string;
}

interface MediaAttributes {
  [key: string]: string | boolean;
}

interface MediaInfo {
  type: string;
  port: number;
  protocol: string;
  formats: string[];
  attributes: MediaAttributes;
  connection?: MediaConnection;
}

interface ICECandidate {
  foundation: string;
  component: string;
  protocol: string;
  priority: number;
  address: string;
  port: number;
  type: string | null;
}

interface ICECandidates {
  host: ICECandidate[];
  srflx: ICECandidate[];
  relay: ICECandidate[];
}

interface ICECredentials {
  ufrag?: string;
  password?: string;
}

interface ICEInfo {
  candidates: ICECandidates;
  credentials: ICECredentials;
}

interface SecurityInfo {
  fingerprint?: {
    algorithm: string;
    fingerprint: string;
  };
}

interface Codec {
  payloadType: number;
  name: string;
  clockRate: number;
  channels: number;
}

interface CodecInfo {
  audio: Codec[];
  video: Codec[];
}

interface SDPSummary {
  session: SessionInfo;
  media: MediaInfo[];
  ice: ICEInfo;
  security: SecurityInfo;
  codecs: CodecInfo;
}

function parseSDP(sdpContent: string): SDPSummary | null {
  if (!sdpContent || typeof sdpContent !== "string") {
    console.log("Invalid SDP content");
    return null;
  }
  const lines = sdpContent
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line);

  const summary: SDPSummary = {
    session: {},
    media: [],
    ice: {
      candidates: { host: [], srflx: [], relay: [] },
      credentials: {},
    },
    security: {},
    codecs: { audio: [], video: [] },
  };

  let currentMedia: MediaInfo | null = null;

  for (const line of lines) {
    const [type, value] = line.split("=", 2);

    switch (type) {
      case "v":
        summary.session.version = value;
        break;

      case "o":
        const [, sessId, sessVersion, , , address] = value.split(" ");
        summary.session.origin = { sessId, sessVersion, address };
        break;

      case "s":
        summary.session.name = value === "-" ? "Default Session" : value;
        break;

      case "m":
        const [mediaType, port, protocol, ...formats] = value.split(" ");
        currentMedia = {
          type: mediaType,
          port: parseInt(port),
          protocol,
          formats,
          attributes: {},
        };
        summary.media.push(currentMedia);
        break;

      case "c":
        if (currentMedia) {
          const [, , address] = value.split(" ");
          currentMedia.connection = { address };
        }
        break;

      case "a":
        parseAttribute(value, summary, currentMedia);
        break;
    }
  }

  return summary;
}

function parseAttribute(
  value: string,
  summary: SDPSummary,
  currentMedia: MediaInfo | null,
): void {
  if (value.startsWith("candidate:")) {
    parseCandidateLine(value, summary.ice.candidates);
  } else if (value.startsWith("ice-ufrag:")) {
    summary.ice.credentials.ufrag = value.slice(10); // 'ice-ufrag:'.length
  } else if (value.startsWith("ice-pwd:")) {
    summary.ice.credentials.password = value.slice(8); // 'ice-pwd:'.length
  } else if (value.startsWith("fingerprint:")) {
    const [algorithm, fingerprint] = value
      .split("fingerprint:")[1]
      .split(" ", 2);
    summary.security.fingerprint = { algorithm, fingerprint };
  } else if (value.startsWith("rtpmap:")) {
    parseRtpMap(value, summary.codecs, currentMedia?.type);
  } else if (currentMedia) {
    // Store other attributes in current media
    const [key, attrValue] = value.split(":", 2);
    currentMedia.attributes[key] = attrValue || true;
  }
}

function parseCandidateLine(
  candidateLine: string,
  candidates: ICECandidates,
): void {
  // a=candidate:3104393440 1 udp 2113937151 192.168.178.55 48979 typ host generation 0 network-cost 999
  const parts = candidateLine.split(" ");

  // Basic validation - ensure we have minimum required parts
  if (parts.length < 6) {
    console.warn("Invalid candidate line format:", candidateLine);
    return;
  }

  const candidate: ICECandidate = {
    foundation: parts[0].split(":")[1] || "",
    component: parts[1] || "",
    protocol: parts[2] || "",
    priority: parseInt(parts[3], 10) || 0,
    address: parts[4] || "",
    port: parseInt(parts[5], 10) || 0,
    type: null,
  };

  // Find candidate type
  const typIndex = parts.findIndex((part: string) => part === "typ");
  if (typIndex !== -1 && typIndex + 1 < parts.length) {
    candidate.type = parts[typIndex + 1];

    // Use type-safe assignment with validation
    const candidateType = candidate.type as keyof ICECandidates;
    if (candidateType in candidates) {
      candidates[candidateType].push(candidate);
    }
  }
}

function parseRtpMap(
  rtpMapLine: string,
  codecs: CodecInfo,
  mediaType: string | undefined,
): void {
  // a=rtpmap:111 opus/48000/2
  const [payloadType, codecInfo] = rtpMapLine.split("rtpmap:")[1].split(" ");
  const [codecName, clockRate, channels] = codecInfo.split("/");

  const codec: Codec = {
    payloadType: parseInt(payloadType),
    name: codecName,
    clockRate: parseInt(clockRate),
    channels: channels ? parseInt(channels) : 1,
  };

  if (mediaType === "audio") {
    codecs.audio.push(codec);
  } else if (mediaType === "video") {
    codecs.video.push(codec);
  }
}

function formatSummary(context: string, summary: SDPSummary): string {
  const output = [];

  output.push(`📞 ${context}`);
  output.push(`SDP Call Information Summary`);
  output.push("=".repeat(40));
  output.push("");

  // Session Information
  output.push("🔷 Session Information:");
  output.push(` Version: ${summary.session.version || "Unknown"}`);
  output.push(` Name: ${summary.session.name || "Unknown"}`);
  if (summary.session.origin) {
    output.push(` Session ID: ${summary.session.origin.sessId}`);
    output.push(` Origin Address: ${summary.session.origin.address}`);
  }
  output.push("");

  // Network Connectivity
  output.push("🌐 Network Connectivity (ICE Candidates):");
  const { candidates } = summary.ice;

  const candidateTypes = [
    { key: "host" as const, icon: "🏠", label: "Local Network (Host)" },
    { key: "srflx" as const, icon: "🌍", label: "Public IP (STUN)" },
    { key: "relay" as const, icon: "🔄", label: "TURN Relay" },
  ];

  candidateTypes.forEach(({ key, icon, label }) => {
    const candidateList = candidates[key];
    if (candidateList.length > 0) {
      output.push(` ${icon} ${label}: ${candidateList.length} candidate(s)`);
      candidateList.forEach((c) => {
        output.push(` • ${c.address}:${c.port} (${c.protocol.toUpperCase()})`);
      });
    }
  });

  if (candidates.relay.length === 0) {
    output.push(` ❌ TURN Relay: No relay candidates found`);
    output.push(` This may cause connection issues in restrictive networks`);
  }
  output.push("");

  // Connection Assessment
  output.push("📊 Connection Assessment:");
  const connectionTypes = {
    relay: candidates.relay.length > 0,
    publicIP: candidates.srflx.length > 0,
    localIP: candidates.host.length > 0,
  };

  const assessments = [
    {
      condition:
        connectionTypes.relay &&
        connectionTypes.publicIP &&
        connectionTypes.localIP,
      status: " ✅ Excellent: All connection types available",
      details: [],
    },
    {
      condition: connectionTypes.publicIP && connectionTypes.localIP,
      status: " ⚠️ Good: Direct connections possible, but no TURN relay",
      details: [" May fail in restrictive corporate/university networks"],
    },
    {
      condition: connectionTypes.localIP,
      status: " ❌ Limited: Only local network connectivity",
      details: [" Likely to fail across different networks"],
    },
    {
      condition: true, // fallback
      status: " 🚫 Poor: No valid network candidates found",
      details: [],
    },
  ];

  const assessment = assessments.find((a) => a.condition)!;
  output.push(assessment.status);
  assessment.details.forEach((detail) => output.push(detail));
  output.push("");

  // Media Streams
  output.push("🎥 Media Streams:");
  summary.media.forEach((media) => {
    const icon =
      MEDIA_ICONS[media.type as keyof typeof MEDIA_ICONS] ||
      MEDIA_ICONS.default;
    output.push(` ${icon} ${media.type.toUpperCase()}:`);
    output.push(
      ` Port: ${media.port === DYNAMIC_PORT ? `Dynamic (${DYNAMIC_PORT} = placeholder)` : media.port}`,
    );
    output.push(` Protocol: ${media.protocol}`);
    output.push(` Connection: ${media.connection?.address || "Not specified"}`);

    if (media.attributes.sendrecv) {
      output.push(` Direction: Bidirectional (send & receive)`);
    }
    output.push("");
  });

  // Codecs
  if (summary.codecs.audio.length > 0) {
    output.push("🎵 Audio Codecs:");
    summary.codecs.audio.forEach((codec) => {
      const quality =
        CODEC_QUALITY_MAP[codec.name as keyof typeof CODEC_QUALITY_MAP] ||
        (codec.name.includes("PCM") ? " (Basic Quality)" : "");
      output.push(
        ` • ${codec.name}${quality}: ${codec.clockRate}Hz, ${codec.channels} channel(s)`,
      );
    });
    output.push("");
  }

  if (summary.codecs.video.length > 0) {
    output.push("📽️ Video Codecs:");
    summary.codecs.video.forEach((codec) => {
      const quality =
        CODEC_QUALITY_MAP[codec.name as keyof typeof CODEC_QUALITY_MAP] || "";
      output.push(` • ${codec.name}${quality}: ${codec.clockRate}Hz`);
    });
    output.push("");
  }

  // Security
  if (summary.security.fingerprint) {
    output.push("🔒 Security:");
    output.push(
      ` DTLS Fingerprint: ${summary.security.fingerprint.algorithm.toUpperCase()}`,
    );
    output.push(` ${summary.security.fingerprint.fingerprint}`);
    output.push("");
  }

  // ICE Credentials
  if (summary.ice.credentials.ufrag) {
    output.push("🔑 ICE Authentication:");
    output.push(` Username Fragment: ${summary.ice.credentials.ufrag}`);
    // don't show password in output
    output.push(
      ` Password: ${summary.ice.credentials.password ? "[PRESENT]" : "[MISSING]"}`,
    );
    output.push("");
  }

  return output.join("\n");
}

export function logSDP(context: string, sdpContent: string): void {
  if (!sdpContent.trim()) {
    console.error(context, "No SDP content provided");
    return;
  }

  try {
    const summary = parseSDP(sdpContent);
    if (summary) {
      console.log(formatSummary(context, summary));
    }
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    console.error("Error parsing SDP:", errorMessage);
  }
}
