import React, { useRef } from "react";
import { Upload, Video, ShieldCheck } from "lucide-react";

interface VideoUploaderProps {
  onVideoSelected: (file: File) => void;
}

export const VideoUploader: React.FC<VideoUploaderProps> = ({ onVideoSelected }) => {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      onVideoSelected(e.target.files[0]);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      onVideoSelected(e.dataTransfer.files[0]);
    }
  };

  return (
    <div className="max-w-3xl mx-auto my-12">
      <div
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className="border-2 border-dashed border-border hover:border-primary/60 bg-surface/50 hover:bg-card/70 transition-all rounded-2xl p-12 text-center cursor-pointer shadow-xl group"
      >
        <input
          ref={inputRef}
          type="file"
          accept="video/mp4,video/mov,video/avi,video/webm"
          className="hidden"
          onChange={handleFileChange}
        />

        <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
          <Upload className="w-8 h-8" />
        </div>

        <h3 className="text-xl font-bold text-slate-100 mb-2">
          Upload Running Video
        </h3>
        <p className="text-sm text-slate-400 max-w-md mx-auto mb-6">
          Drag and drop a side-profile running video (.mp4, .mov, or .avi). For optimal biomechanical tracking, ensure full body visibility from head to toe.
        </p>

        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-card border border-border text-xs font-semibold text-slate-300">
          <Video className="w-4 h-4 text-primary" />
          <span>Recommended: 10–30s video at 30–60 FPS</span>
        </div>
      </div>

      <div className="mt-6 flex items-center justify-center gap-6 text-xs text-slate-400">
        <span className="flex items-center gap-1.5">
          <ShieldCheck className="w-4 h-4 text-success" /> 100% In-Browser Local Processing
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-primary inline-block"></span> WebGL Pose Acceleration
        </span>
      </div>
    </div>
  );
};
