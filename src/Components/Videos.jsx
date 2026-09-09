import { useEffect, useRef, useState } from "react";

const NASA_SEARCH =
  "https://images-api.nasa.gov/search?media_type=video&q=";

const TOPICS = [
  { id: "meteor", label: "الشهب", q: "meteor" },
  { id: "asteroid", label: "الكويكبات", q: "asteroid" },
  { id: "chelyabinsk", label: "تشيليابينسك", q: "chelyabinsk" },
  { id: "dart", label: "مهمة DART", q: "DART" },
];

const FALLBACK_LINKS = [
  {
    title: "NASA CNEOS Fireballs",
    url: "https://cneos.jpl.nasa.gov/fireballs/",
  },
  {
    title: "NASA Planetary Defense",
    url: "https://www.nasa.gov/planetarydefense/",
  },
  {
    title: "NASA Image & Video Library",
    url: "https://images.nasa.gov/search?q=meteor&media=video",
  },
];

function toHttps(url) {
  return typeof url === "string"
    ? url.replace(/^http:\/\//i, "https://")
    : "";
}

// المهلة تشمل تحميل الاستجابة وقراءة JSON.
async function fetchJsonWithTimeout(url, ms = 15000) {
  if (!url) {
    throw new Error("رابط البيانات غير متوفر.");
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`NASA HTTP ${response.status}`);
    }

    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}

async function fetchVideos(q) {
  const url = NASA_SEARCH + encodeURIComponent(q);
  const json = await fetchJsonWithTimeout(url);
  const items = json.collection?.items;

  console.log("NASA search URL:", url);
  console.log("NASA response:", json);

  if (!Array.isArray(items)) {
    throw new Error("استجابة NASA لا تحتوي على قائمة نتائج متوقعة.");
  }

  console.log("NASA results count:", items.length);

  return items.map((item, index) => {
    const data = item.data?.[0] || {};

    const thumbnail = item.links?.find(
      (link) => link.rel === "preview"
    )?.href;

    return {
      id: data.nasa_id || `${q}-${index}`,
      title: data.title || "NASA Video",
      description: data.description || "",
      date: (data.date_created || "").slice(0, 10),
      thumb: toHttps(thumbnail),
      collection: toHttps(item.href),
    };
  });
}

