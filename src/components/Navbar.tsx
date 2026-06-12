"use client";
import { useState, useEffect } from "react";
import Link from "next/link";

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", handler, { passive: true });
    return () => window.removeEventListener("scroll", handler);
  }, []);

  return (
    <>
      <nav
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          zIndex: 50,
          height: 64,
          transition: "background 0.35s ease, box-shadow 0.35s ease, border-color 0.35s ease",
          background: scrolled ? "rgba(255,255,255,0.97)" : "rgba(255,255,255,0)",
          backdropFilter: scrolled ? "blur(20px)" : "none",
          borderBottom: scrolled ? "1px solid #e8f5f1" : "1px solid transparent",
          boxShadow: scrolled ? "0 1px 24px rgba(7,230,174,0.06)" : "none",
        }}
      >
        <div style={{
          maxWidth: 1200,
          margin: "0 auto",
          padding: "0 24px",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}>
          {/* Logo */}
          <Link href="/" style={{ textDecoration: "none", display: "flex", alignItems: "center" }}>
            <span style={{ position: "relative", display: "inline-flex", alignItems: "center" }}>
              <span style={{
                fontSize: 20,
                fontWeight: 800,
                letterSpacing: "-0.5px",
                color: "#07e6ae",
              }}>
                OLULA
              </span>
              <span style={{
                position: "absolute",
                top: 1,
                right: -4,
                width: 6,
                height: 6,
                borderRadius: "50%",
                background: "#07e6ae",
                boxShadow: "0 0 8px rgba(7,230,174,0.9)",
              }} />
            </span>
          </Link>


          {/* Right actions */}
          <div className="nav-desktop" style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <a
              href="https://m.me/992480210614049"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "8px 14px",
                borderRadius: 8,
                fontSize: 14,
                fontWeight: 500,
                color: scrolled ? "#374151" : "rgba(255,255,255,0.9)",
                textDecoration: "none",
                transition: "all 0.2s",
              }}
            >
              <svg width="16" height="16" viewBox="0 0 28 28" fill="currentColor">
                <path d="M14 2C7.373 2 2 7.06 2 13.32c0 3.28 1.395 6.23 3.641 8.33V26l4.283-2.35c1.143.315 2.355.49 3.612.49 6.627 0 12-5.06 12-11.32C25.536 7.06 20.627 2 14 2z"/>
              </svg>
              OLULA туслах
            </a>
            <Link
              href="/login"
              style={{
                padding: "9px 22px",
                borderRadius: 10,
                fontSize: 14,
                fontWeight: 700,
                background: "#07e6ae",
                color: "#0a2e24",
                textDecoration: "none",
                letterSpacing: "-0.2px",
                transition: "all 0.2s",
                boxShadow: "0 2px 16px rgba(7,230,174,0.25)",
              }}
            >
              Нэвтрэх
            </Link>
          </div>

          {/* Mobile burger */}
          <button
            className="nav-burger"
            onClick={() => setMobileOpen(!mobileOpen)}
            style={{
              display: "none",
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: 8,
              color: scrolled ? "#0a2e24" : "#ffffff",
            }}
          >
            <svg width="22" height="22" viewBox="0 0 22 22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              {mobileOpen
                ? <><line x1="4" y1="4" x2="18" y2="18"/><line x1="18" y1="4" x2="4" y2="18"/></>
                : <><line x1="3" y1="6" x2="19" y2="6"/><line x1="3" y1="11" x2="19" y2="11"/><line x1="3" y1="16" x2="19" y2="16"/></>
              }
            </svg>
          </button>
        </div>
      </nav>

      {/* Mobile menu */}
      {mobileOpen && (
        <div style={{
          position: "fixed",
          top: 64,
          left: 0,
          right: 0,
          zIndex: 49,
          background: "rgba(255,255,255,0.98)",
          backdropFilter: "blur(20px)",
          borderBottom: "1px solid #e8f5f1",
          padding: "8px 16px 16px",
        }}>
          {/* OLULA туслах — mobile */}
          <a
            href="https://m.me/992480210614049"
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => setMobileOpen(false)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "13px 16px",
              fontSize: 15,
              fontWeight: 500,
              color: "#374151",
              borderRadius: 8,
              textDecoration: "none",
            }}
          >
            <svg width="18" height="18" viewBox="0 0 28 28" fill="currentColor">
              <path d="M14 2C7.373 2 2 7.06 2 13.32c0 3.28 1.395 6.23 3.641 8.33V26l4.283-2.35c1.143.315 2.355.49 3.612.49 6.627 0 12-5.06 12-11.32C25.536 7.06 20.627 2 14 2z"/>
            </svg>
            OLULA туслах
          </a>
          <div style={{ height: 1, background: "#e8f5f1", margin: "8px 0" }} />
          <Link
            href="/login"
            onClick={() => setMobileOpen(false)}
            style={{
              display: "block",
              padding: "13px 16px",
              background: "#07e6ae",
              color: "#0a2e24",
              borderRadius: 10,
              fontSize: 15,
              fontWeight: 700,
              textDecoration: "none",
              textAlign: "center",
            }}
          >
            Нэвтрэх
          </Link>
        </div>
      )}

      <style>{`
        @media (max-width: 768px) {
          .nav-desktop { display: none !important; }
          .nav-burger { display: flex !important; }
        }
      `}</style>
    </>
  );
}
