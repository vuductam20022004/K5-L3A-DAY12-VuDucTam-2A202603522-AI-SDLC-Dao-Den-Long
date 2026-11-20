/** Read-only Three.js projection of the canonical map and simulation. */
import * as THREE from 'three';
import { RULES, TUNING, WORLD } from '../core/config';
import type { NightMap, Surface } from '../core/maps';
import type { GameSim } from '../core/sim';

export const PALETTE = {
  sky: 0x0e1430, fog: 0x1b2350, grass: 0x2f5d50, sand: 0xc9b48a,
  wood: 0x6b4a2f, sea: 0x12384a, lit: 0xffb347, core: 0xffe9b0,
  unlit: 0x5b5f6e, mote: 0xfff6c2, halo: 0xffe58a, shade: 0x120a1a,
  outline: 0x7a3cff, stunned: 0x3a3450, shirt: 0xe8e2d0, red: 0xc8102e,
  gold: 0xf2c14e, drifter: 0x8fa3b8,
  accessibleShade: 0x00b3ff, danger: 0xff5a5f,
};

function mesh(geometry: THREE.BufferGeometry, color: number, unlit = false): THREE.Mesh {
  return new THREE.Mesh(geometry, unlit
    ? new THREE.MeshBasicMaterial({ color })
    : new THREE.MeshStandardMaterial({ color, roughness: 0.9 }));
}
function disposeTree(root: THREE.Object3D): void {
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    m.geometry?.dispose();
    const mats = Array.isArray(m.material) ? m.material : [m.material];
    for (const mat of mats) mat?.dispose();
  });
  root.removeFromParent();
}

