import React from "react";
import { LineChart, ShieldCheck, Video } from "lucide-react";
import { GoogleIcon } from "./GoogleIcon";

const benefits = [
  { icon: Video, text: "Analyse running videos in your browser; videos are never uploaded" },
  { icon: LineChart, text: "Your results are saved so you can track progress over time" },
  { icon: ShieldCheck, text: "Only you can see your saved analyses" },
];

export function SignInPanel({ onSignIn, error }: { onSignIn: () => void; error: string | null }) {
  return (
    <section className="rise-in mx-auto my-12 max-w-md sm:my-20" aria-labelledby="sign-in-heading">
      <div className="gradient-border shadow-raised">
      <div className="rounded-[14px] bg-surface p-6 sm:p-8">
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-gradient text-white shadow-md">
          <Video className="h-6 w-6" aria-hidden="true" />
        </span>
        <h2 id="sign-in-heading" className="mt-5 text-3xl font-bold tracking-tight text-ink">
          Sign in to analyse your <span className="text-gradient">running</span>
        </h2>
        <ul className="mt-5 space-y-3">
          {benefits.map(({ icon: Icon, text }) => (
            <li key={text} className="flex gap-3 text-sm leading-relaxed text-body">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-brand-soft text-primary">
                <Icon className="h-4 w-4" aria-hidden="true" />
              </span>
              {text}
            </li>
          ))}
        </ul>
        <button type="button" onClick={onSignIn} className="primary-button mt-7 min-h-12 w-full text-[15px]">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white"><GoogleIcon className="h-4 w-4" /></span>
          Continue with Google
        </button>
        {error && <p role="alert" className="mt-3 text-xs text-danger">{error}</p>}
      </div>
      </div>
    </section>
  );
}
