// Generate a pleasant notification sound using Web Audio API
let audioContext: AudioContext | null = null;

export type VolumeLevel = 'low' | 'medium' | 'high';

const VOLUME_MAP: Record<VolumeLevel, number> = {
  low: 0.05,
  medium: 0.15,
  high: 0.35,
};

function getAudioContext(): AudioContext {
  if (!audioContext) {
    audioContext = new AudioContext();
  }
  return audioContext;
}

export function playNotificationSound(volume: VolumeLevel = 'medium') {
  try {
    const ctx = getAudioContext();
    if (ctx.state === 'suspended') {
      ctx.resume();
    }

    const now = ctx.currentTime;
    const gain = VOLUME_MAP[volume];

    // Create two short tones for a pleasant "ding-dong" effect
    const frequencies = [880, 1108.73]; // A5 and C#6 — a pleasant major third

    frequencies.forEach((freq, i) => {
      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();

      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(freq, now);

      const startTime = now + i * 0.12;
      gainNode.gain.setValueAtTime(0, startTime);
      gainNode.gain.linearRampToValueAtTime(gain, startTime + 0.02);
      gainNode.gain.exponentialRampToValueAtTime(0.001, startTime + 0.4);

      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);

      oscillator.start(startTime);
      oscillator.stop(startTime + 0.5);
    });
  } catch {
    // Silent fail if audio is not supported
  }
}
