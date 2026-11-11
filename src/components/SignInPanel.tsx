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
    <section className="mx-auto my-12 max-w-md sm:my-20" aria-labelledby="sign-in-heading">
      <div className="panel p-6 sm:p-8">
        <p className="eyebrow">Stride Lab</p>
        <h2 id="sign-in-heading" className="mt-2 text-2xl font-semibold tracking-tight text-ink">Sign in to analyse your running</h2>
        <ul className="mt-5 space-y-3">
          {benefits.map(({ icon: Icon, text }) => (
            <li key={text} className="flex gap-3 text-sm leading-relaxed text-body">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/[0.08] text-primary">
                <Icon className="h-4 w-4" aria-hidden="true" />
              </span>
              {text}
            </li>
          ))}
        </ul>
        <button type="button" onClick={onSignIn} className="control-button mt-7 min-h-11 w-full text-sm">
          <GoogleIcon className="h-5 w-5" /> Continue with Google
        </button>
        {error && <p role="alert" className="mt-3 text-xs text-danger">{error}</p>}
      </div>
    </section>
  );
}
