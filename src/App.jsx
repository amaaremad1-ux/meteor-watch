import { useState, useEffect } from "react";
import "./App.css";

import Hero from "./Components/Hero";
import MeteorSimulation from "./Components/MeteorSimulation";
import SensorPanel from "./components/SensorPanel";
import AIPanel from "./components/AIPanel";
import Videos from "./Components/Videos";
import Comms from "./components/comms";

import { useFireballs } from "./hooks/useFireballs";
import { useSound } from "./hooks/useSound";

const NAV = [
  { id: "home", label: "الفكرة", icon: "◉" },
  { id: "dashboard", label: "مركز القيادة", icon: "▣" },
  { id: "events", label: "الأحداث المرصودة", icon: "☄" },
  { id: "videos", label: "فيديوهات", icon: "▶" },
];

function App() {
  const [page, setPage] = useState("home");
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [redMode, setRedMode] = useState(false);
  const [explosion, setExplosion] = useState(null); // {energy, time}

  const { fireballs, loading, error, source } = useFireballs(20);
  const [selected, setSelected] = useState(null);
  const sound = useSound(soundEnabled);

  const [messages, setMessages] = useState([
    {
      sender: "NOVA AI",
      text: "نظام Meteor Watch AI جاهز. جارٍ الاتصال بقاعدة بيانات NASA CNEOS.",
      time: "--:--",
    },
  ]);

  useEffect(() => {
    if (fireballs.length && !selected) setSelected(fireballs[0]);
  }, [fireballs, selected]);

  useEffect(() => {
    if (!loading && fireballs.length) {
      addMessage(
        "NOVA AI",
        source === "nasa"
          ? `تم تحميل ${fireballs.length} حدثًا من NASA CNEOS Fireball API.`
          : `تعذر الاتصال بـ NASA، تم استخدام الأرشيف المحلي (${fireballs.length} حدثًا).`
      );
    }
  }, [loading, fireballs.length, source]);

  function addMessage(sender, text) {
    const time = new Date().toLocaleTimeString("ar-EG", {
      hour: "2-digit",
      minute: "2-digit",
    });
    setMessages((m) => [...m, { sender, text, time }]);
  }

  function selectEvent(event) {
    setSelected(event);
    setExplosion(null);
    setPage("dashboard");
    sound.play("select");
    addMessage(
      "NOVA AI",
      `تم تحويل المراقبة إلى حدث ${event.date} فوق ${event.region}.`
    );
  }

  function handleExplosion(data) {
    setExplosion(data);
    sound.play("explosion");
    if (data.energy > 10) setRedMode(true);
    addMessage(
      "NOVA AI",
      `انفجار مرصود! الطاقة المقدرة ${data.energy.toFixed(
        2
      )} كيلوطن على ارتفاع ${data.altitude.toFixed(1)} كم.`
    );
  }

  return (
    <div className={`app ${redMode ? "red-mode" : ""}`} dir="rtl">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-logo">☄</div>
          <div>
            <h1>Meteor Watch AI</h1>
            <p>رصد الشهب بالزلازل والصوت والذكاء الاصطناعي</p>
          </div>
        </div>

        <nav>
          {NAV.map((item) => (
            <button
              key={item.id}
              className={page === item.id ? "active" : ""}
              onClick={() => {
                setPage(item.id);
                sound.play("click");
              }}
            >
              <span className="nav-icon">{item.icon}</span>
              {item.label}
            </button>
          ))}
        </nav>

        <div className="sidebar-footer">
          <button
            className={`toggle ${soundEnabled ? "on" : ""}`}
            onClick={() => setSoundEnabled(!soundEnabled)}
          >
            {soundEnabled ? "🔊 الصوت مفعّل" : "🔇 الصوت مغلق"}
          </button>

          <button
            className={`toggle ${redMode ? "on danger" : ""}`}
            onClick={() => setRedMode(!redMode)}
          >
            {redMode ? "⚠ وضع الإنذار" : "○ الوضع الطبيعي"}
          </button>

          <div className="data-source">
            <span className={`dot ${source === "nasa" ? "live" : ""}`} />
            {loading
              ? "جارٍ الاتصال..."
              : source === "nasa"
              ? "NASA CNEOS — مباشر"
              : "أرشيف محلي"}
          </div>
        </div>
      </aside>

      <main className="content">
        {page === "home" && (
          <Hero
            onStart={() => {
              setPage("dashboard");
              sound.play("click");
            }}
          />
        )}

        {page === "dashboard" && selected && (
          <>
            <header className="topbar">
              <div>
                <p className="eyebrow">METEOR WATCH AI / COMMAND CENTER</p>
                <h2>
                  حدث {selected.date} — {selected.region}
                </h2>
              </div>
              <div className="live-status">
                <span className="pulse" />
                مراقبة نشطة
              </div>
            </header>

            <section className="dashboard-grid">
              <MeteorSimulation
                event={selected}
                onExplosion={handleExplosion}
                sound={sound}
              />

              <div className="right-column">
                <AIPanel event={selected} explosion={explosion} />
                <SensorPanel explosion={explosion} event={selected} />
              </div>
            </section>

            <Comms
              messages={messages}
              addMessage={addMessage}
              event={selected}
              sound={sound}
            />
          </>
        )}

        {page === "dashboard" && !selected && (
          <div className="loading-screen">
            <div className="spinner" />
            <p>جارٍ تحميل بيانات الشهب من NASA...</p>
          </div>
        )}

        {page === "events" && (
          <section className="category-page">
            <p className="eyebrow">NASA CNEOS / FIREBALL DATABASE</p>
            <h2>الأحداث المرصودة</h2>
            <p className="page-description">
              شُهب حقيقية سجّلتها أقمار الحكومة الأمريكية. اختر حدثًا لمحاكاته
              وتحليله.
            </p>

            {error && <p className="error-note">⚠ {error}</p>}

            <div className="object-grid">
              {fireballs.map((fb) => (
                <article
                  key={fb.id}
                  className={`object-card ${
                    selected?.id === fb.id ? "selected-card" : ""
                  }`}
                  style={{ "--accent": fb.color }}
                  onClick={() => selectEvent(fb)}
                >
                  <div className="card-top">
                    <span className="card-badge">{fb.energyLabel}</span>
                    <span className="card-date">{fb.date}</span>
                  </div>
                  <h3>{fb.region}</h3>
                  <p className="card-coords">
                    {fb.lat.toFixed(1)}° {fb.latDir} · {fb.lon.toFixed(1)}°{" "}
                    {fb.lonDir}
                  </p>
                  <div className="card-stats">
                    <div>
                      <span>الطاقة</span>
                      <strong>{fb.energy} kt</strong>
                    </div>
                    <div>
                      <span>الارتفاع</span>
                      <strong>{fb.altitude ? `${fb.altitude} km` : "—"}</strong>
                    </div>
                    <div>
                      <span>السرعة</span>
                      <strong>
                        {fb.velocity ? `${fb.velocity} km/s` : "—"}
                      </strong>
                    </div>
                  </div>
                  <div className="risk-bar">
                    <div style={{ width: `${fb.risk}%`, background: fb.color }} />
                  </div>
                </article>
              ))}
            </div>
          </section>
        )}

        {page === "videos" && <Videos />}
      </main>
    </div>
  );
}

export default App;