export class Renderer {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.1, 500);
  readonly ambient = new THREE.AmbientLight(0xffffff, 0.15);
  private terrain = new THREE.Group();
  private dynamic = new THREE.Group();
  private activeMap?: NightMap;
  private objects = new Map<string, THREE.Object3D>();
  private player = new THREE.Group();
  private playerLight = new THREE.PointLight(PALETTE.lit, 3, 16, 2);
  private ring = mesh(new THREE.RingGeometry(0.9, 1, 48), PALETTE.lit, true);
  private haloTexture: THREE.CanvasTexture;
  private leaves = new THREE.Group();
  private projector = new THREE.Vector3();
  private accessiblePalette = false;

  setAccessiblePalette(enabled: boolean): void { this.accessiblePalette = enabled; }

  constructor(container: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
    this.renderer.setSize(innerWidth, innerHeight);
    container.appendChild(this.renderer.domElement);
    this.scene.background = new THREE.Color(PALETTE.sky);
    this.scene.fog = new THREE.FogExp2(PALETTE.fog, 0.006);
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 64;
    const ctx = canvas.getContext('2d')!;
    const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, '#fff'); g.addColorStop(0.2, '#ffffffe0'); g.addColorStop(1, '#ffffff00');
    ctx.fillStyle = g; ctx.fillRect(0, 0, 64, 64);
    this.haloTexture = new THREE.CanvasTexture(canvas);
    this.scene.add(this.terrain, this.dynamic, this.player, this.ambient, this.leaves);
    const hemi = new THREE.HemisphereLight(0xc1d6ff, PALETTE.sea, 0.9); this.scene.add(hemi);
    const moon = new THREE.DirectionalLight(0xcad8ff, 1.3); moon.position.set(-20, 40, 15); this.scene.add(moon);
    const sea = mesh(new THREE.PlaneGeometry(800, 800), PALETTE.sea);
    sea.rotation.x = -Math.PI / 2; sea.position.y = -12; this.scene.add(sea);
    const body = mesh(new THREE.CapsuleGeometry(0.4, 0.8, 5, 10), PALETTE.shirt); body.position.y = 1; this.player.add(body);
    const scarf = mesh(new THREE.TorusGeometry(0.38, 0.12, 5, 12), PALETTE.red); scarf.position.y = 1.5; scarf.rotation.x = Math.PI / 2; this.player.add(scarf);
    const hat = mesh(new THREE.ConeGeometry(0.85, 0.5, 14), PALETTE.grass); hat.position.y = 1.95; this.player.add(hat);
    const lamp = mesh(new THREE.SphereGeometry(0.23, 8, 6), PALETTE.core, true); lamp.position.set(0.55, 1, 0.2); this.player.add(lamp);
    this.playerLight.position.copy(lamp.position); this.player.add(this.playerLight);
    this.ring.rotation.x = -Math.PI / 2;
    (this.ring.material as THREE.Material).dispose();
    this.ring.material = new THREE.MeshBasicMaterial({ color: PALETTE.lit, side: THREE.DoubleSide, transparent: true, opacity: 0, depthWrite: false });
    this.scene.add(this.ring);
    for (let i = 0; i < 24; i++) {
      const leaf = mesh(new THREE.PlaneGeometry(0.25, 0.5), PALETTE.grass, true);
      (leaf.material as THREE.MeshBasicMaterial).side = THREE.DoubleSide;
      this.leaves.add(leaf);
    }
    addEventListener('resize', () => {
      this.camera.aspect = innerWidth / innerHeight; this.camera.updateProjectionMatrix();
      this.renderer.setSize(innerWidth, innerHeight);
    });
  }
  private halo(color: number, size: number, opacity: number): THREE.Sprite {
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ color, map: this.haloTexture, transparent: true, opacity,
      blending: THREE.AdditiveBlending, depthWrite: false }));
    sprite.scale.set(size, size, 1); return sprite;
  }
  private buildSurface(surface: Surface): void {
    const s = surface.shape;
    if (s.kind === 'disk') {
      const edge = mesh(new THREE.CylinderGeometry(s.radius, s.radius * 0.97, 1.1, 64), PALETTE.sand);
      edge.position.set(s.cx, s.y - 0.56, s.cz); this.terrain.add(edge);
      const top = mesh(new THREE.CircleGeometry(s.radius, 64), PALETTE.grass);
      top.rotation.x = -Math.PI / 2; top.position.set(s.cx, s.y, s.cz); this.terrain.add(top);
    } else if (s.kind === 'rect') {
      const bridge = mesh(new THREE.BoxGeometry(s.x1 - s.x0, 0.3, s.z1 - s.z0), PALETTE.wood);
      bridge.position.set((s.x0 + s.x1) / 2, s.y - 0.15, (s.z0 + s.z1) / 2); this.terrain.add(bridge);
      for (let x = s.x0; x <= s.x1; x += 0.7) {
        const slat = mesh(new THREE.BoxGeometry(0.08, 0.02, s.z1 - s.z0), PALETTE.sand);
        slat.position.set(x, s.y + 0.01, 0); this.terrain.add(slat);
      }
    } else if (s.kind === 'annulus') {
      const shape = new THREE.Shape();
      shape.absarc(0, 0, s.outer, 0, Math.PI, false);
      shape.lineTo(-s.inner, 0);
      shape.absarc(0, 0, s.inner, Math.PI, 0, true); shape.closePath();
      const geometry = new THREE.ExtrudeGeometry(shape, { depth: 3, bevelEnabled: false, curveSegments: 48 });
      geometry.rotateX(Math.PI / 2);
      const tier = mesh(geometry, PALETTE.grass); tier.position.y = s.y; this.terrain.add(tier);
    } else {
      const positions: number[] = [];
      const angle = s.deg * Math.PI / 180;
      const rows = 12;
      for (let i = 0; i < rows; i++) {
        const point = (t: number, side: number) => {
          const r = s.bottom + (s.top - s.bottom) * t;
          const a = angle + side * (s.width / 2) / r;
          return [r * Math.cos(a), s.y * t + 0.015, r * Math.sin(a)];
        };
        const a = point(i / rows, -1), b = point(i / rows, 1), c = point((i + 1) / rows, -1), d = point((i + 1) / rows, 1);
        positions.push(...a, ...c, ...b, ...b, ...c, ...d);
      }
      const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3)); geo.computeVertexNormals();
      const ramp = mesh(geo, PALETTE.sand); (ramp.material as THREE.MeshStandardMaterial).side = THREE.DoubleSide; this.terrain.add(ramp);
      const marker = mesh(new THREE.CylinderGeometry(0.15, 0.15, 1, 6), PALETTE.gold);
      marker.position.set(s.bottom * Math.cos(angle), 0.5, s.bottom * Math.sin(angle)); this.terrain.add(marker);
    }
  }
  private buildMap(map: NightMap): void {
    for (const child of [...this.terrain.children]) disposeTree(child);
    this.clearDynamic(); this.activeMap = map;
    map.surfaces.forEach((s) => this.buildSurface(s));
    for (const b of map.blockers) {
      const tower = mesh(new THREE.CylinderGeometry(b.radius, b.radius, b.height, 20), PALETTE.wood);
      tower.position.set(b.x, b.y + b.height / 2, b.z); this.terrain.add(tower);
      const bell = mesh(new THREE.SphereGeometry(1.5, 12, 8), PALETTE.gold);
      bell.position.set(b.x, b.y + b.height, b.z); this.terrain.add(bell);
    }
    for (const s of map.springs) {
      const pad = mesh(new THREE.CylinderGeometry(s.radius, s.radius, 0.16, 24), PALETTE.gold);
      pad.position.set(s.pos.x, s.pos.y + 0.08, s.pos.z); this.terrain.add(pad);
      const arrow = new THREE.ArrowHelper(new THREE.Vector3(s.dir[0], 0.4, s.dir[1]).normalize(),
        new THREE.Vector3(s.pos.x, s.pos.y + 0.25, s.pos.z), 2, PALETTE.core, 0.6, 0.5);
      this.terrain.add(arrow);
    }
  }
  private object(id: string, create: () => THREE.Object3D, seen: Set<string>): THREE.Object3D {
    seen.add(id);
    let o = this.objects.get(id);
    if (!o) { o = create(); this.dynamic.add(o); this.objects.set(id, o); }
    return o;
  }
  sync(sim: GameSim): void {
    if (this.activeMap !== sim.map) this.buildMap(sim.map);
    const seen = new Set<string>();
    let litCount = 0;
    sim.lanterns.forEach((l) => {
      const group = this.object(`lamp:${l.id}`, () => {
        const g = new THREE.Group();
        const pole = mesh(new THREE.CylinderGeometry(0.15, 0.2, 3.4, 8), PALETTE.wood); pole.position.y = 1.7; g.add(pole);
        const lamp = mesh(new THREE.SphereGeometry(0.65, 12, 8), PALETTE.unlit, true); lamp.position.y = 3.7; g.add(lamp);
        lamp.name = 'paper';
        const roof = mesh(new THREE.ConeGeometry(0.95, 0.5, 8), PALETTE.wood); roof.position.y = 4.4; g.add(roof);
        const glow = this.halo(PALETTE.core, 8, 0); glow.position.y = 3.7; g.add(glow);
        const safe = mesh(new THREE.RingGeometry(TUNING.safe_radius - 0.06, TUNING.safe_radius, 64), PALETTE.lit, true);
        safe.rotation.x = -Math.PI / 2; safe.position.y = 0.03; g.add(safe);
        const background = new THREE.Sprite(new THREE.SpriteMaterial({ color: PALETTE.sky, depthTest: false }));
        background.name = 'fuelBackground'; background.scale.set(2.4, 0.18, 1);
        background.position.set(0, 5, 0); g.add(background);
        const fill = new THREE.Sprite(new THREE.SpriteMaterial({ color: PALETTE.gold, transparent: true, depthTest: false }));
        fill.name = 'fuelFill'; fill.scale.set(2.4, 0.12, 1); fill.center.set(0, 0.5);
        fill.position.copy(background.position); g.add(fill);
        const tear = new THREE.Group(); tear.name = 'tear'; tear.position.y = 3.7;
        for (let side = 0; side < 4; side++) {
          const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(-0.22, 0.25, -0.61), new THREE.Vector3(0.07, 0.05, -0.65),
            new THREE.Vector3(-0.07, -0.08, -0.65), new THREE.Vector3(0.2, -0.25, -0.61),
          ]), new THREE.LineBasicMaterial({ color: PALETTE.sky }));
          line.rotation.y = side * Math.PI / 2; tear.add(line);
        }
        g.add(tear);
        return g;
      }, seen);
      group.position.set(l.pos.x, l.pos.y, l.pos.z);
      const low = l.lit && l.fuelTicks < TUNING.low_fuel_threshold * 60;
      const blink = !low || Math.floor(sim.simSteps / 60 * RULES.fuel_blink_hz * 2) % 2 === 0;
      const paper = group.children[1] as THREE.Mesh;
      (paper.material as THREE.MeshBasicMaterial).color.setHex(l.lit && blink ? PALETTE.lit : PALETTE.unlit);
      paper.scale.y = l.lit ? 1 : 0.8;
      group.children[2].position.y = l.lit ? 4.4 : 4.27;
      ((group.children[3] as THREE.Sprite).material as THREE.SpriteMaterial).opacity = l.lit ? blink ? 0.75 : 0.1 : 0;
      group.children[4].visible = l.lit && !low;
      group.getObjectByName('fuelBackground')!.visible = l.lit;
      const fill = group.getObjectByName('fuelFill') as THREE.Sprite;
      fill.visible = l.lit;
      // Keep both sprites centered above the lamp at every camera yaw.
      const right = this.camera.matrixWorld.elements;
      fill.position.set(-1.2 * right[0], 5 - 1.2 * right[1], -1.2 * right[2]);
      fill.scale.x = 2.4 * l.fuelTicks / (TUNING.fuel_max * 60);
      fill.material.color.setHex(low ? this.accessiblePalette ? 0xffffff : PALETTE.danger : PALETTE.gold);
      fill.material.opacity = blink ? 1 : 0.3;
      const tear = group.getObjectByName('tear')!; tear.visible = !l.lit; tear.scale.y = 0.8;
      if (l.lit) litCount++;
    });
    this.ambient.intensity = 0.15 + 0.55 * litCount / sim.lanterns.length;
    for (const m of sim.motes) {
      if (!m.active) continue;
      const g = this.object(`mote:${m.id}`, () => {
        const group = new THREE.Group(); group.add(mesh(new THREE.SphereGeometry(0.16, 6, 5), PALETTE.mote, true));
        group.add(this.halo(PALETTE.halo, 1.5, 0.5));
        const trail = this.halo(PALETTE.halo, 1, 0.18); trail.position.y = -0.3; group.add(trail); return group;
      }, seen);
      g.position.set(m.pos.x, m.pos.y + WORLD.moteHoverHeight + Math.sin(sim.simSteps / 18 + m.pos.x) * 0.12, m.pos.z);
    }
    for (const s of sim.shades) {
      const g = this.object(`shade:${s.id}`, () => {
        const group = new THREE.Group();
        group.add(mesh(new THREE.SphereGeometry(0.9, 12, 8), PALETTE.shade));
        const outline = this.halo(PALETTE.outline, 2.6, 0.3); outline.name = 'outline'; group.add(outline);
        const eyes = new THREE.Group(); eyes.name = 'eyes';
        for (const x of [-0.24, 0.24]) { const eye = mesh(new THREE.SphereGeometry(0.11, 6, 5), PALETTE.outline, true); eye.position.set(x, 0.1, -0.84); eyes.add(eye); }
        group.add(eyes); return group;
      }, seen);
      g.position.set(s.pos.x, s.pos.y, s.pos.z);
      ((g.children[0] as THREE.Mesh).material as THREE.MeshStandardMaterial).color.setHex(s.state === 'stunned' ? PALETTE.stunned : PALETTE.shade);
      const edge = this.accessiblePalette ? PALETTE.accessibleShade : PALETTE.outline;
      ((g.getObjectByName('outline') as THREE.Sprite).material as THREE.SpriteMaterial).color.setHex(edge);
      g.getObjectByName('eyes')!.children.forEach((eye) => ((eye as THREE.Mesh).material as THREE.MeshBasicMaterial).color.setHex(edge));
      g.scale.setScalar(s.state === 'spawning' ? 0.6 : 1);
    }
    for (const d of sim.drifters) {
      const g = this.object(`drifter:${d.id}`, () => {
        const group = new THREE.Group();
        for (let i = 0; i < 5; i++) {
          const ribbon = mesh(new THREE.SphereGeometry(0.35, 8, 6), PALETTE.drifter);
          ribbon.scale.set(1.5, 0.25, 0.8); ribbon.position.x = -i * 0.4; group.add(ribbon);
        } return group;
      }, seen);
      g.position.set(d.pos.x, d.pos.y, d.pos.z); g.rotation.y = sim.simSteps / 40;
    }
    for (const c of sim.charms) {
      if (!c.available) continue;
      const g = this.object(`charm:${c.id}`, () => {
        const group = new THREE.Group();
        group.add(mesh(new THREE.BoxGeometry(0.7, 1, 0.08), PALETTE.gold));
        group.add(mesh(new THREE.BoxGeometry(0.58, 0.86, 0.1), PALETTE.red));
        group.add(this.halo(PALETTE.gold, 2, 0.35)); return group;
      }, seen);
      g.position.set(c.pos.x, c.pos.y + 1, c.pos.z); g.rotation.y = sim.simSteps / 50;
    }
    for (const [id, o] of this.objects) if (!seen.has(id)) { disposeTree(o); this.objects.delete(id); }
    this.player.position.set(sim.player.pos.x, sim.player.pos.y, sim.player.pos.z);
    this.player.rotation.y = Math.atan2(sim.player.facing[0], sim.player.facing[1]);
    this.player.visible = sim.player.deadUntilTick < 0 && (sim.simSteps > sim.player.invulnUntilTick || sim.simSteps % 8 < 5);
    this.playerLight.intensity = 2 + sim.player.flames;
    this.leaves.visible = sim.wind.active || sim.wind.warnUntilTick > sim.simSteps;
    const t = sim.simSteps / 60;
    this.leaves.children.forEach((o, i) => {
      o.position.set(sim.player.pos.x + ((i * 3 + t * 8) % 22) - 11,
        sim.player.pos.y + 1 + (i % 5), sim.player.pos.z + Math.sin(i * 9 + t) * 8);
      o.rotation.set(t + i, t * 2, i);
    });
  }
  showPulse(x: number, z: number, radius: number, y = 0): void {
    this.ring.position.set(x, y + 0.06, z); this.ring.scale.setScalar(radius);
    (this.ring.material as THREE.MeshBasicMaterial).opacity = 0.9;
  }
  animate(_sim: GameSim, dt: number): void {
    const mat = this.ring.material as THREE.MeshBasicMaterial;
    mat.opacity = Math.max(0, mat.opacity - dt * 1.6);
  }
  updateCamera(pos: { x: number; y: number; z: number }, yaw: number, pitch: number): void {
    this.camera.position.set(pos.x - Math.sin(yaw) * 11 * Math.cos(pitch),
      pos.y + 4.2 + 11 * Math.sin(pitch), pos.z - Math.cos(yaw) * 11 * Math.cos(pitch));
    this.camera.lookAt(pos.x, pos.y + 1.4, pos.z); this.camera.updateMatrixWorld();
  }
  project(pos: { x: number; y: number; z: number }): { x: number; y: number; visible: boolean } {
    this.projector.set(pos.x, pos.y + 2, pos.z).project(this.camera);
    const { x, y, z } = this.projector;
    return { x, y, visible: z >= -1 && z <= 1 && Math.abs(x) <= 0.9 && Math.abs(y) <= 0.85 };
  }
  render(): void { this.renderer.render(this.scene, this.camera); }
  clearDynamic(): void {
    for (const o of this.objects.values()) disposeTree(o);
    this.objects.clear();
    (this.ring.material as THREE.MeshBasicMaterial).opacity = 0;
  }
}
