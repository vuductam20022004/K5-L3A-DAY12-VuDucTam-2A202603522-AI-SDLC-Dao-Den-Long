import { GameSim } from './sim';

/** Campaign rules shared by the GUI and headless unit tests. */
export class Campaign {
  night = 1;
  readonly scores = new Map<number, number>();
  constructor(readonly seed: number) {}

  startNight(): GameSim {
    return new GameSim({ seed: this.seed + this.night - 1, night: this.night });
  }

  record(sim: GameSim): void {
    if (sim.night === this.night && sim.state === 'won') this.scores.set(this.night, sim.score);
  }

  nextNight(): boolean {
    if (!this.scores.has(this.night) || this.night === 3) return false;
    this.night += 1;
    return true;
  }

  get complete(): boolean { return this.scores.has(3); }
  get totalScore(): number { return [...this.scores.values()].reduce((a, b) => a + b, 0); }
}
