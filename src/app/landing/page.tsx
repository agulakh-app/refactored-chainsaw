export default function LandingPage() {
  return (
    <div style={{fontFamily:'sans-serif',background:'#fff',maxWidth:720,margin:'0 auto',padding:'0 0 40px'}}>
      <style>{`
        *{box-sizing:border-box;margin:0;padding:0}
        .label{font-size:11px;font-weight:500;letter-spacing:1.2px;text-transform:uppercase;color:#07e6ae;margin-bottom:.75rem}
        .section-title{font-size:22px;font-weight:500;color:#111;margin-bottom:1.5rem}
        .hero{text-align:center;border-bottom:1px solid #f0f0f0;padding:3.5rem 2rem 3rem}
        .hero-brand{font-size:13px;font-weight:600;letter-spacing:4px;color:#07e6ae;margin-bottom:.6rem;text-transform:uppercase}
        .hero h1{font-size:30px;font-weight:500;color:#111;line-height:1.2;margin-bottom:.75rem;letter-spacing:3px;text-transform:uppercase}
        .hero .h1-sub{font-size:14px;color:#666;margin-bottom:2rem}
        .hero-btns{display:flex;gap:10px;justify-content:center;flex-wrap:wrap}
        .btn-main{background:#07e6ae;color:#0a2e24;padding:13px 28px;border-radius:10px;font-size:14px;font-weight:500;border:none;cursor:pointer;text-decoration:none;display:inline-block}
        .btn-out{background:transparent;color:#666;padding:13px 28px;border-radius:10px;font-size:14px;border:1px solid #e0e0e0;cursor:pointer;text-decoration:none;display:inline-block}
        .pain-section{padding:2.5rem 2rem;border-bottom:1px solid #f0f0f0}
        .pain-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:10px}
        .pain-item{display:flex;align-items:flex-start;gap:10px;padding:14px;background:#fafafa;border-radius:10px;border:1px solid #f0f0f0}
        .pain-dot{width:6px;height:6px;background:#E24B4A;border-radius:50%;margin-top:6px;flex-shrink:0}
        .pain-text{font-size:13px;color:#555;line-height:1.55}
        .feat-section{padding:2.5rem 2rem;border-bottom:1px solid #f0f0f0}
        .feat-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:12px}
        .feat-card{padding:1.25rem 1rem;border:1px solid #f0f0f0;border-radius:12px}
        .feat-num{font-size:11px;font-weight:500;color:#07e6ae;letter-spacing:1px;margin-bottom:.5rem}
        .feat-card h3{font-size:14px;font-weight:500;color:#111;margin-bottom:6px}
        .feat-card p{font-size:12px;color:#666;line-height:1.55}
        .price-section{padding:2.5rem 2rem;border-bottom:1px solid #f0f0f0}
        .pt{width:100%;border:1px solid #f0f0f0;border-radius:12px;overflow:hidden;border-collapse:collapse}
        .pt th,.pt td{padding:11px 14px;border:1px solid #f0f0f0;text-align:center;font-size:13px}
        .pt thead tr{background:#fafafa}
        .pt thead th{font-weight:500;color:#666;font-size:12px}
        .pt thead th.pn{text-align:left;font-size:13px;color:#111}
        .pt tbody tr:nth-child(even){background:#fafafa}
        .pt tbody td.pn{text-align:left;font-weight:500;color:#111}
        .pt tbody td.price{font-size:14px;font-weight:500;color:#111}
        .ok{color:#07e6ae;font-size:15px}
        .no{color:#ddd;font-size:15px}
        .feat-row td{font-size:12px;color:#666;background:#fff}
        .feat-row td.pn{color:#666;font-weight:400}
        .sep-row td{background:#fafafa!important;padding:6px 14px!important;font-size:11px!important;color:#07e6ae!important;font-weight:500!important;letter-spacing:.5px;text-align:left!important}
        .free-note{margin-top:1rem;background:#f0fef9;border:1px solid #b2f0e0;border-radius:10px;padding:12px 16px;font-size:13px;color:#04725a}
        .cta-section{padding:3rem 2rem;text-align:center}
        .cta-section h2{font-size:24px;font-weight:500;color:#111;margin-bottom:.5rem}
        .cta-section p{font-size:14px;color:#666;margin-bottom:1.5rem}
        .trust{display:flex;justify-content:center;gap:1.5rem;flex-wrap:wrap;margin-top:1.25rem}
        .trust-item{display:flex;align-items:center;gap:6px;font-size:12px;color:#666}
        .trust-dot{width:6px;height:6px;background:#07e6ae;border-radius:50%;flex-shrink:0}
        @media(max-width:500px){.hero h1{font-size:22px}.pt th,.pt td{padding:8px 6px;font-size:11px}}
      `}</style>

      <div className="hero">
        <div className="hero-brand">OLULA</div>
        <h1>Агуулахаа гартаа атга</h1>
        <p className="h1-sub">Бараа бүртгэл &nbsp;|&nbsp; Захиалга бүртгэл &nbsp;|&nbsp; Орлого, ашгийн тооцоо</p>
        <div className="hero-btns">
          <a href="/" className="btn-main">Үнэгүй 7 хоног туршаад үз →</a>
          <a href="#price" className="btn-out">Үнийн мэдээлэл</a>
        </div>
      </div>

      <div className="pain-section">
        <div className="label">Асуудал</div>
        <div className="section-title">Танд ийм бэрхшээл тулгардаг уу?</div>
        <div className="pain-grid">
          <div className="pain-item"><div className="pain-dot"></div><span className="pain-text">Агуулах дахь барааны тоо, үлдэгдэл зөрөх</span></div>
          <div className="pain-item"><div className="pain-dot"></div><span className="pain-text">Барааны үлдэгдэл, захиалга бүртгэл удаашрал</span></div>
          <div className="pain-item"><div className="pain-dot"></div><span className="pain-text">Борлуулалт, ашгаа тооцоолох зав гардаггүй</span></div>
          <div className="pain-item"><div className="pain-dot"></div><span className="pain-text">Олон дэлгүүр, агуулахыг хянах, бүртгэх хүндрэл</span></div>
        </div>
      </div>

      <div className="feat-section">
        <div className="label">Боломжууд</div>
        <div className="section-title">OLULA-д байгаа зүйлс</div>
        <div className="feat-grid">
          <div className="feat-card"><div className="feat-num">01</div><h3>Бараа бүртгэл</h3><p>Variant, хэмжээ, өнгөөр ялгаж бүртгэнэ</p></div>
          <div className="feat-card"><div className="feat-num">02</div><h3>Захиалга бүртгэл</h3><p>Хурдан шивэх, хаяг хуулах, статус хянах</p></div>
          <div className="feat-card"><div className="feat-num">03</div><h3>Ашиг тооцоо</h3><p>Өртөг, орлого, ашиг автоматаар тооцно</p></div>
          <div className="feat-card"><div className="feat-num">04</div><h3>Зочин хандалт</h3><p>Ажилтандаа эрх олгож хамтран ажиллана</p></div>
        </div>
      </div>

      <div className="price-section" id="price">
        <div className="label">Үнэ тариф</div>
        <div className="section-title">Боломжийн | Хэмнэлттэй</div>
        <table className="pt">
          <thead>
            <tr>
              <th className="pn"></th>
              <th>1 сар</th>
              <th>3 сар</th>
              <th>6 сар</th>
              <th>1 жил</th>
            </tr>
          </thead>
          <tbody>
            <tr><td className="pn">Үндсэн</td><td className="price">19,900₮</td><td className="price">55,000₮</td><td className="price">109,000₮</td><td className="price">218,000₮</td></tr>
            <tr><td className="pn">Стандарт</td><td className="price">29,900₮</td><td className="price">85,000₮</td><td className="price">169,000₮</td><td className="price">318,000₮</td></tr>
            <tr><td className="pn">Бүрэн эрх</td><td className="price">39,900₮</td><td className="price">115,000₮</td><td className="price">219,000₮</td><td className="price">429,000₮</td></tr>
            <tr className="sep-row"><td colSpan={5}>Эрхийн ялгаа</td></tr>
            <tr className="feat-row"><td className="pn">Бараа, захиалга бүртгэл</td><td colSpan={4} style={{textAlign:'center',color:'#07e6ae'}}>✓ Бүгдэд байна</td></tr>
            <tr className="feat-row"><td className="pn">Зочин нэмэх, тайлан харах</td><td style={{textAlign:'center',color:'#ddd'}}>✕</td><td colSpan={3} style={{textAlign:'center',color:'#04725a',fontSize:12}}>Стандарт, Бүрэн эрхэд байна</td></tr>
            <tr className="feat-row"><td className="pn">Олон дэлгүүр</td><td colSpan={3} style={{textAlign:'center',color:'#ddd'}}>✕</td><td style={{textAlign:'center',color:'#04725a',fontSize:12}}>Зөвхөн Бүрэн эрхэд</td></tr>
          </tbody>
        </table>
        <div className="free-note">
          7 хоногийн <strong>ТӨЛБӨРГҮЙ туршилт</strong> — бүртгүүлсний дараа автоматаар эхэлнэ.
        </div>
      </div>

      <div className="cta-section">
        <div className="label">Эхлэх</div>
        <h2>Өнөөдрөөс эхлэх үү?</h2>
        <p>Веб болон гар утасны апп-д ашиглаж болно — одоо эхэлье.</p>
        <a href="/" className="btn-main" style={{fontSize:15,padding:'14px 36px'}}>Үнэгүй туршаад үзэх →</a>
        <div className="trust">
          <div className="trust-item"><div className="trust-dot"></div>Аюулгүй</div>
          <div className="trust-item"><div className="trust-dot"></div>Гар утсанд ажиллана</div>
          <div className="trust-item"><div className="trust-dot"></div>Веб дээр ажиллана</div>
        </div>
      </div>
    </div>
  )
}
