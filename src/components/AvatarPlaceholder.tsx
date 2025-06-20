import MaterialSymbolsPerson from "~icons/material-symbols/person";

import AvatarCircle from "~/components/AvatarCircle";

interface Props {
  [key: string]: any;
}

export default function AvatarPlaceholder({ ...props }: Props) {
  return (
    <AvatarCircle style={{ padding: "0.2em", fontSize: "5em" }} {...props}>
      <MaterialSymbolsPerson />
    </AvatarCircle>
  );
}
