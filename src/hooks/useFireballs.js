import { useEffect, useState } from "react";

/**
 * يجلب أحداث الشهب الحقيقية من NASA CNEOS Fireball API
 * ويحوّلها لشكل جاهز للعرض والمحاكاة.
 *
 * API: https://ssd-api.jpl.nasa.gov/fireball.api
 * تم استخدام وسيط CORS لتجنب حظر المتصفحات للطلبات المباشرة
 */

const BASE_NASA_URL =
  "https://ssd-api.jpl.nasa.gov/fireball.api?req-loc=true&sort=-date&limit=";

// وسيط لتخطي حظر CORS من المتصفح مباشرة
const getProxyUrl = (limit) =>
  `https://api.allorigins.win/raw?url=${encodeURIComponent(BASE_NASA_URL + limit)}`;

// أرشيف احتياطي بأحداث حقيقية مشهورة (لو النت قطع وقت العرض)
const FALLBACK = [
  { date: "2013-02-15 03:20:33", energy: 440, lat: 54.8, latDir: "N", lon: 61.1, lonDir: "E", altitude: 23.3, velocity: 18.6 },
  { date: "2018-12-18 23:48:20", energy: 49, lat: 56.9, latDir: "N", lon: 172.4, lonDir: "E", altitude: 25.6, velocity: 32.0 },
  { date: "2023-02-13 02:59:00", energy: 0.13, lat: 49.9, latDir: "N", lon: 0.9, lonDir: "W", altitude: 27.0, velocity: 14.0 },
  { date: "2022-11-19 08:26:00", energy: 0.11, lat: 43.0, latDir: "N", lon: 78.9, lonDir: "W", altitude: 29.0, velocity: 16.0 },
  { date: "2020-12-22 23:23:33", energy: 9.5, lat: 31.9, latDir: "N", lon: 96.2, lonDir: "E", altitude: 35.5, velocity: 13.6 },
  { date: "2019-06-22 21:25:48", energy: 6.0, lat: 14.9, latDir: "N", lon: 66.2, lonDir: "W", altitude: 25.0, velocity: 14.9 },
  { date: "2021-02-28 21:54:00", energy: 0.1, lat: 51.4, latDir: "N", lon: 2.4, lonDir: "W", altitude: 27.0, velocity: 13.0 },
  { date: "2016-02-06 13:55:00", energy: 13, lat: 30.4, latDir: "S", lon: 25.5, lonDir: "W", altitude: 31.0, velocity: 15.6 },
  { date: "2009-10-08 02:57:00", energy: 33, lat: 4.5, latDir: "S", lon: 120.0, lonDir: "E", altitude: 19.1, velocity: 19.2 },
  { date: "2023-08-23 17:07:00", energy: 0.4, lat: 30.2, latDir: "N", lon: 31.5, lonDir: "E", altitude: 30.0, velocity: 17.0 },
];

// تحديد منطقة تقريبية من الإحداثيات (بدون API خارجي)
function regionFromCoords(lat, lon) {
  if (lat > 22 && lat < 32 && lon > 24 && lon < 37) return "مصر";
  if (lat > 12 && lat < 42 && lon > 34 && lon < 60) return "الشرق الأوسط";
  if (lat > 35 && lat < 72 && lon > -10 && lon < 40) return "أوروبا";
  if (lat > 40 && lat < 75 && lon > 40 && lon < 180) return "روسيا / سيبيريا";
  if (lat > 15 && lat < 55 && lon > 60 && lon < 150) return "آسيا";
  if (lat > 25 && lat < 70 && lon > -170 && lon < -50) return "أمريكا الشمالية";
  if (lat > -55 && lat < 25 && lon > -90 && lon < -30) return "أمريكا الجنوبية";
  if (lat > -40 && lat < 35 && lon > -20 && lon < 55) return "أفريقيا";
  if (lat > -50 && lat < -10 && lon > 110 && lon < 180) return "أستراليا";
  if (Math.abs(lat) > 60) return "المنطقة القطبية";
  return "المحيط";
}

