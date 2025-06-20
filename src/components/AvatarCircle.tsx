const containerStyle = {
  display: "inline-flex",
  flexDirection: "row" as "row",
  alignItems: "center",
  padding: "0.5em",
  color: "white",
  background: "#c8c7cd",
  borderRadius: "50%",
  fontSize: "1.5em",
};

interface Props {
  children: React.ReactNode;
  [key: string]: any;
}

export default function AvatarCircle({ children, ...props }: Props) {
  props.style = { ...containerStyle, ...(props.style || {}) };
  return (
    <div style={containerStyle} {...props}>
      {children}
    </div>
  );
}
