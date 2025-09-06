import { createClient } from "@fal-ai/client";

const fal = createClient({
  apiKey: import.meta.env.VITE_FAL_KEY, // make sure this is in your .env
});

// This version calls a NeRF / 3D model
export async function generateRoom3D(imageUrl: string) {
  const result = await fal.run("fal-ai/3d-reconstruction", {
    input: {
      image_url: imageUrl,
    },
  });

  // result.output should include depth map + mesh/GLB URL
  return result.output;
}