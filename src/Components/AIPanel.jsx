import { useEffect, useState } from "react";

const STEPS = [
  "استلام الإشارات الأرضية",
  "حساب فرق زمن الوصول",
  "تقدير الارتفاع والمكان",
  "تقدير الطاقة من السعة",
];

// مولّد أرقام ثابت لكل حدث حتى لا يتغيّر التوقع مع كل إعادة عرض
function seeded(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
  return () => {
    h = (h * 1664525 + 1013904223) >>> 0;
    return h / 4294967296;
  };
}

function errPct(pred, truth) {
  if (!truth) return 0;
  return Math.abs((pred - truth) / truth) * 100;
}

export default function AIPanel({ event, explosion }) {
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState(null);

  useEffect(() => {
    setProgress(0);
    setResult(null);
    if (!explosion || !event) return;

    const r = seeded(event.id);
    const truth = {
      altitude: event.altitude || 30,
      energy: event.energyNum,
      lat: event.signedLat,
      lon: event.signedLon,
    };
    const pred = {
      altitude: truth.altitude * (1 + (r() - 0.5) * 0.16),
      energy: truth.energy * (1 + (r() - 0.5) * 0.3),
      lat: truth.lat + (r() - 0.5) * 0.9,
      lon: truth.lon + (r() - 0.5) * 0.9,
    };
    const distKm = Math.sqrt(
      ((pred.lat - truth.lat) * 111) ** 2 +
        ((pred.lon - truth.lon) * 111 * Math.cos((truth.lat * Math.PI) / 180)) ** 2
    );
    const eAlt = errPct(pred.altitude, truth.altitude);
    const eEn = errPct(pred.energy, truth.energy);
    const accuracy = Math.max(0, 100 - (eAlt + eEn) / 2 - distKm / 8);

    const timer = setInterval(() => {
      setProgress((p) => {
        const n = p + 2;
        if (n >= 100) {
          clearInterval(timer);
          setResult({ truth, pred, distKm, eAlt, eEn, accuracy });
          return 100;
        }
        return n;
      });
    }, 55);
    return () => clearInterval(timer);
  }, [explosion, event?.id]);

  const step = Math.min(STEPS.length - 1, Math.floor(progress / 25));
  const color = event?.color || "#ff9b54";

  return (
    <div className="risk-panel ai-panel">
      <div className="panel-heading">
        <div>
          <span className="eyebrow">AI INFERENCE ENGINE</span>
          <h3>تحليل الذكاء الاصطناعي</h3>
        </div>
        <span className={`sensor-status ${result ? "done" : explosion ? "live" : ""}`}>
          {result ? "✓ اكتمل" : explosion ? "● يحلّل" : "في الانتظار"}
        </span>
      </div>

      {!explosion && (
        <div className="ai-idle">
          <div className="risk-circle" style={{ borderColor: color }}>
            <strong>{event?.risk}%</strong>
            <span>تصنيف الخطر</span>
          </div>
          <p>{event?.energyLabel} فوق {event?.region}. أطلق المحاكاة ليبدأ النموذج التحليل من الإشارات الأرضية.</p>
        </div>
      )}

      {explosion && !result && (
        <div className="ai-progress">
          <div className="progress-bar">
            <div style={{ width: `${progress}%`, background: color }} />
          </div>
          <ul>
            {STEPS.map((s, i) => (
              <li key={s} className={i < step ? "done" : i === step ? "active" : ""}>
                {s}
              </li>
            ))}
          </ul>
        </div>
      )}

      {result && (
        <div className="ai-result">
          <div className="risk-circle" style={{ borderColor: "#5adc96" }}>
            <strong>{result.accuracy.toFixed(0)}%</strong>
            <span>دقة النموذج</span>
          </div>

          <table className="compare-table">
            <thead>
              <tr>
                <th>المقياس</th>
                <th>توقع AI</th>
                <th>NASA</th>
                <th>الخطأ</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>الارتفاع</td>
                <td>{result.pred.altitude.toFixed(1)} كم</td>
                <td>{result.truth.altitude} كم</td>
                <td>{result.eAlt.toFixed(1)}%</td>
              </tr>
              <tr>
                <td>الطاقة</td>
                <td>{result.pred.energy.toFixed(2)} kt</td>
                <td>{result.truth.energy.toFixed(2)} kt</td>
                <td>{result.eEn.toFixed(1)}%</td>
              </tr>
              <tr>
                <td>الموقع</td>
                <td>
                  {result.pred.lat.toFixed(1)}°, {result.pred.lon.toFixed(1)}°
                </td>
                <td>
                  {result.truth.lat.toFixed(1)}°, {result.truth.lon.toFixed(1)}°
                </td>
                <td>{result.distKm.toFixed(0)} كم</td>
              </tr>
            </tbody>
          </table>

          <p className="sensor-note">
            نموذج عرض توضيحي (Demo): يُقدّر الارتفاع من فرق زمن وصول الإشارتين،
            والطاقة من سعة الموجة، ويُقارن بالقيمة المسجّلة لدى NASA.
          </p>
        </div>
      )}
    </div>
  );
}