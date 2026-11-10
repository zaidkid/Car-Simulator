import * as THREE from "three";

export const MODEL_FLIP = false; // set true if the car drives backwards
const LENGTH = 5.4;

// Fits the GLB to the physics body (nose along +Z, wheels on the ground, centred)
// and lets the caller recolour each material clone.
export function prepareCarModel(scene, recolor) {
  const car = scene.clone(true);
  car.position.set(0, 0, 0);

  const size = new THREE.Box3().setFromObject(car).getSize(new THREE.Vector3());
  console.log("car model size", size); // paste this if the direction is still wrong

  car.scale.setScalar(LENGTH / Math.max(size.x, size.z));
  car.rotation.y = (size.x > size.z ? -Math.PI / 2 : 0) + (MODEL_FLIP ? Math.PI : 0);
  car.updateMatrixWorld(true);

  const box = new THREE.Box3().setFromObject(car);
  const c = box.getCenter(new THREE.Vector3());
  car.position.set(-c.x, -box.min.y - 0.42, -c.z);

  car.traverse((mesh) => {
    if (!mesh.isMesh) return;
    mesh.castShadow = mesh.receiveShadow = true;

    const mats = [].concat(mesh.material).map((original) => {
      const m = original.clone();
      m.envMapIntensity = 1.3;
      recolor?.(m);
      return m;
    });

    mesh.material = Array.isArray(mesh.material) ? mats : mats[0];
  });

  return car;
}