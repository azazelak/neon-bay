// Neon Bay v5c — combat: punch, pistol, reload, cop return fire hooks.
export class Combat {
  constructor(game) {
    this.game = game;
    this.lastShotAt = 0;
    this.punchAt = 0;
  }

  shoot() {
    const p = this.game.player;
    const now = this.game.time;
    if (now - this.lastShotAt < 0.25) return;
    if (p.weapon === 'pistol') {
      if (p.ammo <= 0) { this.game.audio?.blip(180, 0.06); return; }
      p.ammo -= 1;
    }
    this.lastShotAt = now;
    this.game.audio?.shot();
    const from = p.inCar && p.car ? p.car.pos : p.pos;
    const yaw = p.yaw;
    const dx = Math.sin(yaw), dz = Math.cos(yaw);
    // hit the nearest cop or ped roughly in the line of fire
    const targets = [...this.game.police.cruisers, ...this.game.traffic.cars];
    let best = null, bestD = 60;
    for (const t of targets) {
      const rx = t.pos.x - from.x, rz = t.pos.z - from.z;
      const along = rx * dx + rz * dz;
      if (along < 2 || along > 60) continue;
      const side = Math.abs(rx * dz - rz * dx);
      if (side < 3 && along < bestD) { bestD = along; best = t; }
    }
    if (best) {
      this.game.effects?.spark(best.pos.x, best.pos.z);
      if (best.police) {
        best.hp -= p.weapon === 'pistol' ? 34 : 12;
        if (best.hp <= 0) {
          best.disabled = true;
          this.game.police.addHeat(6);
        }
      } else {
        best.hp -= 20;
        if (best.hp <= 0) best.disabled = true;
      }
    }
    this.game.effects?.muzzle(from);
  }

  punch() {
    const p = this.game.player;
    const now = this.game.time;
    if (now - this.punchAt < 0.45 || p.inCar) return;
    this.punchAt = now;
    this.game.audio?.blip(120, 0.08);
    const dx = Math.sin(p.yaw), dz = Math.cos(p.yaw);
    for (const ped of this.game.traffic.peds) {
      const rx = ped.x - p.pos.x, rz = ped.z - p.pos.z;
      if (rx * dx + rz * dz > 0 && Math.hypot(rx, rz) < 2.2) {
        ped.x += dx * 3; ped.z += dz * 3;
        ped.mesh.position.set(ped.x, 0, ped.z);
        this.game.police.addHeat(4);
        break;
      }
    }
  }

  reload() {
    const p = this.game.player;
    if (p.weapon !== 'pistol' || p.reserve <= 0 || p.ammo >= 12) return;
    const need = 12 - p.ammo;
    const take = Math.min(need, p.reserve);
    p.ammo += take;
    p.reserve -= take;
    this.game.audio?.blip(520, 0.05);
  }
}
