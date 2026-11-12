import * as THREE from "three";

export const MODEL_FLIP = false;

const TARGET_LENGTH = 5.4;

// Improve texture sampling without changing the source GLTF texture data.
function tuneTexture(texture, renderer, property) {
  if (!texture?.isTexture) return;

  const maxAnisotropy = renderer?.capabilities?.getMaxAnisotropy?.() ?? 1;
  // 8 is a good mobile-quality/performance balance; desktop can use more.
  const isMobile = typeof window !== "undefined" &&
    window.matchMedia?.("(pointer: coarse)").matches;
  texture.anisotropy = Math.min(maxAnisotropy, isMobile ? 8 : 16);

  // GLTF base-colour and emissive maps are colour textures.
  if (property === "map" || property === "emissiveMap") {
    texture.colorSpace = THREE.SRGBColorSpace;
  }

  // Preserve the GLTF loader's mipmap/filter configuration (important for
  // compressed textures); anisotropy improves angled surface detail.
  texture.needsUpdate = true;
}

function tuneMaterial(sourceMaterial, recolor, renderer) {
  if (!sourceMaterial) return sourceMaterial;

  const material = sourceMaterial.clone();
  const textureSlots = [
    "map",
    "normalMap",
    "roughnessMap",
    "metalnessMap",
    "emissiveMap",
    "aoMap",
    "bumpMap",
    "alphaMap",
    "clearcoatMap",
    "clearcoatNormalMap",
    "clearcoatRoughnessMap",
  ];

  for (const slot of textureSlots) {
    tuneTexture(material[slot], renderer, slot);
  }

  // Avoid forcing every part (especially tyres and carbon pieces) to be metallic.
  if (material.isMeshStandardMaterial || material.isMeshPhysicalMaterial) {
    material.envMapIntensity = Math.max(material.envMapIntensity ?? 1, 1.15);
    material.roughness = THREE.MathUtils.clamp(material.roughness ?? 0.5, 0.16, 0.9);
    material.needsUpdate = true;
  }

  recolor?.(material);
  return material;
}

export function prepareCarModel(scene, recolor, renderer) {
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

  car.position.set(-center.x, -bounds.min.y - 0.42, -center.z);

  car.traverse((object) => {
    if (!object.isMesh) return;

    object.castShadow = true;
    object.receiveShadow = true;

    const sourceMaterials = Array.isArray(object.material)
      ? object.material
      : [object.material];
    const tunedMaterials = sourceMaterials.map((material) =>
      tuneMaterial(material, recolor, renderer)
    );

    object.material = Array.isArray(object.material)
      ? tunedMaterials
      : tunedMaterials[0];

    object.frustumCulled = true;
  });

  car.updateMatrixWorld(true);
  return car;
}
