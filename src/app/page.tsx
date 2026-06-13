"use client";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import PricingTable from "@/components/PricingTable";
import HeroCarousel from "@/components/HeroCarousel";

// ── Боломжуудын дата ──────────────────────────────────────────
const FEATURES = [
  {
    icon: "📦",
    title: "Бараа бүртгэл",
    desc: "Variant, хэмжээ, өнгөөр ялгаж бүртгэнэ. Үлдэгдэл автоматаар тооцно.",
  },
  {
    icon: "📋",
    title: "Захиалга бүртгэл",
    desc: "Хурдан шивэх, хаяг хуулах, захиалгын статус хянах.",
  },
  {
    icon: "📊",
    title: "Ашиг тооцоо",
    desc: "Өртөг, орлого, ашиг автоматаар тооцно. Тайлан нэг товшилтоор.",
  },
  {
    icon: "👥",
    title: "Зочин хандалт",
    desc: "Ажилтандаа эрх олгож, хамтран ажиллана. Эрхийн тусгаарлалт.",
  },
  {
    icon: "🏪",
    title: "Олон дэлгүүр",
    desc: "Хэд хэдэн агуулах, дэлгүүрийг нэг эрин дор хянана.",
  },
  {
    icon: "📱",
    title: "Утас + Веб",
    desc: "Гар утас, таблет, компьютер дээр тасралтгүй ажиллана.",
  },
];

