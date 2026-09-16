"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { saveDailyColor } from "@/app/actions";
import { nearestColorName, matchPercent } from "@/lib/color-names";

export function ColorHuntCamera({
  missionHex,
  missionName,
  colorDate,
}: {
  missionHex: string;
  missionName: string;
  colorDate: string;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const [currentHex, setCurrentHex] = useState("#cccccc");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [markerSize, setMarkerSize] = useState(0);

  // The video element is rendered at exactly the viewport's box (object-cover
  // fills w-full h-full), so the crop this component samples from -- the
  // center square whose side is 30% of the frame's shorter dimension -- maps
  // 1:1 onto 30% of the shorter side of this box. Track it with a
  // ResizeObserver so the on-screen marker always matches what's sampled,
  // not just a fixed guess at phone-vs-tablet layout.
  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setMarkerSize(Math.min(width, height) * 0.3);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    let stream: MediaStream | null = null;
    let raf = 0;

    function sample() {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext("2d");
      if (video && canvas && ctx && video.readyState >= 2 && video.videoWidth > 0) {
        const size = 16;
        canvas.width = size;
        canvas.height = size;
        // Sample a square crop from the center of the frame, not the whole
        // frame -- that's what the on-screen viewfinder crosshair implies.
        const vw = video.videoWidth;
        const vh = video.videoHeight;
        const crop = Math.min(vw, vh) * 0.3;
        ctx.drawImage(video, (vw - crop) / 2, (vh - crop) / 2, crop, crop, 0, 0, size, size);
        const { data } = ctx.getImageData(0, 0, size, size);
        let r = 0;
        let g = 0;
        let b = 0;
        let n = 0;
        for (let i = 0; i < data.length; i += 4) {
          r += data[i];
          g += data[i + 1];
          b += data[i + 2];
          n++;
        }
        const toHex = (v: number) => Math.round(v / n).toString(16).padStart(2, "0");
        setCurrentHex(`#${toHex(r)}${toHex(g)}${toHex(b)}`);
      }
      raf = requestAnimationFrame(sample);
    }

    async function start() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        raf = requestAnimationFrame(sample);
      } catch {
        setError("카메라를 사용할 수 없어요. 브라우저 권한을 확인해주세요.");
      }
    }

    start();
    return () => {
      cancelAnimationFrame(raf);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const match = matchPercent(currentHex, missionHex);

  const handleCapture = async () => {
    setPending(true);
    const formData = new FormData();
    formData.set("hex", currentHex);
    formData.set("color_date", colorDate);
    formData.set("name", nearestColorName(currentHex));
    formData.set("mission_hex", missionHex);
    formData.set("mission_name", missionName);
    formData.set("match_percent", String(match));
    await saveDailyColor(formData);
    router.push("/");
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black text-white">
      <div ref={viewportRef} className="relative flex-1 overflow-hidden">
        <video ref={videoRef} playsInline muted className="h-full w-full object-cover" />
        <canvas ref={canvasRef} className="hidden" />
        {markerSize > 0 && !error && (
          <div
            aria-hidden
            data-testid="color-sample-marker"
            className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-md border-2 border-white/90 shadow-[0_0_0_9999px_rgba(0,0,0,0.15)]"
            style={{ width: markerSize, height: markerSize }}
          >
            <span className="absolute top-1/2 left-1/2 h-3 w-px -translate-x-1/2 -translate-y-1/2 bg-white/90" />
            <span className="absolute top-1/2 left-1/2 h-px w-3 -translate-x-1/2 -translate-y-1/2 bg-white/90" />
          </div>
        )}
        <button
          type="button"
          onClick={() => router.back()}
          className="absolute left-4 top-4 z-10 rounded-full bg-black/50 px-4 py-2 text-sm"
        >
          닫기
        </button>
        {error && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/85 px-6 text-center text-sm">
            {error}
          </div>
        )}
      </div>

      <div className="flex flex-col gap-3 bg-black/90 p-4 pb-6">
        <div className="flex items-center justify-between text-sm">
          <span className="text-neutral-400">미션</span>
          <div className="flex items-center gap-2">
            <span className="h-6 w-6 rounded-md border border-white/20" style={{ background: missionHex }} />
            <span>
              {missionName} · {missionHex}
            </span>
          </div>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-neutral-400">현재</span>
          <div className="flex items-center gap-2">
            <span className="h-6 w-6 rounded-md border border-white/20" style={{ background: currentHex }} />
            <span>{currentHex}</span>
          </div>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-neutral-700">
          <div className="h-full bg-accent-400 transition-all" style={{ width: `${match}%` }} />
        </div>
        <p className="text-center text-xs text-neutral-400">{match}% 일치</p>

        <button
          type="button"
          onClick={handleCapture}
          disabled={pending || !!error}
          className="mx-auto mt-1 h-16 w-16 rounded-full border-4 border-white bg-white/20 disabled:opacity-40"
          aria-label="채집하기"
        />
      </div>
    </div>
  );
}
