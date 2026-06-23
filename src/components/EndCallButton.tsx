import MaterialSymbolsCallEnd from "~icons/material-symbols/call-end";

import Button from "~/components/Button";

const containerStyle = {
  background: "#f01d2c",
};

interface Props {
  [key: string]: any;
}

export default function EndCallButton({ ...props }: Props) {
  props.style = { ...(props.style || {}), ...containerStyle };
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
