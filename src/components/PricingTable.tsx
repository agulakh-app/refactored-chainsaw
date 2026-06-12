"use client";
import Link from "next/link";

const OPTIONS = [
  { id: "trial", label: "7 хоног", price: 0, isTrial: true },
  { id: "m1", label: "1 сар", price: 19900 },
  { id: "m3", label: "3 сар", price: 57000 },
  { id: "y1", label: "1 жил", price: 180000 },
] as const;

function fmt(n: number) {
  return n.toLocaleString("mn-MN") + "₮";
}

export default function PricingTable() {
  return (
    <div style={{ maxWidth: 760, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ textAlign: "center", marginBottom: 24 }}>
        <p style={{
          fontSize: 13, fontWeight: 600, color: "#07e6ae",
          letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 12,
        }}>
          ҮНЭ ТАРИФ
        </p>
        <h2 style={{
          fontSize: "clamp(28px, 4vw, 44px)", fontWeight: 800,
          color: "#0a2e24", letterSpacing: "-1px", margin: "0 0 12px",
        }}>
          Хугацаагаа сонгоод эхлээрэй
        </h2>
        <p style={{ fontSize: 15, color: "#6b7280", margin: 0 }}>
          Бүх боломж — нэг үнэ, зэрэглэлгүй.
        </p>
      </div>

      {/* 4 сонголт */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginBottom: 24 }}>
        {OPTIONS.map(opt => (
          <div key={opt.id} style={{
            borderRadius: 16, padding: "20px 12px", textAlign: "center",
            background: "#ffffff",
            border: opt.id === 'trial' ? "1px solid #07e6ae" : "1px solid #e8f5f1",
          }}>
            <div style={{ fontSize: 13, marginBottom: 8, color: "#9ca3af" }}>{opt.label}</div>
            <div style={{
              fontSize: opt.id === 'trial' ? 17 : 19, fontWeight: 800,
              color: opt.id === 'trial' ? "#048a6a" : "#0a2e24",
            }}>
              {opt.id === 'trial' ? "Үнэгүй" : fmt(opt.price)}
            </div>
            {opt.id === 'trial' && (
              <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 4 }}>туршилт</div>
            )}
          </div>
        ))}
      </div>

      <div style={{ textAlign: "center" }}>
        <Link
          href="/pricing"
          style={{
            display: "inline-block", padding: "14px 32px", borderRadius: 12,
            background: "#07e6ae", color: "#0a2e24", fontSize: 15, fontWeight: 700,
            textDecoration: "none", boxShadow: "0 4px 24px rgba(7,230,174,0.25)",
          }}
        >
          Эхлэх →
        </Link>
      </div>
    </div>
  );
}
