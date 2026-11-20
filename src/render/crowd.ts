import * as THREE from 'three';
import { WORLD } from '../core/config';
import type { GameSim } from '../core/sim';

/** Identical sphere/eye/halo assets in GPU batches for large crowds. */
export class Crowd {
  readonly group=new THREE.Group();
  private body:THREE.InstancedMesh;private eyes:THREE.InstancedMesh;private outlines:THREE.InstancedMesh;
  private motes:THREE.InstancedMesh;private halos:THREE.InstancedMesh;
  private pose=new THREE.Object3D();private color=new THREE.Color();
  constructor(readonly capacity:number,texture:THREE.Texture){
    const create=(geometry:THREE.BufferGeometry,material:THREE.Material,count=capacity)=>{const m=new THREE.InstancedMesh(geometry,material,count);m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);m.frustumCulled=false;this.group.add(m);return m;};
    const glow=(color:number,opacity:number)=>new THREE.MeshBasicMaterial({color,map:texture,transparent:true,opacity,depthWrite:false,blending:THREE.AdditiveBlending,side:THREE.DoubleSide});
    this.body=create(new THREE.SphereGeometry(0.9,12,8),new THREE.MeshStandardMaterial({color:0xffffff,roughness:0.9}));
    this.eyes=create(new THREE.SphereGeometry(0.11,6,5),new THREE.MeshBasicMaterial({color:0x7a3cff}),capacity*2);
    this.outlines=create(new THREE.PlaneGeometry(1,1),glow(0x7a3cff,0.3));
    this.motes=create(new THREE.SphereGeometry(0.16,6,5),new THREE.MeshBasicMaterial({color:0xfff6c2}));
    this.halos=create(new THREE.PlaneGeometry(1,1),glow(0xffe58a,0.5));
  }
  sync(sim:GameSim,camera:THREE.Camera,accessible:boolean,reduced:boolean):void{
    const edge=accessible?0x00b3ff:0x7a3cff;
    (this.eyes.material as THREE.MeshBasicMaterial).color.setHex(edge);(this.outlines.material as THREE.MeshBasicMaterial).color.setHex(edge);
    this.body.count=this.outlines.count=sim.shades.length;this.eyes.count=sim.shades.length*2;
    sim.shades.forEach((s,i)=>{
      const scale=s.state==='spawning'?0.6:1;
      this.pose.position.set(s.pos.x,s.pos.y,s.pos.z);this.pose.quaternion.identity();this.pose.scale.setScalar(scale);this.pose.updateMatrix();this.body.setMatrixAt(i,this.pose.matrix);
      this.body.setColorAt(i,this.color.setHex(s.state==='stunned'?0x3a3450:0x120a1a));
      for(let side=0;side<2;side++){this.pose.position.set(s.pos.x+(side?0.24:-0.24)*scale,s.pos.y+0.1*scale,s.pos.z-0.84*scale);this.pose.updateMatrix();this.eyes.setMatrixAt(i*2+side,this.pose.matrix);}
      this.pose.position.set(s.pos.x,s.pos.y,s.pos.z);this.pose.quaternion.copy(camera.quaternion);this.pose.scale.setScalar(2.6*scale);this.pose.updateMatrix();this.outlines.setMatrixAt(i,this.pose.matrix);
    });
    let n=0;
    for(const m of sim.motes){if(!m.active)continue;
      this.pose.position.set(m.pos.x,m.pos.y+WORLD.moteHoverHeight+(reduced?0:Math.sin(sim.simSteps/18+m.pos.x)*0.12),m.pos.z);
      this.pose.quaternion.identity();this.pose.scale.setScalar(1);this.pose.updateMatrix();this.motes.setMatrixAt(n,this.pose.matrix);
      this.pose.quaternion.copy(camera.quaternion);this.pose.scale.setScalar(1.5);this.pose.updateMatrix();this.halos.setMatrixAt(n++,this.pose.matrix);
    }
    this.motes.count=this.halos.count=n;
    for(const m of [this.body,this.eyes,this.outlines,this.motes,this.halos])m.instanceMatrix.needsUpdate=true;
    if(this.body.instanceColor)this.body.instanceColor.needsUpdate=true;
  }
}
