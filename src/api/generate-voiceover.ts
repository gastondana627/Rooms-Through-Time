import type { VercelRequest, VercelResponse } from '@vercel/node';
import { ElevenLabs } from '@elevenlabs/elevenlabs-js';

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).end('Method Not Allowed');
  }

  try {
    const elevenlabs = new ElevenLabs({ apiKey: process.env.ELEVENLABS_API_KEY });
    const { style } = req.body;

    if (!style) {
      return res.status(400).json({ error: 'Style is required' });
    }

    const textToSpeak = `This is a beautiful room designed in the ${style.toLowerCase()} style. It features a clean and inviting aesthetic, perfect for relaxation.`;

    const audioStream = await elevenlabs.generate({
      voice: "Rachel",
      text: textToSpeak,
      model_id: "eleven_multilingual_v2",
      stream: true,
    });

    res.setHeader('Content-Type', 'audio/mpeg');
    const chunks: Buffer[] = [];
    for await (const chunk of audioStream) {
      chunks.push(chunk);
    }
    const content = Buffer.concat(chunks);
    res.send(content);
  } catch (error: any) {
    console.error("ElevenLabs API Error:", error.message);
    res.status(500).json({ error: 'Failed to generate voiceover' });
  }
}