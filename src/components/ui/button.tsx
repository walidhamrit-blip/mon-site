import * as React from "react";
import { cn } from "@/lib/utils";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "outline" | "ghost" | "accent";
  size?: "sm" | "md" | "lg" | "icon";
}

const styles = {
  default: "bg-[var(--accent)] text-[var(--accent-foreground)] hover:bg-[var(--accent-hover)]",
  accent: "bg-[var(--accent)] text-[var(--accent-foreground)] hover:bg-[var(--accent-hover)] shadow-md",
  outline: "border border-[var(--border)] bg-transparent hover:bg-[var(--secondary)]",
  ghost: "hover:bg-[var(--secondary)]",
};

const sizes = {
  sm: "h-9 px-4 text-sm rounded-full",
  md: "h-11 px-6 text-[15px] rounded-full",
  lg: "h-14 px-8 text-base rounded-full",
  icon: "h-10 w-10 rounded-full",
};

export function Button({ className, variant = "default", size = "md", ...props }: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 font-medium transition-all duration-200 disabled:opacity-50 disabled:pointer-events-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] cursor-pointer active:scale-[0.98]",
        styles[variant],
        sizes[size],
        className
      )}
      {...props}
    />
  );
}
