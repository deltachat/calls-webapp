interface Props {
  url: string;
  [key: string]: any;
}

export default function AvatarImage({ url, ...props }: Props) {
  props.style = {
    borderRadius: "50%",
    backgroundImage: `url(${url})`,
    backgroundSize: "cover",
    backgroundPosition: "center",
    ...(props.style || {}),
  };
  return <div {...props}></div>;
}
