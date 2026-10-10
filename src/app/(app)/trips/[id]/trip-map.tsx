"use client";

// Leaflet 지도. window를 쓰므로 trip-view에서 next/dynamic({ ssr: false })로만 불러온다.
// 타일은 OpenStreetMap(무료, 저작자 표시 필수) -- 가족 규모의 낮은 트래픽 전제.
import "leaflet/dist/leaflet.css";
import { useEffect, useRef } from "react";
import L from "leaflet";
import { catColor, directionsUrl } from "@/lib/trip/engine";
import type { CandidatePin, MapStop } from "@/lib/trip/view-model";

export type TripMapProps = {
  stops: MapStop[];
  candidates: CandidatePin[];
  selectedId: string | null;
  // 값이 바뀔 때마다 해당 동작을 한 번 실행한다 (같은 버튼을 다시 눌러도 동작하도록)
  focusNonce: number;
  fitNonce: number;
  center: [number, number];
  visible: boolean;
  onSelect: (id: string) => void;
  onAdd: (placeId: string) => void;
  // 위치 지정 모드: 지도를 누른 곳이 pickPoint가 된다 (모드가 켜진 동안 핀 선택·팝업은 그대로 동작)
  picking?: boolean;
  pickPoint?: [number, number] | null;
  onPickPoint?: (lat: number, lon: number) => void;
};

const ACCENT = "#ea8a3d";

function pinIcon(stop: MapStop, selected: boolean): L.DivIcon {
  const size = selected ? 32 : 24;
  const el = document.createElement("div");
  const finished = stop.status === "done" || stop.status === "skipped";
  el.textContent = stop.status === "done" ? "✓" : String(stop.number);
  el.style.cssText = [
    `width:${size}px`, `height:${size}px`, "border-radius:50%", `background:${catColor(stop.cat)}`,
    `border:${selected ? 3 : 2}px solid ${selected ? ACCENT : "#fff"}`, "color:#fff", "display:flex",
    "align-items:center", "justify-content:center", `font-size:${selected ? 13 : 11}px`, "font-weight:800",
    "box-shadow:0 2px 8px #3336", finished ? "opacity:.6" : "",
  ].join(";");
  return L.divIcon({ className: "", html: el, iconSize: [size, size], iconAnchor: [size / 2, size / 2] });
}

function pickIcon(): L.DivIcon {
  const el = document.createElement("div");
  el.textContent = "📍";
  el.style.cssText = "font-size:28px;line-height:28px;transform:translate(-50%,-100%);filter:drop-shadow(0 2px 3px #0005)";
  return L.divIcon({ className: "", html: el, iconSize: [0, 0], iconAnchor: [0, 0] });
}

function candidateIcon(c: CandidatePin): L.DivIcon {
  const el = document.createElement("div");
  el.textContent = "+";
  el.style.cssText = `width:20px;height:20px;border-radius:50%;background:#fff;border:2px dashed ${catColor(c.cat)};color:${catColor(c.cat)};display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:800`;
  return L.divIcon({ className: "", html: el, iconSize: [20, 20], iconAnchor: [10, 10] });
}

// 사용자 입력이 섞인 문자열은 textContent로만 넣는다 (HTML 주입 방지)
function popupFor(info: { name: string; addr?: string; hours?: string; lat: number; lon: number }, action?: { label: string; run: () => void }): HTMLElement {
  const box = document.createElement("div");
  const name = document.createElement("strong");
  name.textContent = info.name;
  box.appendChild(name);
  for (const text of [info.addr, info.hours]) {
    if (!text) continue;
    box.appendChild(document.createElement("br"));
    const line = document.createElement("span");
    line.textContent = text;
    box.appendChild(line);
  }
  box.appendChild(document.createElement("br"));
  const link = document.createElement("a");
  link.href = directionsUrl({ id: "x", name: info.name, lat: info.lat, lon: info.lon }, "walk");
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  link.textContent = "길찾기 ↗";
  link.style.cssText = "color:#cf6f28;font-weight:800";
  box.appendChild(link);
  if (action) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = action.label;
    btn.style.cssText = "display:block;margin-top:6px;padding:4px 8px;border-radius:8px;border:1px solid #ea8a3d;color:#a8571e;font-weight:700;background:#fff4e8";
    btn.addEventListener("click", action.run);
    box.appendChild(btn);
  }
  return box;
}

