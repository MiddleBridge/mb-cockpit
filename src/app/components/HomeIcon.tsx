"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function HomeIcon() {
  const router = useRouter();
  const [showMbankText, setShowMbankText] = useState(false);

  const handleHomeClick = () => {
    router.push("/");
  };

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={handleHomeClick}
        className="p-2 rounded-lg bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 transition-colors flex-shrink-0"
        aria-label="Go to home"
        title="Go to home"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-white"
        >
          <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
          <polyline points="9 22 9 12 15 12 15 22" />
        </svg>
      </button>
      
      <a
        href="https://mb-2-0.vercel.app/"
        target="_blank"
        rel="noopener noreferrer"
        className="p-2 rounded-lg bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 transition-colors flex-shrink-0"
        aria-label="Open MB 2.0"
        title="Open MB 2.0"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-white"
        >
          <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
          <polyline points="15 3 21 3 21 9" />
          <line x1="10" y1="14" x2="21" y2="3" />
        </svg>
      </a>
      
      <a
        href="https://www.middlebridge.pl"
        target="_blank"
        rel="noopener noreferrer"
        className="p-2 rounded-lg bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 transition-colors flex-shrink-0"
        aria-label="Open Middle Bridge"
        title="Open Middle Bridge"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-white"
        >
          <circle cx="12" cy="12" r="10" />
          <line x1="2" y1="12" x2="22" y2="12" />
          <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
        </svg>
      </a>
      
      <div className="relative flex items-center">
        <a
          href="https://online.mbank.pl/connect/Login"
          target="_blank"
          rel="noopener noreferrer"
          className="p-2 rounded-lg bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 transition-colors flex-shrink-0"
          aria-label="mBank Login"
          title="mBank Login"
          onMouseEnter={() => setShowMbankText(true)}
          onMouseLeave={() => setShowMbankText(false)}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-white"
          >
            <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
            <line x1="1" y1="10" x2="23" y2="10" />
          </svg>
        </a>
        {showMbankText && (
          <span className="ml-2 text-white text-sm whitespace-nowrap">
            71842348
          </span>
        )}
      </div>
    </div>
  );
}