// ── Component ─────────────────────────────────────────────────
export default function HomePage() {
  return (
    <>
      <Navbar />
      
      {/* ── HERO ── */}
      <HeroCarousel />

      {/* ── PROBLEM STRIP ── */}
      <section style={{
        background: "#f8fffe",
        borderTop: "1px solid #e8f5f1",
        borderBottom: "1px solid #e8f5f1",
        padding: "48px 24px",
        textAlign: "center",
      }}>
        <div style={{ maxWidth: 900, margin: "0 auto" }}>
          <p style={{ fontSize: 13, fontWeight: 600, color: "#07e6ae", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 16 }}>
            Танд ийм бэрхшээл тулгардаг уу?
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16 }}>
            {[
              "Барааны тоо, үлдэгдэл зөрдөг",
              "Захиалга бүртгэл удаашрал",
              "Ашгаа тооцоолох зав гардаггүй",
              "Олон дэлгүүрийг нэгтгэхэд хүнд",
            ].map((text) => (
              <div key={text} style={{
                padding: "16px 20px",
                borderRadius: 10,
                background: "#fff",
                border: "1px solid #e8f5f1",
                fontSize: 14,
                color: "#374151",
                fontWeight: 500,
                display: "flex",
                alignItems: "center",
                gap: 10,
              }}>
                <span style={{ color: "#f59e0b", fontSize: 16 }}>⚠</span>
                {text}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FEATURES ── */}
      <section id="features" style={{ padding: "96px 24px", background: "#ffffff" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 64 }}>
            <p style={{ fontSize: 13, fontWeight: 600, color: "#07e6ae", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 12 }}>
              БОЛОМЖУУД
            </p>
            <h2 style={{ fontSize: "clamp(28px, 4vw, 44px)", fontWeight: 800, color: "#0a2e24", letterSpacing: "-1px", margin: 0 }}>
              OLULA-д байгаа зүйлс
            </h2>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 24 }}>
            {FEATURES.map((f) => (
              <div
                key={f.title}
                style={{
                  padding: "28px 28px",
                  borderRadius: 16,
                  background: "#fafffe",
                  border: "1px solid #e8f5f1",
                  transition: "all 0.2s",
                }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLDivElement).style.borderColor = "#07e6ae";
                  (e.currentTarget as HTMLDivElement).style.boxShadow = "0 4px 24px rgba(7,230,174,0.1)";
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLDivElement).style.borderColor = "#e8f5f1";
                  (e.currentTarget as HTMLDivElement).style.boxShadow = "none";
                }}
              >
                <div style={{
                  width: 48, height: 48, borderRadius: 12,
                  background: "rgba(7,230,174,0.1)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 22, marginBottom: 16,
                }}>
                  {f.icon}
                </div>
                <h3 style={{ fontSize: 16, fontWeight: 700, color: "#0a2e24", margin: "0 0 8px", letterSpacing: "-0.3px" }}>
                  {f.title}
                </h3>
                <p style={{ fontSize: 14, color: "#6b7280", lineHeight: 1.6, margin: 0 }}>
                  {f.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── PRICING ── */}
      <section id="pricing" style={{ padding: "96px 24px", background: "#f8fffe" }}>
        <div style={{ padding: "0 0" }}>
          <PricingTable />
        </div>
      </section>

      {/* ── ABOUT / HOW IT WORKS ── */}
      <section id="about" style={{ padding: "96px 24px", background: "#fff" }}>
        <div style={{ maxWidth: 900, margin: "0 auto", textAlign: "center" }}>
          <p style={{ fontSize: 13, fontWeight: 600, color: "#07e6ae", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 12 }}>
            БИД
          </p>
          <h2 style={{ fontSize: "clamp(28px, 4vw, 40px)", fontWeight: 800, color: "#0a2e24", letterSpacing: "-1px", margin: "0 0 20px" }}>
            OLULA гэж юу вэ?
          </h2>
          <p style={{ fontSize: 16, color: "#6b7280", lineHeight: 1.7, maxWidth: 660, margin: "0 auto 48px" }}>
            Жижиг дэлгүүр, агуулах эзэмшдэг бизнес эрхлэгчдэд зориулсан — бараа, захиалга,
            ашгийг нэг дороос хянах хялбар систем. Монгол хэлээр, монгол бизнест тохирсон.
          </p>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 24 }}>
            {[
              { num: "500+", label: "Идэвхтэй хэрэглэгч" },
              { num: "99.9%", label: "Uptime найдвартай байдал" },
              { num: "< 3 мин", label: "Тохиргоо хийх хугацаа" },
            ].map((stat) => (
              <div key={stat.label} style={{
                padding: "28px 20px",
                borderRadius: 14,
                border: "1px solid #e8f5f1",
                background: "#f8fffe",
              }}>
                <div style={{ fontSize: 32, fontWeight: 800, color: "#07e6ae", letterSpacing: "-1px", marginBottom: 6 }}>
                  {stat.num}
                </div>
                <div style={{ fontSize: 14, color: "#6b7280" }}>{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FINAL CTA ── */}
      <section style={{
        padding: "80px 24px",
        background: "linear-gradient(160deg, #0a2e24 0%, #0d3d30 100%)",
        textAlign: "center",
      }}>
        <div style={{ maxWidth: 600, margin: "0 auto" }}>
          <h2 style={{ fontSize: "clamp(28px, 4vw, 44px)", fontWeight: 800, color: "#fff", letterSpacing: "-1px", margin: "0 0 16px" }}>
            Өнөөдрөөс эхлэх үү?
          </h2>
          <p style={{ fontSize: 16, color: "rgba(255,255,255,0.55)", margin: "0 0 36px" }}>
            7 хоногийн үнэгүй туршилтаар эхлэх — хэзээ ч цуцлах боломжтой.
          </p>
          <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
            <Link
              href="/login"
              style={{
                padding: "14px 32px", borderRadius: 12,
                background: "#07e6ae", color: "#0a2e24",
                fontSize: 15, fontWeight: 700, textDecoration: "none",
                boxShadow: "0 4px 24px rgba(7,230,174,0.3)",
              }}
            >
              Үнэгүй туршаад үзэх →
            </Link>
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer style={{
        background: "#071c15",
        borderTop: "1px solid rgba(7,230,174,0.08)",
        padding: "32px 24px",
        textAlign: "center",
      }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
          <span style={{ fontSize: 16, fontWeight: 800, color: "#fff", letterSpacing: "-0.5px" }}>
            OLULA<span style={{ color: "#07e6ae" }}>.</span>
          </span>
          <div style={{ display: "flex", gap: 24 }}>
            {["Нэвтрэх", "Зочноор нэвтрэх"].map((label) => (
              <Link
                key={label}
                href="/login"
                style={{ fontSize: 13, color: "rgba(255,255,255,0.4)", textDecoration: "none" }}
              >
                {label}
              </Link>
            ))}
          </div>
          <span style={{ fontSize: 13, color: "rgba(255,255,255,0.25)" }}>
            © 2025 OLULA · Аюулгүй · HTTPS
          </span>
        </div>
      </footer>

      <style>{`
        @keyframes bounce {
          0%, 100% { transform: translateX(-50%) translateY(0); }
          50% { transform: translateX(-50%) translateY(6px); }
        }
        * { box-sizing: border-box; }
        html { scroll-behavior: smooth; }
        body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
      `}</style>
    </>
  );
}
