import MaterialSymbolsCallEnd from "~icons/material-symbols/call-end";

import Button from "~/components/Button";

const containerStyle = {
  color: "white",
  background: "#cb2233",
  borderRadius: "50%",
  fontSize: "1.5em",
};

interface Props {
  [key: string]: any;
}

export default function EndCallButton({ ...props }: Props) {
  props.style = { ...containerStyle, ...(props.style || {}) };
  return (
    <Button
      aria-label="End call"
      title="End call"
      style={containerStyle}
      {...props}
    >
      <MaterialSymbolsCallEnd />
    </Button>
  );
}
