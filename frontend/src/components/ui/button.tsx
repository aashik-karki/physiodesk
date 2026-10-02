import { cn } from "@/lib/cn";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "danger-ghost";
type Size = "sm" | "md" | "lg";

const VARIANTS: Record<Variant, string> = {
  primary: "bg-primary text-white shadow-sm hover:brightness-95",
  secondary: "border border-border bg-surface text-ink hover:bg-canvas",
  ghost: "text-muted hover:bg-canvas hover:text-ink",
  danger: "bg-danger text-white hover:brightness-95",
  "danger-ghost": "text-muted hover:bg-danger-soft hover:text-danger",
};

// Sizes are variants rather than extra classes: Tailwind doesn't let a later
// class like "h-8" reliably override a built-in "h-10", so we pick one up front.
const SIZES: Record<Size, string> = {
  sm: "h-8 px-3 text-[13px]",
  md: "h-10 px-4 text-sm",
  lg: "h-11 px-5 text-sm",
};
export function Button({ variant = "primary", size = "md", className, ...props }:
  React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size }) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-lg font-medium transition",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
        "disabled:cursor-not-allowed disabled:opacity-50",
        SIZES[size], VARIANTS[variant], className,
      )}
      {...props}
    />
  );
}