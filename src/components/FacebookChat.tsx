"use client";
import { useState } from "react";

// Энэ файлд YOUR_PAGE_ID-г өөрийн Facebook Page ID-р солино уу
const FB_PAGE_ID = "YOUR_PAGE_ID";
const FB_MESSENGER_URL = `https://m.me/${FB_PAGE_ID}`;

export default function FacebookChat() {
  const [hovered, setHovered] = useState(false);

  return (
    <a
      href={FB_MESSENGER_URL}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Facebook Messenger-ээр холбоо барих"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        position: "fixed",
        bottom: 28,
        right: 28,
        zIndex: 100,
        width: 52,
        height: 52,
        borderRadius: "50%",
        background: hovered
          ? "linear-gradient(135deg, #0069d9 0%, #00b0f0 100%)"
          : "linear-gradient(135deg, #0084FF 0%, #00C6FF 100%)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        boxShadow: hovered
          ? "0 8px 32px rgba(0,132,255,0.5)"
          : "0 4px 20px rgba(0,132,255,0.35)",
        transform: hovered ? "scale(1.08)" : "scale(1)",
        transition: "all 0.2s ease",
        textDecoration: "none",
      }}
    >
      {/* Messenger logo */}
      <svg width="26" height="26" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path
          d="M14 2C7.373 2 2 7.06 2 13.32c0 3.28 1.395 6.23 3.641 8.33V26l4.283-2.35c1.143.315 2.355.49 3.612.49 6.627 0 12-5.06 12-11.32C25.536 7.06 20.627 2 14 2z"
          fill="white"
        />
        <path
          d="M15.273 17.08l-3.055-3.27-5.963 3.27 6.56-6.96 3.13 3.27 5.89-3.27-6.562 6.96z"
          fill="#0084FF"
        />
      </svg>
    </a>
  );
}
