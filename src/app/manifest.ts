import type { MetadataRoute } from "next";

// Lets Safari's/Chrome's "Add to Home Screen" install the app full-screen
// (display: "standalone") with no browser chrome, instead of opening as a
// normal tab. Icons point at the auto-generated icon.tsx route rather than
// a static file, so both stay in sync with the same source glyph.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Workout Tracker",
    short_name: "Workout Tracker",
    description:
      "AI-generated workouts and simple logging for strength training and runs.",
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#171717",
    icons: [
      {
        src: "/icon",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  };
}