export default function TripMap(props: TripMapProps) {
  const { stops, candidates, selectedId, focusNonce, fitNonce, center, visible, onSelect, onAdd, picking = false, pickPoint = null, onPickPoint } = props;
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerRef = useRef<L.LayerGroup | null>(null);
  const markersRef = useRef<Map<string, { marker: L.Marker; stop: MapStop }>>(new Map());
  // 콜백은 최신 값을 쓰되 지도를 다시 만들지 않도록 ref에 둔다
  const cb = useRef({ onSelect, onAdd, onPickPoint, picking });
  useEffect(() => {
    cb.current = { onSelect, onAdd, onPickPoint, picking };
  });
  const pickMarkerRef = useRef<L.Marker | null>(null);

  // 동선이 실제로 바뀌었을 때만 화면 맞춤을 다시 한다 (선택만 바뀔 때는 맞춤하지 않음)
  const routeKey = stops.map((s) => `${s.id}@${s.lat},${s.lon}`).join("|") + "#" + candidates.length;

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = L.map(containerRef.current, { scrollWheelZoom: false, zoomControl: true }).setView(center, 15);
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: "&copy; OpenStreetMap contributors" }).addTo(map);
    layerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;
    map.on("click", (e: L.LeafletMouseEvent) => {
      if (cb.current.picking) cb.current.onPickPoint?.(e.latlng.lat, e.latlng.lng);
    });
    const markers = markersRef.current;
    return () => {
      map.remove();
      pickMarkerRef.current = null;
      mapRef.current = null;
      layerRef.current = null;
      markers.clear();
    };
    // 지도는 한 번만 만든다 (center는 초기 위치로만 사용)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 핀과 경로 다시 그리기
  useEffect(() => {
    const map = mapRef.current;
    const layer = layerRef.current;
    if (!map || !layer) return;
    layer.clearLayers();
    markersRef.current.clear();

    if (stops.length > 1) {
      L.polyline(stops.map((s) => [s.lat, s.lon] as [number, number]), { color: "#536b56", weight: 3, opacity: 0.65, dashArray: "6 7" }).addTo(layer);
    }
    for (const c of candidates) {
      L.marker([c.lat, c.lon], { icon: candidateIcon(c) })
        .bindPopup(popupFor(c, { label: "오늘 일정에 추가", run: () => cb.current.onAdd(c.placeId) }))
        .addTo(layer);
    }
    for (const s of stops) {
      const marker = L.marker([s.lat, s.lon], { icon: pinIcon(s, s.id === selectedId), title: `${s.number}. ${s.name}` })
        .bindPopup(popupFor(s))
        .on("click", () => cb.current.onSelect(s.id))
        .addTo(layer);
      markersRef.current.set(s.id, { marker, stop: s });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stops, candidates]);

  // 선택 핀 강조 (핀을 다시 그릴 때마다 선택 표시를 맞춘다)
  useEffect(() => {
    for (const [id, { marker, stop }] of markersRef.current) marker.setIcon(pinIcon(stop, id === selectedId));
  }, [selectedId, stops]);

  // 선택이 바뀌면 그 핀이 보이도록 이동만 한다. 처음 렌더에서는 이동하지 않는다 (전체 동선 맞춤이 우선).
  // "처음 한 번 건너뛰기" 플래그 대신 이전 값과 비교한다: 개발 모드(StrictMode)는 효과를 두 번 실행하기 때문.
  const prevSelected = useRef(selectedId);
  useEffect(() => {
    if (prevSelected.current === selectedId) return;
    prevSelected.current = selectedId;
    const sel = selectedId ? markersRef.current.get(selectedId) : undefined;
    if (sel) mapRef.current?.panTo([sel.stop.lat, sel.stop.lon], { animate: true });
  }, [selectedId]);

  // 목록에서 장소를 눌렀을 때만 확대한다 (참고한 원본: 목록에서 장소를 누르면 확대)
  const prevFocus = useRef(focusNonce);
  useEffect(() => {
    if (prevFocus.current === focusNonce) return;
    prevFocus.current = focusNonce;
    const map = mapRef.current;
    const sel = selectedId ? markersRef.current.get(selectedId) : undefined;
    if (map && sel) map.setView([sel.stop.lat, sel.stop.lon], Math.max(map.getZoom(), 16), { animate: true });
    // 확대 시점은 focusNonce가 정한다 (selectedId는 그 순간의 값만 읽는다)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusNonce]);

  // 오늘 동선 전체 보기
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    map.invalidateSize();
    const pts = [...stops.map((s) => [s.lat, s.lon] as [number, number]), ...candidates.map((c) => [c.lat, c.lon] as [number, number])];
    if (pts.length > 1) map.fitBounds(pts, { padding: [30, 30], maxZoom: 16 });
    else if (pts.length === 1) map.setView(pts[0], 16);
    else map.setView(center, 15);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeKey, fitNonce]);

  // 위치 지정 모드: 누른 곳에 📍 핀을 보여주고, 십자 커서로 바꾼다. 지도 높이가 바뀌므로 크기도 다시 계산한다.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    map.getContainer().style.cursor = picking ? "crosshair" : "";
    const t = setTimeout(() => map.invalidateSize(), 60);
    return () => clearTimeout(t);
  }, [picking]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    pickMarkerRef.current?.remove();
    pickMarkerRef.current = null;
    if (!picking || !pickPoint) return;
    pickMarkerRef.current = L.marker(pickPoint, { icon: pickIcon(), interactive: false, zIndexOffset: 1000 }).addTo(map);
    if (!map.getBounds().contains(pickPoint)) map.panTo(pickPoint);
  }, [picking, pickPoint]);

  // 접었다 펼친 뒤 크기를 다시 계산
  useEffect(() => {
    if (!visible) return;
    const t = setTimeout(() => mapRef.current?.invalidateSize(), 60);
    return () => clearTimeout(t);
  }, [visible]);

  return <div ref={containerRef} role="region" aria-label="여행 지도" className="h-full w-full" />;
}
