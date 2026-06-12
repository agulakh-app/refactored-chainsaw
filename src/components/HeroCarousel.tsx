"use client";
import { useState, useEffect, useCallback } from "react";
import Link from "next/link";

// ── Баннер дата ───────────────────────────────────────────────
// Зургийг /public/banners/ дотор байршуулна (жишээ: banner1.jpg)
// Текстийг доороос шинэчилнэ
export type Banner = {
  image: string;
  badge: string;
  title: string;
  subtitle: string;
  ctaLabel: string;
  ctaHref: string;
};

const BANNERS: Banner[] = [
  {
    image: "/banners/banner1.jpg",
    badge: "Агуулахын удирдлагын систем",
    title: "Агуулахаа гартаа атга",
    subtitle: "Бараа бүртгэл, захиалга, ашгийн тооцоог автоматжуулсан — жижиг бизнест зориулсан хэрэгсэл.",
    ctaLabel: "7 хоног үнэгүй туршаад үз →",
    ctaHref: "/login",
  },
  {
    image: "/banners/banner2.jpg",
    badge: "Хаана ч ажиллана",
    title: "Гар утас, веб — бүгд нэг дор",
    subtitle: "Дэлгүүр дээрээсээ ч, гэрээсээ ч агуулахаа удирдаарай.",
    ctaLabel: "Боломжуудыг харах →",
    ctaHref: "#features",
  },
  {
    image: "/banners/banner3.jpg",
    badge: "Олон дэлгүүр, нэг систем",
    title: "Бизнесээ өсгөхөд бэлэн",
    subtitle: "Хэдэн ч салбар, агуулахыг нэг дороос хянаж, ашгаа тооцоорой.",
    ctaLabel: "Үнэ тариф харах →",
    ctaHref: "/pricing",
  },
];

const AUTOPLAY_MS = 6000;

