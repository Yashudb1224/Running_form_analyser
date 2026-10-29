# Running Form Analyser

A client-side Next.js 14 demonstration that samples a selected video in the browser, estimates 33 pose landmarks with MediaPipe Pose, and presents 2D landmark-derived motion metrics.

## Run locally

```sh
npm install
npm run dev
```

For validation:

```sh
npm run lint
npm test
npm run build
```

## Analysis flow and limits

The browser samples the first 60 seconds at 10 samples per second (up to 600 frames). MediaPipe Pose and its model assets are loaded from jsDelivr. The app does not upload the selected video or send frames to an analysis API.

Missing detections remain missing. Each frame retains nullable landmarks and tracking visibility; angles and downstream metrics with insufficient inputs are marked unavailable. The dashboard shows coverage and metric provenance. Gait cadence is estimated from ankle-trajectory events. Ground-contact and flight duration are not calculated. Pixel-space distances are not converted to centimetres; normalized image-space values remain uncalibrated.

Form and consistency scores are experimental, rule-based demonstration indices, not validated sports-science assessments. The posture panel compares the observed image-plane angle with the existing score band only; it is not an ideal-posture prescription. Camera orientation, perspective, and physical scale are not calibrated. The analysis is not a medical or injury-risk tool.

The report includes a Metric guide describing the displayed calculations, units, and limitations. The PDF export contains session quality, metric comparisons, score components, and sampled kinematic traces. Ground-contact and flight times are not shown because they are not measured by this method.
