"use client";
import Link from "next/link";

// ── Үнийн дата ────────────────────────────────────────────────
const PERIODS = ["1 сар", "3 сар", "6 сар", "1 жил"] as const;

const PLANS = [
  { name: "Үндсэн", id: "basic", prices: [19900, 55000, 109000, 218000] },
  { name: "Стандарт", id: "standard", prices: [29900, 85000, 169000, 318000] },
  { name: "Бүрэн эрх", id: "full", prices: [39900, 115000, 219000, 429000] },
] as const;

// Эрхийн ялгаа — мөр бүр = боломж, утга = аль эрхэд байгаа
const FEATURE_MATRIX = [
  { label: "Олон дэлгүүр", plans: { basic: false, standard: true, full: true } },
  { label: "Зочин нэмэх", plans: { basic: false, standard: false, full: true } },
  { label: "Тайлан харах", plans: { basic: false, standard: false, full: true } },
];

function fmt(n: number) {
  return n.toLocaleString("mn-MN") + "₮";
}

export default function PricingTable() {
  return (
    <div style={{ maxWidth: 1000, margin: "0 auto" }}>
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
          Боломжийн · Хэмнэлттэй
        </h2>
      </div>

      {/* Идэвхтэй заавар badge */}
      <div style={{ textAlign: "center", marginBottom: 16 }}>
        <span style={{
          display: "inline-block",
          padding: "8px 20px",
          borderRadius: 100,
          background: "#07e6ae",
          color: "#0a2e24",
          fontSize: 14,
          fontWeight: 700,
        }}>
          Хүснэгт дээрх үнэ дээр дараад, эрхээ сонгоно уу →
        </span>
      </div>

      {/* Үнийн хүснэгт */}
      <div style={{
        borderRadius: 16,
        border: "1px solid #e8f5f1",
        overflow: "hidden",
        background: "#ffffff",
        boxShadow: "0 2px 24px rgba(7,230,174,0.06)",
        marginBottom: 24,
      }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 560 }}>
            <thead>
              <tr>
                <th style={{ padding: "16px 20px", textAlign: "left", borderBottom: "1px solid #e8f5f1" }} />
                {PERIODS.map((p, i) => (
                  <th key={p} style={{
                    padding: "16px 20px", textAlign: "center", fontSize: 14, fontWeight: 700,
                    color: "#0a2e24", borderBottom: "1px solid #e8f5f1",
                    background: i === 2 ? "rgba(7,230,174,0.06)" : "transparent",
                  }}>
                    {p}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {PLANS.map((plan) => (
                <tr key={plan.name}>
                  <td style={{
                    padding: "18px 20px", fontSize: 15, fontWeight: 700,
                    color: "#0a2e24", borderBottom: "1px solid #f0fdf9", whiteSpace: "nowrap",
                  }}>
                    {plan.name}
                  </td>
                  {plan.prices.map((price, colIdx) => (
                    <td key={colIdx} style={{
                      padding: "18px 20px", textAlign: "center", fontSize: 15, fontWeight: 700,
                      color: plan.id === "standard" ? "#07e6ae" : "#374151",
                      borderBottom: "1px solid #f0fdf9",
                      background: colIdx === 2 ? "rgba(7,230,174,0.04)" : "transparent",
                    }}>
                      {fmt(price)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Эрхийн ялгаа */}
      <div style={{
        borderRadius: 16, border: "1px solid #e8f5f1", overflow: "hidden",
        background: "#ffffff", marginBottom: 24,
      }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 480 }}>
            <thead>
              <tr>
                <th style={{ padding: "14px 20px", textAlign: "left", fontSize: 13, fontWeight: 600, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.05em", borderBottom: "1px solid #e8f5f1" }}>
                  Эрхийн ялгаа
                </th>
                {PLANS.map(p => (
                  <th key={p.id} style={{ padding: "14px 20px", textAlign: "center", fontSize: 14, fontWeight: 700, color: "#0a2e24", borderBottom: "1px solid #e8f5f1" }}>
                    {p.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {FEATURE_MATRIX.map(row => (
                <tr key={row.label}>
                  <td style={{ padding: "14px 20px", fontSize: 14, color: "#374151", borderBottom: "1px solid #f0fdf9" }}>
                    {row.label}
                  </td>
                  {PLANS.map(p => {
                    const inc = row.plans[p.id as keyof typeof row.plans];
                    return (
                      <td key={p.id} style={{ padding: "14px 20px", textAlign: "center", borderBottom: "1px solid #f0fdf9" }}>
                        <span style={{
                          display: "inline-flex", alignItems: "center", justifyContent: "center",
                          width: 22, height: 22, borderRadius: "50%", fontSize: 12, fontWeight: 700,
                          background: inc ? "rgba(7,230,174,0.12)" : "rgba(248,113,113,0.08)",
                          color: inc ? "#07e6ae" : "#f87171",
                        }}>
                          {inc ? "✓" : "✕"}
                        </span>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Trial banner + CTA */}
      <div style={{
        padding: "18px 24px", borderRadius: 12,
        background: "rgba(7,230,174,0.06)", border: "1px solid rgba(7,230,174,0.2)",
        textAlign: "center", fontSize: 14, color: "#374151", marginBottom: 16,
      }}>
        🎉 7 хоногийн <strong style={{ color: "#0a2e24" }}>ТӨЛБӨРГҮЙ туршилт</strong> — бүртгүүлсний дараа автоматаар эхэлнэ.
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
          Эрхээ сонгох →
        </Link>
      </div>
    </div>
  );
}
