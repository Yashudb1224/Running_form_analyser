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
    <div className="rise-in mx-auto my-8 max-w-6xl sm:my-14">
      <div className="grid items-start gap-8 lg:grid-cols-[1fr_1.05fr] lg:gap-12">
        <section>
          <span className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-brand-soft px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-primary">
            <span className="h-1.5 w-1.5 rounded-full bg-brand-gradient" aria-hidden="true" />
            AI gait analysis
          </span>
          <h2 className="mt-4 text-4xl font-bold leading-[1.1] tracking-tight text-ink sm:text-5xl">
            See your <span className="text-gradient">running form</span> like a lab does
          </h2>
          <p className="mt-4 max-w-lg text-[15px] leading-relaxed text-body">
            Cadence, foot strike, knee bend, trunk lean and left/right symmetry, each compared with ranges reported in
            running biomechanics research.
          </p>

          <div className="mt-8">
            <h3 className="text-sm font-semibold text-ink">For accurate results</h3>
            <ul className="mt-3 grid gap-3 sm:grid-cols-2">
              {filmingTips.map(({ icon: Icon, title, text }) => (
                <li key={title} className="panel panel-interactive flex gap-3 p-3.5">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-gradient text-white shadow-md">
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
          className={`gradient-border transition duration-200 ${isDragging ? "scale-[1.01] shadow-raised" : "shadow-card"}`}
        >
          <div className={`flex min-h-80 flex-col items-center justify-center rounded-[14px] px-6 py-12 text-center sm:min-h-[26rem] ${
            isDragging ? "bg-brand-soft" : "bg-surface"
          }`}>
          <input
            ref={inputRef}
            type="file"
            accept="video/mp4,video/quicktime,video/x-msvideo,video/webm,.mp4,.mov,.avi,.webm"
            className="sr-only"
            tabIndex={-1}
            aria-hidden="true"
            onChange={handleFileChange}
          />
          <span className="relative mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-gradient text-white shadow-lg">
            <span className="absolute inset-0 animate-ping rounded-2xl bg-brand-gradient opacity-20 motion-reduce:hidden" aria-hidden="true" />
            <Upload className="relative h-7 w-7" aria-hidden="true" />
          </span>
          <h3 className="text-xl font-semibold text-ink">Drop a running video here</h3>
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
    </div>
  );
};
