/** Yangi buyurtma kelganda qisqa "ding" ovoz (WebAudio, faylsiz) */
export function playOrderSound() {
  try {
    const Ctx =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();

    const tone = (freq: number, delay: number, dur: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = freq;
      osc.type = "sine";
      const t0 = ctx.currentTime + delay;
      gain.gain.setValueAtTime(0.0001, t0);
      gain.gain.exponentialRampToValueAtTime(0.18, t0 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t0);
      osc.stop(t0 + dur);
    };

    tone(880, 0, 0.15); // A5
    tone(1174.66, 0.18, 0.22); // D6
    setTimeout(() => void ctx.close(), 1200);
  } catch {
    // ovoz qo'llab-quvvatlanmasa — jimgina o'tib ketamiz
  }
}
