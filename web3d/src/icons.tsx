import type { ReactNode } from "react";
export function WindowMark() {
  return (
    <span className="window-mark" aria-hidden="true">
      <i />
      <i />
      <i />
      <i />
    </span>
  );
}
export function Icon({ name }: { name: string }) {
  const paths: Record<string, ReactNode> = {
    play: <path d="m9 5 11 7-11 7Z" />,
    arrow: (
      <>
        <path d="M5 12h14M13 6l6 6-6 6" />
      </>
    ),
    close: <path d="m6 6 12 12M18 6 6 18" />,
    moon: <path d="M20 15a8 8 0 0 1-11-11 8 8 0 1 0 11 11Z" />,
    sun: (
      <>
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5" />
      </>
    ),
    snow: (
      <path d="M12 2v20M3.3 7l17.4 10M3.3 17 20.7 7M9 4l3 3 3-3M9 20l3-3 3 3" />
    ),
    settings: <path d="M4 6h16M4 12h16M4 18h16M8 3v6m8 0v6m-6 0v6" />,
    pause: <path d="M8 5v14M16 5v14" />,
    check: <path d="m5 12 4 4L19 6" />,
    sound: (
      <>
        <path d="M4 9h4l5-4v14l-5-4H4Z" />
        <path d="M17 8a6 6 0 0 1 0 8" />
      </>
    ),
  };
  return (
    <svg
      className="icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name] ?? paths.arrow}
    </svg>
  );
}
