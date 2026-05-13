import { Play, Loader2 } from "lucide-react";

export const StreamLoader = ({ message = "Streaming…" }: { message?: string }) => {
  return (
    <div className="absolute inset-0 grid place-items-center overflow-hidden rounded-2xl">
      <div className="absolute inset-0 shimmer opacity-80" />
      <div className="absolute inset-0 pulse-glow rounded-2xl" />
      <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-primary/20" />
      <div className="relative flex flex-col items-center gap-3 text-foreground">
        <span className="grid place-items-center w-16 h-16 rounded-full glass-strong shadow-glow">
          <Play className="w-7 h-7 fill-primary text-primary animate-pulse" />
        </span>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" /> {message}
        </div>
      </div>
    </div>
  );
};
