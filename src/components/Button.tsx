import style from "./Button.module.css";

interface Props {
  children: React.ReactNode;
  [key: string]: any;
}

export default function Button({ children, ...props }: Props) {
  return (
    <div className={style.btn} {...props}>
      {children}
    </div>
  );
}
