/**
 * Web Audio API synthesizer utilities for stage and debate sound effects.
 */

export function playPenaltyBuzzerSound() {
  if (typeof window === 'undefined') return;
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;

    const ctx = new AudioContextClass();
    const now = ctx.currentTime;

    // Crisp, high-pitched 2-tone wrong answer alarm ("BEEP-BEEP!")
    const playHighPitchBlast = (startTime: number, freq1: number, freq2: number, duration: number) => {
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gain = ctx.createGain();
      const filter = ctx.createBiquadFilter();

      // Sharp high pitch synth tones for an unmistakable violation alert
      osc1.type = 'square';
      osc2.type = 'sawtooth';

      osc1.frequency.setValueAtTime(freq1, startTime);
      osc1.frequency.exponentialRampToValueAtTime(freq1 * 0.85, startTime + duration);

      osc2.frequency.setValueAtTime(freq2, startTime);
      osc2.frequency.exponentialRampToValueAtTime(freq2 * 0.85, startTime + duration);

      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(1200, startTime);
      filter.Q.setValueAtTime(1.5, startTime);

      // Clean, bright volume envelope
      gain.gain.setValueAtTime(0.001, startTime);
      gain.gain.linearRampToValueAtTime(0.20, startTime + 0.012);
      gain.gain.setValueAtTime(0.18, startTime + duration - 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

      osc1.connect(filter);
      osc2.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);

      osc1.start(startTime);
      osc2.start(startTime);
      osc1.stop(startTime + duration);
      osc2.stop(startTime + duration);
    };

    // First high-pitch blast (880 Hz / 622 Hz)
    playHighPitchBlast(now, 880, 622, 0.16);
    // Second high-pitch blast (784 Hz / 554 Hz)
    playHighPitchBlast(now + 0.20, 784, 554, 0.28);

  } catch (err) {
    console.error('Failed to play penalty buzzer sound:', err);
  }
}
