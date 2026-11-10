import * as THREE from "three";

export const MODEL_FLIP = false;

const TARGET_LENGTH = 5.4;

function tuneMaterial(material, recolor) {
  const m = material.clone();

  if ("roughness" in m) {
    m.roughness = Math.min(m.roughness ?? 0.5, 0.38);
  }

  if ("metalness" in m) {
    m.metalness = Math.max(m.metalness ?? 0, 0.28);
  }

  if ("envMapIntensity" in m) {
    m.envMapIntensity = 1.45;
  }

  if (
    m.isMeshStandardMaterial ||
    m.isMeshPhysicalMaterial
  ) {
    m.envMapIntensity = 1.45;
    m.needsUpdate = true;
  }

  recolor?.(m);

  return m;
}

export function prepareCarModel(scene, recolor) {
  const car = scene.clone(true);

  car.position.set(0, 0, 0);

  const originalBounds = new THREE.Box3().setFromObject(car);

  const size = originalBounds.getSize(new THREE.Vector3());

  const longestPlanarAxis = Math.max(size.x, size.z) || 1;

  car.scale.setScalar(TARGET_LENGTH / longestPlanarAxis);

  car.rotation.y =
    (size.x > size.z ? -Math.PI / 2 : 0) +
    (MODEL_FLIP ? Math.PI : 0);

  car.updateMatrixWorld(true);

  const bounds = new THREE.Box3().setFromObject(car);

  const center = bounds.getCenter(new THREE.Vector3());

  car.position.set(
    -center.x,
    -bounds.min.y - 0.42,
    -center.z
  );

  car.traverse((object) => {
    if (!object.isMesh) return;

    object.castShadow = true;
    object.receiveShadow = true;

    // Clone materials to avoid modifying shared GLTF materials.

    const source = Array.isArray(object.material)
      ? object.material
      : [object.material];

    const materials = source.map((material) =>
      tuneMaterial(material, recolor)
    );

    object.material = Array.isArray(object.material)
      ? materials
      : materials[0];

    object.frustumCulled = true;
  });

  car.updateMatrixWorld(true);

  return car;
}