export default function HeroCarousel() {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  const goTo = useCallback((i: number) => {
    setIndex((i + BANNERS.length) % BANNERS.length);
  }, []);

  const next = useCallback(() => goTo(index + 1), [index, goTo]);
  const prev = useCallback(() => goTo(index - 1), [index, goTo]);

  useEffect(() => {
    if (paused) return;
    const t = setInterval(() => setIndex((i) => (i + 1) % BANNERS.length), AUTOPLAY_MS);
    return () => clearInterval(t);
  }, [paused]);

  return (
    <section
      id="hero"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      style={{
        position: "relative",
        minHeight: "100vh",
        overflow: "hidden",
        background: "#0a2e24",
      }}
    >
      {/* Slides */}
      {BANNERS.map((b, i) => (
        <div
          key={i}
          aria-hidden={i !== index}
          style={{
            position: "absolute",
            inset: 0,
            opacity: i === index ? 1 : 0,
            transform: i === index ? "scale(1)" : "scale(1.04)",
            transition: "opacity 0.9s ease, transform 1.2s ease",
            pointerEvents: i === index ? "auto" : "none",
          }}
        >
          {/* Background image */}
          <div style={{
            position: "absolute", inset: 0,
            backgroundImage: `url(${b.image})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
          }} />
          {/* Dark gradient overlay for legibility */}
          <div style={{
            position: "absolute", inset: 0,
            background: "linear-gradient(160deg, rgba(10,46,36,0.92) 0%, rgba(10,46,36,0.55) 55%, rgba(10,46,36,0.75) 100%)",
          }} />

          {/* Content */}
          <div style={{
            position: "relative",
            height: "100%",
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            alignItems: "center",
            textAlign: "center",
            padding: "120px 24px 100px",
          }}>
            <div style={{
              maxWidth: 800,
              opacity: i === index ? 1 : 0,
              transform: i === index ? "translateY(0)" : "translateY(16px)",
              transition: "opacity 0.7s ease 0.2s, transform 0.7s ease 0.2s",
            }}>
              {/* Badge */}
              <div style={{
                display: "inline-flex", alignItems: "center", gap: 8,
                padding: "6px 16px",
                borderRadius: 100,
                border: "1px solid rgba(7,230,174,0.25)",
                background: "rgba(7,230,174,0.07)",
                color: "#07e6ae",
                fontSize: 13,
                fontWeight: 500,
                letterSpacing: "0.02em",
                marginBottom: 28,
              }}>
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#07e6ae", display: "inline-block" }} />
                {b.badge}
              </div>

              {/* Title */}
              <h1 style={{
                fontSize: "clamp(36px, 6vw, 68px)",
                fontWeight: 800,
                lineHeight: 1.12,
                letterSpacing: "-2px",
                color: "#ffffff",
                margin: "0 0 20px",
              }}>
                {b.title}
              </h1>

              {/* Subtitle */}
              <p style={{
                fontSize: "clamp(15px, 2vw, 19px)",
                color: "rgba(255,255,255,0.6)",
                lineHeight: 1.6,
                margin: "0 auto 36px",
                maxWidth: 560,
              }}>
                {b.subtitle}
              </p>

              {/* CTA */}
              {b.ctaHref.startsWith("#") ? (
                <a
                  href={b.ctaHref}
                  style={{
                    display: "inline-block",
                    padding: "14px 32px",
                    borderRadius: 12,
                    background: "#07e6ae",
                    color: "#0a2e24",
                    fontSize: 15,
                    fontWeight: 700,
                    textDecoration: "none",
                    boxShadow: "0 4px 24px rgba(7,230,174,0.3)",
                  }}
                >
                  {b.ctaLabel}
                </a>
              ) : (
                <Link
                  href={b.ctaHref}
                  style={{
                    display: "inline-block",
                    padding: "14px 32px",
                    borderRadius: 12,
                    background: "#07e6ae",
                    color: "#0a2e24",
                    fontSize: 15,
                    fontWeight: 700,
                    textDecoration: "none",
                    boxShadow: "0 4px 24px rgba(7,230,174,0.3)",
                  }}
                >
                  {b.ctaLabel}
                </Link>
              )}
            </div>
          </div>
        </div>
      ))}

      {/* Prev / Next arrows */}
      <button
        onClick={prev}
        aria-label="Өмнөх баннер"
        style={{
          position: "absolute", top: "50%", left: 16,
          transform: "translateY(-50%)",
          zIndex: 10,
          width: 44, height: 44,
          borderRadius: "50%",
          background: "rgba(255,255,255,0.08)",
          border: "1px solid rgba(255,255,255,0.15)",
          color: "#fff",
          cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center",
          transition: "all 0.2s",
          backdropFilter: "blur(8px)",
        }}
        onMouseEnter={e => (e.currentTarget.style.background = "rgba(7,230,174,0.2)")}
        onMouseLeave={e => (e.currentTarget.style.background = "rgba(255,255,255,0.08)")}
      >
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M11 3l-6 6 6 6" />
        </svg>
      </button>
      <button
        onClick={next}
        aria-label="Дараагийн баннер"
        style={{
          position: "absolute", top: "50%", right: 16,
          transform: "translateY(-50%)",
          zIndex: 10,
          width: 44, height: 44,
          borderRadius: "50%",
          background: "rgba(255,255,255,0.08)",
          border: "1px solid rgba(255,255,255,0.15)",
          color: "#fff",
          cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center",
          transition: "all 0.2s",
          backdropFilter: "blur(8px)",
        }}
        onMouseEnter={e => (e.currentTarget.style.background = "rgba(7,230,174,0.2)")}
        onMouseLeave={e => (e.currentTarget.style.background = "rgba(255,255,255,0.08)")}
      >
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M7 3l6 6-6 6" />
        </svg>
      </button>

      {/* Dots */}
      <div style={{
        position: "absolute", bottom: 36, left: "50%", transform: "translateX(-50%)",
        zIndex: 10,
        display: "flex", gap: 10,
      }}>
        {BANNERS.map((_, i) => (
          <button
            key={i}
            onClick={() => goTo(i)}
            aria-label={`Баннер ${i + 1}`}
            style={{
              width: i === index ? 28 : 10,
              height: 10,
              borderRadius: 100,
              border: "none",
              cursor: "pointer",
              background: i === index ? "#07e6ae" : "rgba(255,255,255,0.3)",
              transition: "all 0.3s ease",
              padding: 0,
            }}
          />
        ))}
      </div>
    </section>
  );
}