// تصنيف الطاقة (كيلوطن TNT) + لون + نسبة خطر
function classify(energy) {
  if (energy >= 100) return { label: "حدث كارثي", color: "#ff3b5c", risk: 95 };
  if (energy >= 10) return { label: "انفجار كبير", color: "#ff7a3d", risk: 75 };
  if (energy >= 1) return { label: "شهاب قوي", color: "#ffb93d", risk: 45 };
  if (energy >= 0.3) return { label: "شهاب متوسط", color: "#a879ff", risk: 25 };
  return { label: "شهاب صغير", color: "#53ddff", risk: 10 };
}

// تحويل صف خام لكائن جاهز
function normalize(raw, index) {
  const lat = Number(raw.lat) || 0;
  const lon = Number(raw.lon) || 0;
  const signedLat = raw.latDir === "S" ? -lat : lat;
  const signedLon = raw.lonDir === "W" ? -lon : lon;
  const energy = Number(raw.energy) || 0.1;
  const cls = classify(energy);

  return {
    id: `${raw.date}-${index}`,
    date: raw.date.split(" ")[0],
    time: raw.date.split(" ")[1]?.slice(0, 5) || "--:--",
    fullDate: raw.date,
    energy: energy < 1 ? energy.toFixed(2) : energy.toFixed(1),
    energyNum: energy,
    energyLabel: cls.label,
    color: cls.color,
    risk: cls.risk,
    lat,
    lon,
    latDir: raw.latDir,
    lonDir: raw.lonDir,
    signedLat,
    signedLon,
    altitude: raw.altitude ? Number(raw.altitude) : null,
    velocity: raw.velocity ? Number(raw.velocity) : null,
    region: regionFromCoords(signedLat, signedLon),
    // قيمة تقديرية لقطر الجسم (متر) من الطاقة — تقريب علمي مبسط
    diameter: Math.max(0.5, Math.round(Math.cbrt(energy) * 3.2 * 10) / 10),
  };
}

// تحويل رد NASA (fields + data arrays) لصفوف
function parseNasa(json) {
  if (!json || !json.fields || !json.data) return [];
  const f = json.fields;
  const idx = (name) => f.indexOf(name);

  return json.data
    .map((row) => ({
      date: row[idx("date")],
      energy: row[idx("impact-e")],
      lat: row[idx("lat")],
      latDir: row[idx("lat-dir")],
      lon: row[idx("lon")],
      lonDir: row[idx("lon-dir")],
      altitude: row[idx("alt")],
      velocity: row[idx("vel")],
    }))
    .filter((r) => r.lat && r.lon); // بعض الأحداث بدون إحداثيات
}

export function useFireballs(limit = 20) {
  const [fireballs, setFireballs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [source, setSource] = useState("loading"); // nasa | fallback

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    // زيادة المهلة إلى 15 ثانية لاستيعاب خوادم ناسا والبروكسي
    const timeout = setTimeout(() => controller.abort(), 15000);

    async function load() {
      try {
        const targetUrl = getProxyUrl(limit * 2);
        const res = await fetch(targetUrl, {
          signal: controller.signal,
        });

        if (!res.ok) throw new Error(`Server responded with status: ${res.status}`);

        const json = await res.json();
        const rows = parseNasa(json).slice(0, limit);
        if (!rows.length) throw new Error("No events found or invalid format");

        if (!cancelled) {
          setFireballs(rows.map(normalize));
          setSource("nasa");
          setError(null);
        }
      } catch (e) {
        if (!cancelled) {
          setError(
            e.name === "AbortError"
              ? "انتهت مهلة الاتصال بـ NASA — تم استخدام الأرشيف المحلي."
              : "تعذر الاتصال بـ NASA — تم استخدام الأرشيف المحلي."
          );
          setFireballs(FALLBACK.map(normalize));
          setSource("fallback");
        }
      } finally {
        clearTimeout(timeout);
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [limit]);

  return { fireballs, loading, error, source };
}