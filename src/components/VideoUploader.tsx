import React, { useRef, useState } from "react";
import { Upload, Video, Camera, Ruler, Timer, Sun } from "lucide-react";

interface VideoUploaderProps {
  onVideoSelected: (file: File) => void;
  samplingRateFps: number;
  maxAnalyzedSeconds: number;
}

const filmingTips = [
  { icon: Camera, title: "Film side-on", text: "Camera perpendicular to the running direction, at hip height." },
  { icon: Ruler, title: "Whole body in frame", text: "Head to feet visible throughout, runner filling about half the frame height." },
  { icon: Timer, title: "5-15 s of steady running", text: "Constant pace on a treadmill or flat ground; at least 6 steps." },
  { icon: Sun, title: "Good light, steady camera", text: "Use a tripod, 30 or 60 frames/s, and avoid baggy clothing." },
];

export const VideoUploader: React.FC<VideoUploaderProps> = ({ onVideoSelected, samplingRateFps, maxAnalyzedSeconds }) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) onVideoSelected(file);
    event.target.value = "";
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(false);
    const file = event.dataTransfer.files[0];
    if (file) onVideoSelected(file);
  };

  return (
    <div className="mx-auto my-8 max-w-6xl sm:my-14">
      <div className="grid items-start gap-8 lg:grid-cols-[1fr_1.05fr] lg:gap-12">
        <section>
          <p className="eyebrow">Video gait analysis</p>
          <h2 className="mt-3 text-3xl font-semibold leading-tight tracking-tight text-ink sm:text-4xl">
            Measure your running form from a phone video
          </h2>
          <p className="mt-4 max-w-lg text-[15px] leading-relaxed text-body">
            Cadence, foot strike, knee bend, trunk lean and left/right symmetry, each compared with ranges reported in
            running biomechanics research.
          </p>

          <div className="mt-8">
            <h3 className="text-sm font-semibold text-ink">For accurate results</h3>
            <ul className="mt-3 grid gap-3 sm:grid-cols-2">
              {filmingTips.map(({ icon: Icon, title, text }) => (
                <li key={title} className="flex gap-3 rounded-xl border border-border bg-surface p-3.5 shadow-card">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/[0.07] text-primary">
                    <Icon className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <div>
                    <p className="text-[13px] font-semibold text-ink">{title}</p>
                    <p className="mt-0.5 text-xs leading-relaxed text-body">{text}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <div
          onDragOver={(event) => {
            event.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          className={`flex min-h-80 flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-12 text-center transition-colors sm:min-h-[26rem] ${
            isDragging ? "border-primary bg-primary/[0.04]" : "border-border-strong bg-surface"
          }`}
        >
          <input
            ref={inputRef}
            type="file"
            accept="video/mp4,video/quicktime,video/x-msvideo,video/webm,.mp4,.mov,.avi,.webm"
            className="sr-only"
            tabIndex={-1}
            aria-hidden="true"
            onChange={handleFileChange}
          />
          <span className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/[0.07] text-primary">
            <Upload className="h-6 w-6" aria-hidden="true" />
          </span>
          <h3 className="text-lg font-semibold text-ink">Drop a running video here</h3>
          <p className="mt-1 text-sm text-muted">MP4, MOV, AVI or WebM</p>
          <button type="button" onClick={() => inputRef.current?.click()} className="primary-button mt-6">
            <Video className="h-4 w-4" aria-hidden="true" />
            Choose video
          </button>
          <dl className="mt-10 grid w-full max-w-sm grid-cols-2 gap-4 border-t border-border pt-5 text-left">
            <div>
              <dt className="eyebrow">Sampling</dt>
              <dd className="mt-1 text-sm font-medium text-ink">{samplingRateFps} frames / second</dd>
            </div>
            <div>
              <dt className="eyebrow">Analysed</dt>
              <dd className="mt-1 text-sm font-medium text-ink">First {maxAnalyzedSeconds} seconds</dd>
            </div>
          </dl>
        </div>
      </div>
    </div>
  );
};
