import type React from "react";
import style from "./Button.module.css";

type Props = {
  children: React.ReactNode;
} & React.ButtonHTMLAttributes<HTMLButtonElement>;

export default function Button({ children, ...props }: Props) {
  return (
    <button className={style.btn} {...props}>
      {children}
    </button>
  );
}