async function resolveMp4(collectionUrl) {
  const json = await fetchJsonWithTimeout(collectionUrl);

  if (!Array.isArray(json)) {
    throw new Error("قائمة ملفات الفيديو ليست بالشكل المتوقع.");
  }

  const mp4s = json
    .filter((file) => typeof file === "string")
    .map(toHttps)
    .filter((file) => /\.mp4(?:[?#]|$)/i.test(file));

  const src =
    mp4s.find((file) => file.toLowerCase().includes("~mobile")) ||
    mp4s.find((file) => file.toLowerCase().includes("~small")) ||
    mp4s.find((file) => file.toLowerCase().includes("~medium")) ||
    mp4s[0];

  if (!src) {
    throw new Error("لا يوجد ملف MP4 متاح لهذا المقطع.");
  }

  return src;
}

function getErrorMessage(err) {
  if (err?.name === "AbortError") {
    return "انتهت مهلة الاتصال بمكتبة NASA. جرّب مرة أخرى.";
  }

  return err?.message || "حدث خطأ غير متوقع.";
}

export default function Videos() {
  const [topic, setTopic] = useState(TOPICS[0]);
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [retryCount, setRetryCount] = useState(0);

  const [active, setActive] = useState(null);
  const [resolving, setResolving] = useState(false);
  const [playerError, setPlayerError] = useState(null);

  // يمنع طلب فيديو قديم من استبدال الفيديو المختار حاليًا.
  const playerRequestId = useRef(0);

  useEffect(() => {
    let cancelled = false;

    playerRequestId.current += 1;

    setLoading(true);
    setError(null);
    setVideos([]);
    setActive(null);
    setResolving(false);
    setPlayerError(null);

    fetchVideos(topic.q)
      .then((results) => {
        if (!cancelled) {
          setVideos(results);
        }
      })
      .catch((err) => {
        console.error("NASA videos error:", err);

        if (!cancelled) {
          setError(getErrorMessage(err));
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
      playerRequestId.current += 1;
    };
  }, [topic.q, retryCount]);

  async function openVideo(video) {
    const requestId = ++playerRequestId.current;

    setResolving(true);
    setPlayerError(null);
    setActive({ video, src: null });

    try {
      const src = await resolveMp4(video.collection);

      if (requestId === playerRequestId.current) {
        setActive({ video, src });
      }
    } catch (err) {
      console.error("NASA playback error:", err);

      if (requestId === playerRequestId.current) {
        setPlayerError(getErrorMessage(err));
      }
    } finally {
      if (requestId === playerRequestId.current) {
        setResolving(false);
      }
    }
  }

  function closeVideo() {
    playerRequestId.current += 1;
    setActive(null);
    setResolving(false);
    setPlayerError(null);
  }

  function retrySearch() {
    setRetryCount((count) => count + 1);
  }

  return (
    <section className="category-page videos-page">
      <p className="eyebrow">NASA IMAGE & VIDEO LIBRARY</p>

      <h2>فيديوهات حقيقية من NASA</h2>

      <p className="page-description">
        مقاطع رسمية من مكتبة NASA عن الشهب والكويكبات والدفاع الكوكبي.
      </p>

      <div className="topic-tabs">
        {TOPICS.map((item) => (
          <button
            key={item.id}
            type="button"
            className={topic.id === item.id ? "active" : ""}
            aria-pressed={topic.id === item.id}
            onClick={() => setTopic(item)}
          >
            {item.label}
          </button>
        ))}
      </div>

      {active && (
        <div className="video-player">
          {active.src && !playerError ? (
            <video
              key={active.src}
              src={active.src}
              controls
              autoPlay
              playsInline
              preload="metadata"
              poster={active.video.thumb || undefined}
              style={{
                width: "100%",
                maxHeight: "70vh",
                background: "#000",
              }}
              onError={() => {
                setPlayerError(
                  "تعذر تشغيل ملف الفيديو في المتصفح. جرّب مقطعًا آخر."
                );
              }}
            />
          ) : (
            <div className="video-placeholder" role="status">
              {resolving ? (
                <>
                  <div className="spinner" />
                  <p>جارٍ تحميل الفيديو...</p>
                </>
              ) : (
                <p className="error-note">
                  {playerError || "تعذر تحميل ملف الفيديو."}
                </p>
              )}
            </div>
          )}

          <div className="video-info">
            <h3>{active.video.title}</h3>
            <small>{active.video.date}</small>
            <p>{active.video.description.slice(0, 320)}</p>

            {playerError && (
              <button
                type="button"
                className="secondary-button"
                onClick={() => openVideo(active.video)}
              >
                إعادة محاولة التشغيل
              </button>
            )}

            <button
              type="button"
              className="secondary-button"
              onClick={closeVideo}
            >
              إغلاق
            </button>
          </div>
        </div>
      )}

      {loading && (
        <div className="loading-screen" role="status">
          <div className="spinner" />
          <p>جارٍ البحث في مكتبة NASA...</p>
        </div>
      )}

      {!loading && error && (
        <div className="fallback-links">
          <p className="error-note" role="alert">
            ⚠ تعذر جلب الفيديوهات: {error}
          </p>

          <button
            type="button"
            className="secondary-button"
            onClick={retrySearch}
          >
            إعادة المحاولة
          </button>

          <p>يمكنك زيارة المصادر الرسمية مباشرة:</p>

          {FALLBACK_LINKS.map((link) => (
            <a
              key={link.url}
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
            >
              ↗ {link.title}
            </a>
          ))}
        </div>
      )}

      {!loading && !error && videos.length > 0 && (
        <div className="video-grid">
          {videos.map((video) => (
            <article
              key={video.id}
              className={`video-card ${
                active?.video.id === video.id ? "selected-card" : ""
              }`}
              role="button"
              tabIndex={0}
              aria-label={`تشغيل ${video.title}`}
              onClick={() => openVideo(video)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  openVideo(video);
                }
              }}
            >
              <div className="video-thumb">
                {video.thumb && (
                  <img
                    src={video.thumb}
                    alt={video.title}
                    loading="lazy"
                  />
                )}
                <span className="play-icon" aria-hidden="true">
                  ▶
                </span>
              </div>

              <h3>{video.title}</h3>
              <small>{video.date}</small>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}