import { useEffect, useState } from "react";

const NASA_SEARCH =
  "https://images-api.nasa.gov/search?media_type=video&q=";

const TOPICS = [
  { id: "meteor", label: "الشهب", q: "meteor fireball" },
  { id: "asteroid", label: "الكويكبات", q: "asteroid impact" },
  { id: "chelyabinsk", label: "تشيليابينسك", q: "chelyabinsk" },
  { id: "dart", label: "مهمة DART", q: "DART asteroid" },
];

// روابط رسمية احتياطية لو الـ API وقع وقت العرض
const FALLBACK_LINKS = [
  { title: "NASA CNEOS Fireballs", url: "https://cneos.jpl.nasa.gov/fireballs/" },
  { title: "NASA Planetary Defense", url: "https://www.nasa.gov/planetarydefense/" },
  { title: "NASA Image & Video Library", url: "https://images.nasa.gov/search?q=meteor&media=video" },
];

async function fetchVideos(q) {
  const res = await fetch(NASA_SEARCH + encodeURIComponent(q));
  if (!res.ok) throw new Error(`NASA responded ${res.status}`);
  const json = await res.json();
  return (json.collection?.items || []).slice(0, 8).map((it) => {
    const d = it.data?.[0] || {};
    return {
      id: d.nasa_id,
      title: d.title || "NASA Video",
      description: d.description || "",
      date: (d.date_created || "").slice(0, 10),
      thumb: it.links?.[0]?.href,
      collection: it.href, // JSON فيه روابط ملفات الفيديو
    };
  });
}

// يجلب رابط mp4 الفعلي من collection.json
async function resolveMp4(collectionUrl) {
  const res = await fetch(collectionUrl);
  const files = await res.json();
  const mp4s = files.filter((f) => f.endsWith(".mp4"));
  return (
    mp4s.find((f) => f.includes("~mobile")) ||
    mp4s.find((f) => f.includes("~small")) ||
    mp4s.find((f) => f.includes("~medium")) ||
    mp4s[0] ||
    null
  );
}

export default function Videos() {
  const [topic, setTopic] = useState(TOPICS[0]);
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [active, setActive] = useState(null); // {video, src}
  const [resolving, setResolving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setActive(null);

    fetchVideos(topic.q)
      .then((v) => !cancelled && setVideos(v))
      .catch(() => !cancelled && setError("تعذر الاتصال بمكتبة NASA."))
      .finally(() => !cancelled && setLoading(false));

    return () => {
      cancelled = true;
    };
  }, [topic]);

  async function openVideo(video) {
    setResolving(true);
    setActive({ video, src: null });
    try {
      const src = await resolveMp4(video.collection);
      setActive({ video, src });
    } catch {
      setActive({ video, src: null });
    } finally {
      setResolving(false);
    }
  }

  return (
    <section className="category-page videos-page">
      <p className="eyebrow">NASA IMAGE & VIDEO LIBRARY</p>
      <h2>فيديوهات حقيقية من NASA</h2>
      <p className="page-description">
        مقاطع رسمية من مكتبة NASA عن الشهب والكويكبات والدفاع الكوكبي.
      </p>

      <div className="topic-tabs">
        {TOPICS.map((t) => (
          <button
            key={t.id}
            className={topic.id === t.id ? "active" : ""}
            onClick={() => setTopic(t)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {active && (
        <div className="video-player">
          {active.src ? (
            <video src={active.src} controls autoPlay poster={active.video.thumb} />
          ) : (
            <div className="video-placeholder">
              {resolving ? (
                <>
                  <div className="spinner" />
                  <p>جارٍ تحميل الفيديو...</p>
                </>
              ) : (
                <p>تعذر تحميل ملف الفيديو. جرّب مقطعًا آخر.</p>
              )}
            </div>
          )}
          <div className="video-info">
            <h3>{active.video.title}</h3>
            <small>{active.video.date}</small>
            <p>{active.video.description.slice(0, 320)}</p>
            <button className="secondary-button" onClick={() => setActive(null)}>
              إغلاق
            </button>
          </div>
        </div>
      )}

      {loading && (
        <div className="loading-screen">
          <div className="spinner" />
          <p>جارٍ البحث في مكتبة NASA...</p>
        </div>
      )}

      {error && (
        <div className="fallback-links">
          <p className="error-note">⚠ {error} روابط رسمية بديلة:</p>
          {FALLBACK_LINKS.map((l) => (
            <a key={l.url} href={l.url} target="_blank" rel="noreferrer">
              ↗ {l.title}
            </a>
          ))}
        </div>
      )}

      {!loading && !error && (
        <div className="video-grid">
          {videos.map((v) => (
            <article
              key={v.id}
              className={`video-card ${active?.video.id === v.id ? "selected-card" : ""}`}
              onClick={() => openVideo(v)}
            >
              <div className="video-thumb">
                {v.thumb && <img src={v.thumb} alt={v.title} loading="lazy" />}
                <span className="play-icon">▶</span>
              </div>
              <h3>{v.title}</h3>
              <small>{v.date}</small>
            </article>
          ))}
          {!videos.length && <p className="page-description">لا توجد نتائج لهذا الموضوع.</p>}
        </div>
      )}
    </section>
  );
}