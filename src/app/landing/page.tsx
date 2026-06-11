export default function LandingPage() {
  return (
    <div style={{fontFamily:'system-ui,sans-serif',background:'#ffffff',maxWidth:720,margin:'0 auto',padding:'0 0 60px'}}>
      <style>{`
        *{box-sizing:border-box;margin:0;padding:0}

        /* Navbar */
        .nav{display:flex;align-items:center;justify-content:space-between;padding:16px 24px;border-bottom:1px solid #f0f0f0;position:sticky;top:0;background:#fff;z-index:10}
        .nav-brand{font-size:13px;font-weight:700;letter-spacing:3px;color:#07e6ae;text-decoration:none;text-transform:uppercase}
        .nav-links{display:flex;align-items:center;gap:24px}
        .nav-link{font-size:13px;color:#6b7280;text-decoration:none}
        .nav-link:hover{color:#111}
        .nav-btn{font-size:13px;font-weight:500;padding:8px 18px;border-radius:8px;background:#07e6ae;color:#0a2e24;text-decoration:none;border:none;cursor:pointer}

        /* Hero */
        .hero{text-align:center;padding:5rem 2rem 4rem}
        .hero-brand{font-size:11px;font-weight:700;letter-spacing:4px;color:#07e6ae;text-transform:uppercase;margin-bottom:1rem}
        .hero h1{font-size:32px;font-weight:500;color:#111;letter-spacing:3px;text-transform:uppercase;line-height:1.2;margin-bottom:1rem}
        .hero-sub{font-size:15px;color:#6b7280;margin-bottom:2.5rem}
        .hero-btns{display:flex;gap:10px;justify-content:center;flex-wrap:wrap}
        .btn-main{background:#07e6ae;color:#0a2e24;padding:13px 28px;border-radius:10px;font-size:14px;font-weight:500;border:none;cursor:pointer;text-decoration:none;display:inline-block}
        .btn-out{background:transparent;color:#6b7280;padding:13px 28px;border-radius:10px;font-size:14px;border:1px solid #e5e7eb;cursor:pointer;text-decoration:none;display:inline-block}

        /* Sections */
        .section{padding:3rem 2rem;border-top:1px solid #f0f0f0}
        .label{font-size:11px;font-weight:600;letter-spacing:1.5px;text-transform:uppercase;color:#07e6ae;margin-bottom:0.75rem}
        .section-title{font-size:22px;font-weight:500;color:#111;margin-bottom:1.5rem;line-height:1.3}

        /* Pain */
        .pain-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:10px}
        .pain-item{display:flex;align-items:flex-start;gap:10px;padding:14px;background:#fafafa;border-radius:10px;border:1px solid #f0f0f0}
        .pain-dot{width:6px;height:6px;background:#ef4444;border-radius:50%;margin-top:6px;flex-shrink:0}
        .pain-text{font-size:13px;color:#555;line-height:1.55}

        /* Features */
        .feat-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px}
        .feat-card{padding:1.25rem 1rem;border:1px solid #f0f0f0;border-radius:12px;background:#fff}
        .feat-num{font-size:11px;font-weight:600;color:#07e6ae;letter-spacing:1px;margin-bottom:0.5rem}
        .feat-card h3{font-size:14px;font-weight:500;color:#111;margin-bottom:5px}
        .feat-card p{font-size:12px;color:#6b7280;line-height:1.5}

        /* Pricing */
        .pt{width:100%;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;border-collapse:collapse}
        .pt th,.pt td{padding:11px 14px;border:1px solid #e5e7eb;text-align:center;font-size:13px}
        .pt thead tr{background:#fafafa}
        .pt thead th{font-weight:500;color:#6b7280;font-size:12px}
        .pt thead th.pn{text-align:left}
        .pt tbody td.pn{text-align:left;font-weight:500;color:#111}
        .pt tbody td.price{font-size:14px;font-weight:500;color:#111}
        .pt tbody tr:hover{background:#fafafa}
        .feat-row td{font-size:12px;color:#6b7280}
        .feat-row td.pn{font-weight:400}
        .sep-row td{background:#fafafa!important;padding:6px 14px!important;font-size:11px!important;color:#07e6ae!important;font-weight:600!important;letter-spacing:0.5px;text-align:left!important}
        .free-note{margin-top:1rem;background:#f0fef9;border:1px solid #b2f0e0;border-radius:10px;padding:12px 16px;font-size:13px;color:#04725a}

        /* CTA */
        .cta{text-align:center;padding:3rem 2rem;border-top:1px solid #f0f0f0}
        .cta h2{font-size:24px;font-weight:500;color:#111;margin-bottom:0.5rem}
        .cta p{font-size:14px;color:#6b7280;margin-bottom:1.5rem}
        .trust{display:flex;justify-content:center;gap:1.5rem;flex-wrap:wrap;margin-top:1.25rem}
        .trust-item{display:flex;align-items:center;gap:6px;font-size:12px;color:#6b7280}
        .trust-dot{width:5px;height:5px;background:#07e6ae;border-radius:50%}

        @media(max-width:500px){.hero h1{font-size:22px}.pt th,.pt td{padding:8px 6px;font-size:11px}.nav-links{gap:12px}}
      `}</style>

      {/* Navbar */}
      <nav className="nav">
        <a href="/" className="nav-brand">OLULA
