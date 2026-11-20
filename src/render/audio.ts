/** Original procedural music and SFX; no network, samples or core side effects. */
export class Audio {
  private context?: AudioContext;
  private master?: GainNode;
  private volume = 0.45;
  private active = false;
  private night = 1;
  private beat = 0;
  private timer?: ReturnType<typeof setInterval>;
  private sounds: Record<string, number> = {};

  get diagnostics() { return { state: this.context?.state ?? 'locked', volume: this.volume, sounds: { ...this.sounds } }; }

  async unlock(): Promise<void> {
    try {
      if (!this.context) {
        this.context = new AudioContext(); this.master = this.context.createGain();
        this.master.gain.value = this.volume; this.master.connect(this.context.destination);
        this.timer = setInterval(() => this.music(), 700);
      }
      await this.context.resume();
    } catch { /* The game still runs when audio is unavailable. */ }
  }
  setVolume(value: number): void { this.volume = value; if (this.master) this.master.gain.value = value; }
  setActive(active: boolean, night: number): void { this.active = active; this.night = night; }
  private tone(hz: number, duration = 0.12, gain = 0.12, delay = 0, type: OscillatorType = 'sine'): void {
    const ctx = this.context;
    if (!ctx || !this.master || ctx.state !== 'running') return;
    const osc = ctx.createOscillator(), envelope = ctx.createGain();
    const at = ctx.currentTime + delay;
    osc.type = type; osc.frequency.setValueAtTime(hz, at);
    envelope.gain.setValueAtTime(0, at); envelope.gain.linearRampToValueAtTime(gain, at + 0.015);
    envelope.gain.exponentialRampToValueAtTime(0.0001, at + duration);
    osc.connect(envelope); envelope.connect(this.master); osc.start(at); osc.stop(at + duration + 0.02);
    osc.onended = () => { osc.disconnect(); envelope.disconnect(); };
  }
  private music(): void {
    if (!this.active) return;
    const notes = [220, 261.63, 329.63, 293.66, 196, 261.63, 293.66, 164.81];
    this.tone(notes[this.beat++ % notes.length] * (1 + (this.night - 1) * 0.06), 0.65, 0.035);
    this.tone(110, 0.65, 0.015);
  }
  sfx(name: string): void {
    if (this.context?.state === 'running') this.sounds[name] = (this.sounds[name] ?? 0) + 1;
    const melodies: Record<string, number[]> = {
      mote_picked: [880, 1320], charm_picked: [660, 880, 1320], lantern_lit: [440, 660, 880, 1320],
      pulse: [220, 440, 880], player_hit: [180, 100], jump: [330, 550], dash: [180, 720],
      won: [523, 659, 784, 1046], lost: [330, 261, 196], shade_spawned: [110, 146],
      countdown: [880], wind: [146, 196, 246], drifter_steal: [440, 220], drifter_drop: [660, 880],
    };
    (melodies[name] ?? []).forEach((hz, i) => this.tone(hz, name === 'wind' ? 0.55 : 0.18, 0.1, i * 0.08, name === 'dash' ? 'triangle' : 'sine'));
  }
  dispose(): void { if (this.timer) clearInterval(this.timer); void this.context?.close(); }
}
