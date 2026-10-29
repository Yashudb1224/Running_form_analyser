import React, { useRef } from "react";
import { Upload, Video, ShieldCheck } from "lucide-react";

interface VideoUploaderProps {
  onVideoSelected: (file: File) => void;
}

export const VideoUploader: React.FC<VideoUploaderProps> = ({ onVideoSelected }) => {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) onVideoSelected(file);
    event.target.value = "";
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const file = event.dataTransfer.files[0];
    if (file) onVideoSelected(file);
  };

  return (
    <div className="mx-auto my-8 max-w-6xl sm:my-12">
      <div className="grid gap-8 lg:grid-cols-[0.8fr_1.2fr] lg:gap-12">
        <section className="flex flex-col justify-between border-l-[3px] border-primary py-2 pl-5 sm:pl-7">
          <div>
            <p className="eyebrow">Stride Lab <span className="px-1 text-slate-300">/</span> Session input</p>
            <h2 className="mt-3 text-3xl font-semibold leading-tight tracking-tight text-slate-900 sm:text-4xl">
              Running motion<br className="hidden sm:block lg:hidden" /> analysis
            </h2>
          </div>
          <dl className="mt-8 grid max-w-sm grid-cols-2 gap-x-6 gap-y-5 border-t border-border pt-5">
            <div>
              <dt className="eyebrow">Format</dt>
              <dd className="mt-1 text-sm font-medium text-slate-800">MP4 · MOV · AVI · WebM</dd>
            </div>
            <div>
              <dt className="eyebrow">Sampling</dt>
              <dd className="mt-1 text-sm font-medium text-slate-800">10 frames / second</dd>
            </div>
            <div>
              <dt className="eyebrow">Analysis window</dt>
              <dd className="mt-1 text-sm font-medium text-slate-800">First 60 seconds</dd>
            </div>
            <div>
              <dt className="eyebrow">Maximum</dt>
              <dd className="mt-1 text-sm font-medium text-slate-800">600 frames</dd>
            </div>
          </dl>
        </section>

        <div
          onDragOver={(event) => event.preventDefault()}
          onDrop={handleDrop}
          className="panel flex min-h-72 flex-col items-center justify-center border-dashed bg-white px-5 py-10 text-center sm:min-h-80 sm:px-10"
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
          <span className="mb-5 flex h-12 w-12 items-center justify-center border border-border bg-card text-primary">
            <Upload className="h-5 w-5" aria-hidden="true" />
          </span>
          <h3 className="text-lg font-semibold text-slate-900">Select a running video</h3>
          <p className="mt-1 text-sm text-slate-500">or drag and drop a file here</p>
          <button type="button" onClick={() => inputRef.current?.click()} className="primary-button mt-5">
            <Video className="h-4 w-4" aria-hidden="true" />
            Browse videos
          </button>
        </div>
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4 text-xs text-slate-600">
        <span className="inline-flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-success" aria-hidden="true" />Video stays in this browser</span>
        <span>Pose assets load from jsDelivr</span>
      </div>
    </div>
  );
};
