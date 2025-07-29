// components/Lights.jsx
const Lights = () => {
  return (
    <>
      <ambientLight intensity={0.3} />
      <directionalLight
        castShadow
        position={[10, 20, 10]}
        intensity={1.5}
        shadow-mapSize={[2048, 2048]}
      />
    </>
  );
};

export default Lights;
