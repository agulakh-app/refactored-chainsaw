"use client";

// ── Үнийн дата ────────────────────────────────────────────────
const PERIODS = ["1 сар", "3 сар", "6 сар", "1 жил"] as const;

const PLANS = [
  { name: "Үндсэн", prices: [19900, 55000, 109000, 218000] },
  { name: "Стандарт", prices: [29900, 85000, 169000, 318000] },
  { name: "Бүрэн эрх", prices: [39900, 115000, 219000, 429000] },
] as const;

// Боломжууд — багана бүр нь хугацааны баганатай (1сар/3сар/6сар/1жил) тэгшилнэ
const FEATURES: { label: string; included: boolean[] }[] = [
  { label: "Бараа бүртгэл", included: [true, true, true, true] },
  { label: "Захиалга бүртгэл", included: [true, true, true, true] },
  { label: "Зочин нэмэх", included: [false, false, true, true] },
  { label: "Тайлан харах", included: [false, false, true, true] },
  { label: "Олон дэлгүүр", included: [false, false, false, true] },
];

function fmt(n: number) {
  return n.toLocaleString("mn-MN") + "₮";
}

export default function PricingTable() {
  return (
    <div style={{ maxWidth: 1000, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ textAlign: "center", marginBottom: 32 }}>
        <p style={{
          fontSize: 13, fontWeight: 600, color: "#07e6ae",
          letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 12,
        }}>
          ҮНЭ ТАРИФ
        </p>
        <h2 style={{
          fontSize: "clamp(28px, 4vw, 44px)", fontWeight: 800,
          color: "#0a2e24", letterSpacing: "-1px", margin: 0,
        }}>
          Боломжийн · Хэмнэлттэй
        </h2>
      </div>

      {/* Table */}
      <div style={{
        borderRadius: 16,
        border: "1px solid #e8f5f1",
        overflow: "hidden",
        background: "#ffffff",
        boxShadow: "0 2px 24px rgba(7,230,174,0.06)",
      }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 560 }}>
            <thead>
              <tr>
                <th style={{
                  padding: "16px 20px",
                  textAlign: "left",
                  borderBottom: "1px solid #e8f5f1",
                }} />
                {PERIODS.map((p, i) => (
                  <th key={p} style={{
                    padding: "16px 20px",
                    textAlign: "center",
                    fontSize: 14,
                    fontWeight: 700,
                    color: "#0a2e24",
                    borderBottom: "1px solid #e8f5f1",
                    background: i === 2 ? "rgba(7,230,174,0.06)" : "transparent",
                  }}>
                    {p}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {/* Price rows */}
              {PLANS.map((plan, rowIdx) => (
                <tr key={plan.name}>
                  <td style={{
                    padding: "18px 20px",
                    fontSize: 15,
                    fontWeight: 700,
                    color: "#0a2e24",
                    borderBottom: "1px solid #f0fdf9",
                    whiteSpace: "nowrap",
                  }}>
                    {plan.name}
                  </td>
                  {plan.prices.map((price, colIdx) => (
                    <td key={colIdx} style={{
                      padding: "18px 20px",
                      textAlign: "center",
                      fontSize: 15,
                      fontWeight: 700,
                      color: rowIdx === 1 ? "#07e6ae" : "#374151",
                      borderBottom: "1px solid #f0fdf9",
                      background: colIdx === 2 ? "rgba(7,230,174,0.04)" : "transparent",
                    }}>
                      {fmt(price)}
                    </td>
                  ))}
                </tr>
              ))}

              {/* Feature rows */}
              {FEATURES.map((f) => (
                <tr key={f.label}>
                  <td style={{
                    padding: "14px 20px",
                    fontSize: 14,
                    color: "#374151",
                    borderBottom: "1px solid #f0fdf9",
                    whiteSpace: "nowrap",
                  }}>
                    {f.label}
                  </td>
                  {f.included.map((inc, colIdx) => (
                    <td key={colIdx} style={{
                      padding: "14px 20px",
                      textAlign: "center",
                      borderBottom: "1px solid #f0fdf9",
                      background: colIdx === 2 ? "rgba(7,230,174,0.04)" : "transparent",
                    }}>
                      <span style={{
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        width: 22, height: 22,
                        borderRadius: "50%",
                        fontSize: 12, fontWeight: 700,
                        background: inc ? "rgba(7,230,174,0.12)" : "rgba(248,113,113,0.08)",
                        color: inc ? "#07e6ae" : "#f87171",
                      }}>
                        {inc ? "✓" : "✕"}
                      </span>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Trial banner */}
      <div style={{
        marginTop: 24,
        padding: "18px 24px",
        borderRadius: 12,
        background: "rgba(7,230,174,0.06)",
        border: "1px solid rgba(7,230,174,0.2)",
        textAlign: "center",
        fontSize: 14,
        color: "#374151",
      }}>
        🎉 7 хоногийн <strong style={{ color: "#0a2e24" }}>ТӨЛБӨРГҮЙ туршилт</strong> — бүртгүүлсний дараа автоматаар эхэлнэ.
      </div>
    </div>
  );
}
