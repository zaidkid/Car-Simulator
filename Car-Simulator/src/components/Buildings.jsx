import { RigidBody } from "@react-three/rapier";
import { useMemo } from "react";

export default function Buildings() {
  const buildings = useMemo(() => {
    const result = [];
    
    const buildingTypes = [
      { width: 6, height: 12, depth: 15, color: "#8b4513", windows: { rows: 4, cols: 3 }, type: "brownstone" },
      { width: 12, height: 35, depth: 12, color: "#4a5568", windows: { rows: 20, cols: 6 }, type: "modern" },
      { width: 10, height: 20, depth: 12, color: "#8b7d6b", windows: { rows: 8, cols: 4 }, type: "prewar" },
      { width: 8, height: 28, depth: 10, color: "#9c8f7e", windows: { rows: 12, cols: 3 }, type: "artdeco" },
      { width: 14, height: 15, depth: 18, color: "#696969", windows: { rows: 6, cols: 8 }, type: "industrial" },
      { width: 9, height: 42, depth: 9, color: "#708090", windows: { rows: 25, cols: 3 }, type: "luxury" },
      { width: 11, height: 18, depth: 14, color: "#a0948a", windows: { rows: 9, cols: 5 }, type: "commercial" },
      { width: 7, height: 8, depth: 10, color: "#daa520", windows: { rows: 2, cols: 2 }, type: "house" },
      { width: 16, height: 25, depth: 20, color: "#2f4f4f", windows: { rows: 15, cols: 8 }, type: "office" }
    ];

    // ENHANCED ROAD SYSTEM - matching Ground.jsx exactly
    const roads = {
      main: { x: 0, width: 12 }, // Main north-south road
      crossStreets: [-150, -90, -30, 30, 90, 150], // East-west cross streets
      sideRoads: { // Left and right extending roads
        left: { x: -50, width: 88 },  // Left side roads extending west
        right: { x: 50, width: 88 }   // Right side roads extending east
      },
      roundabouts: [
        { x: -80, z: -60, radius: 25 },
        { x: 80, z: 60, radius: 25 },
        { x: -80, z: 120, radius: 25 }
      ]
    };

    // COMPREHENSIVE ROAD DETECTION
    const isOnRoad = (x, z) => {
      // Main street (vertical road at x=0)
      if (Math.abs(x - roads.main.x) <= roads.main.width / 2) return true;
      
      // Cross streets (horizontal roads)
      for (const streetZ of roads.crossStreets) {
        if (Math.abs(z - streetZ) <= 10 / 2) { // 10 unit wide cross streets
          return true;
        }
      }
      
      // Left side roads extending from cross streets
      for (const streetZ of roads.crossStreets) {
        if (Math.abs(z - streetZ) <= 10 / 2) { // Same width as cross streets
          // Left side road extends from main road to x = -94 (left boundary)
          if (x >= -94 && x <= roads.main.x - roads.main.width / 2) {
            return true;
          }
          // Right side road extends from main road to x = 94 (right boundary)
          if (x <= 94 && x >= roads.main.x + roads.main.width / 2) {
            return true;
          }
        }
      }
      
      // Roundabouts
      for (const roundabout of roads.roundabouts) {
        const distance = Math.sqrt((x - roundabout.x) ** 2 + (z - roundabout.z) ** 2);
        if (distance <= roundabout.radius) return true;
        
        // Roundabout connecting roads (35 units in each direction)
        // North connection
        if (Math.abs(x - roundabout.x) <= 5 && z >= roundabout.z + roundabout.radius && z <= roundabout.z + roundabout.radius + 35) return true;
        // South connection  
        if (Math.abs(x - roundabout.x) <= 5 && z <= roundabout.z - roundabout.radius && z >= roundabout.z - roundabout.radius - 35) return true;
        // East connection
        if (Math.abs(z - roundabout.z) <= 5 && x >= roundabout.x + roundabout.radius && x <= roundabout.x + roundabout.radius + 35) return true;
        // West connection
        if (Math.abs(z - roundabout.z) <= 5 && x <= roundabout.x - roundabout.radius && x >= roundabout.x - roundabout.radius - 35) return true;
      }
      
      return false;
    };

    const getWindowLight = (x, z, row, col) => {
      const time = Date.now() * 0.001;
      const seed = Math.sin(x * 0.1 + z * 0.1 + row * 0.3 + col * 0.7 + time * 0.5);
      return seed > 0.1 ? (0.2 + Math.abs(seed) * 0.4) : 0.02;
    };
    
    const getWindowColor = (x, z, row, col) => {
      const colors = ["#ffd700", "#87ceeb", "#ff6b6b", "#4ecdc4", "#ffe66d", "#ff9999", "#99ff99"];
      const seed = Math.sin(x * 0.2 + z * 0.2 + row * 0.5 + col * 0.9);
      const index = Math.floor((seed + 1) * 0.5 * colors.length);
      return colors[Math.min(index, colors.length - 1)];
    };

    const createWindows = (buildingType, buildingHeight, posX, posZ, x, z, keyPrefix) => {
      const windows = [];
      const maxRows = Math.min(buildingType.windows.rows, Math.floor(buildingHeight / 2));
      
      for (let row = 0; row < maxRows; row++) {
        for (let col = 0; col < buildingType.windows.cols; col++) {
          const windowY = 2 + (buildingHeight - 4) * (row / maxRows) + (buildingHeight - 4) / (maxRows * 2);
          const windowX = posX + buildingType.width/2 - 0.05;
          const windowZ = posZ - buildingType.depth/2 + (buildingType.depth / (buildingType.windows.cols + 1)) * (col + 1);
          const lightIntensity = getWindowLight(x, z, row, col);
          const windowColor = getWindowColor(x, z, row, col);
          
          windows.push(
            <mesh key={`${keyPrefix}-window-${row}-${col}`} position={[windowX, windowY, windowZ]}>
              <boxGeometry args={[0.1, buildingType.type === "industrial" ? 2 : 1.5, buildingType.type === "industrial" ? 1.5 : 1]} />
              <meshStandardMaterial 
                color={buildingType.type === "modern" ? "#1a1a2e" : "#2c3e50"}
                emissive={windowColor} 
                emissiveIntensity={lightIntensity}
                transparent={buildingType.type === "modern"}
                opacity={buildingType.type === "modern" ? 0.7 : 1}
              />
            </mesh>
          );
        }
      }
      return windows;
    };

    const createBuildingDetails = (buildingType, buildingHeight, posX, posZ, keyPrefix) => {
      const details = [];
      
      if (buildingType.type === "artdeco") {
        details.push(
          <mesh key={`${keyPrefix}-crown1`} position={[posX, buildingHeight + 1, posZ]}>
            <boxGeometry args={[buildingType.width - 1, 2, buildingType.depth - 1]} />
            <meshStandardMaterial color="#7a6f64" />
          </mesh>,
          <mesh key={`${keyPrefix}-crown2`} position={[posX, buildingHeight + 2.5, posZ]}>
            <boxGeometry args={[buildingType.width - 2, 1, buildingType.depth - 2]} />
            <meshStandardMaterial color="#6b6258" />
          </mesh>
        );
      }
      
      if (buildingType.type === "brownstone") {
        details.push(
          <mesh key={`${keyPrefix}-stoop`} position={[posX + buildingType.width/2 + 1, 1.5, posZ]}>
            <boxGeometry args={[2, 3, 4]} />
            <meshStandardMaterial color="#a0522d" />
          </mesh>,
          <mesh key={`${keyPrefix}-cornice`} position={[posX, buildingHeight + 0.5, posZ]}>
            <boxGeometry args={[buildingType.width + 0.5, 1, buildingType.depth + 0.5]} />
            <meshStandardMaterial color="#654321" />
          </mesh>
        );
      }

      if (buildingType.type === "luxury") {
        const balconyCount = Math.min(4, Math.floor(buildingHeight / 8));
        for (let i = 0; i < balconyCount; i++) {
          details.push(
            <mesh key={`${keyPrefix}-balcony-${i}`} position={[posX + buildingType.width/2 + 0.3, 8 + i * 8, posZ]}>
              <boxGeometry args={[0.3, 0.5, 4]} />
              <meshStandardMaterial color="#87ceeb" transparent opacity={0.6} />
            </mesh>
          );
        }
      }

      if (buildingType.type === "modern") {
        details.push(
          <mesh key={`${keyPrefix}-antenna`} position={[posX, buildingHeight + 3, posZ]}>
            <cylinderGeometry args={[0.1, 0.1, 6]} />
            <meshStandardMaterial color="#ff0000" emissive="#ff0000" emissiveIntensity={0.3} />
          </mesh>
        );
      }

      if (buildingType.type === "house") {
        details.push(
          <mesh key={`${keyPrefix}-roof`} position={[posX, buildingHeight + 1.5, posZ]}>
            <coneGeometry args={[buildingType.width * 0.8, 3, 4]} />
            <meshStandardMaterial color="#8b4513" />
          </mesh>
        );
      }
      
      // Random rooftop equipment
      if (Math.random() < 0.3 && buildingType.type !== "house") {
        details.push(
          <mesh key={`${keyPrefix}-rooftop`} position={[posX + (Math.random() - 0.5) * 4, buildingHeight + 1.5, posZ + (Math.random() - 0.5) * 4]}>
            <boxGeometry args={[2, 3, 2]} />
            <meshStandardMaterial color="#555555" />
          </mesh>
        );
      }
      
      return details;
    };

    // City districts with different building densities and types
    const getDistrictInfo = (x, z) => {
      const distanceFromCenter = Math.sqrt(x * x + z * z);
      
      if (distanceFromCenter < 40) {
        return { types: [1, 3, 5], density: 0.95, name: "downtown" }; // Modern, artdeco, luxury
      } else if (distanceFromCenter < 80) {
        return { types: [2, 6, 8], density: 0.85, name: "midtown" }; // Prewar, commercial, office
      } else if (distanceFromCenter < 120) {
        return { types: [0, 2, 4, 6], density: 0.75, name: "urban" }; // Mixed residential/commercial
      } else {
        return { types: [0, 7], density: 0.6, name: "suburban" }; // Brownstone, houses
      }
    };

    // Main street buildings (enhanced) - avoiding ALL roads
    for (let z = -180; z <= 180; z += 12) {
      if (isOnRoad(0, z)) continue; // Skip if on any road

      [-22, 22].forEach((xSide, sideIndex) => {
        if (isOnRoad(xSide, z)) return; // Double-check building position
        
        const typeIndex = Math.floor(Math.abs(z / 12) + sideIndex * 2) % buildingTypes.length;
        const buildingType = buildingTypes[typeIndex];
        const heightVariation = Math.sin(z * 0.02 + sideIndex) * 5;
        const buildingHeight = buildingType.height + heightVariation;
        
        result.push(
          <RigidBody type="fixed" key={`main-building-${xSide}-${z}`}>
            <mesh position={[xSide, buildingHeight / 2, z]}>
              <boxGeometry args={[buildingType.width, buildingHeight, buildingType.depth]} />
              <meshStandardMaterial 
                color={buildingType.color}
                roughness={buildingType.type === "modern" ? 0.1 : 0.8}
                metalness={buildingType.type === "modern" ? 0.3 : 0.1}
              />
            </mesh>
            {createBuildingDetails(buildingType, buildingHeight, xSide, z, `main-${xSide}-${z}`)}
            {createWindows(buildingType, buildingHeight, xSide, z, xSide, z, `main-${xSide}-${z}`)}
          </RigidBody>
        );
      });
    }

    // City-wide building generation with PERFECT road avoidance
    for (let x = -220; x <= 220; x += 18) {
      for (let z = -220; z <= 220; z += 18) {
        // CRITICAL: Skip if position is on ANY road
        if (isOnRoad(x, z)) continue;
        
        // Additional safety check - avoid positions near main street buildings
        if (Math.abs(x) < 35 && !roads.crossStreets.some(streetZ => Math.abs(z - streetZ) <= 15)) continue;
        
        const district = getDistrictInfo(x, z);
        if (Math.random() > district.density) continue; // District-based density
        
        const buildingTypeIndex = district.types[Math.floor(Math.random() * district.types.length)];
        const buildingType = buildingTypes[buildingTypeIndex];
        
        // District-based height scaling
        let heightMultiplier = 1;
        if (district.name === "downtown") heightMultiplier = 1.2;
        else if (district.name === "suburban") heightMultiplier = 0.7;
        
        const heightVariation = (Math.sin(x * 0.015) + Math.cos(z * 0.02)) * 4;
        const buildingHeight = (buildingType.height * heightMultiplier) + heightVariation;
        
        // Position variation for organic feel
        const posX = x + (Math.random() - 0.5) * 8;
        const posZ = z + (Math.random() - 0.5) * 8;
        
        // FINAL SAFETY CHECK - ensure varied position is also clear
        if (isOnRoad(posX, posZ)) continue;
        
        result.push(
          <RigidBody type="fixed" key={`city-${x}-${z}`}>
            <mesh position={[posX, buildingHeight / 2, posZ]}>
              <boxGeometry args={[buildingType.width, buildingHeight, buildingType.depth]} />
              <meshStandardMaterial 
                color={buildingType.color}
                roughness={buildingType.type === "modern" ? 0.1 : 0.8}
                metalness={buildingType.type === "modern" ? 0.3 : 0.1}
              />
            </mesh>
            {createBuildingDetails(buildingType, buildingHeight, posX, posZ, `city-${x}-${z}`)}
            {createWindows(buildingType, buildingHeight, posX, posZ, x, z, `city-${x}-${z}`)}
          </RigidBody>
        );
      }
    }

    // Corner buildings at major intersections (road-aware)
    roads.crossStreets.forEach((streetZ, index) => {
      [roads.main.x - 30, roads.main.x + 30].forEach((xPos, sideIndex) => {
        if (isOnRoad(xPos, streetZ)) return; // Skip if on road
        
        const cornerType = buildingTypes[(index + sideIndex) % buildingTypes.length];
        const height = cornerType.height * 1.1; // Slightly taller corner buildings
        
        result.push(
          <RigidBody type="fixed" key={`corner-${streetZ}-${sideIndex}`}>
            <mesh position={[xPos, height / 2, streetZ]}>
              <boxGeometry args={[cornerType.width, height, cornerType.depth]} />
              <meshStandardMaterial color={cornerType.color} />
            </mesh>
            {createBuildingDetails(cornerType, height, xPos, streetZ, `corner-${streetZ}-${sideIndex}`)}
            {createWindows(cornerType, height, xPos, streetZ, xPos, streetZ, `corner-${streetZ}-${sideIndex}`)}
          </RigidBody>
        );
      });
    });

    // Enhanced infrastructure (avoiding roads)
    for (let z = -200; z <= 200; z += 20) {
      if (isOnRoad(0, z)) continue; // Skip if main road area

      // Sidewalks along main street
      [-30, 30].forEach((xPos, index) => {
        if (!isOnRoad(xPos, z)) {
          result.push(
            <RigidBody type="fixed" key={`sidewalk-${index}-${z}`}>
              <mesh position={[xPos, 0.15, z]}>
                <boxGeometry args={[16, 0.3, 20]} />
                <meshStandardMaterial color="#696969" />
              </mesh>
            </RigidBody>
          );
        }
      });
    }

    // Parks and green spaces (road-aware)
    const parkLocations = [
      { x: -120, z: -120, size: 25 },
      { x: 120, z: 120, size: 30 },
      { x: -150, z: 60, size: 20 },
      { x: 150, z: -180, size: 22 }
    ];

    parkLocations.forEach((park, index) => {
      if (!isOnRoad(park.x, park.z)) {
        result.push(
          <RigidBody type="fixed" key={`park-${index}`}>
            <mesh position={[park.x, 0.1, park.z]}>
              <boxGeometry args={[park.size, 0.2, park.size]} />
              <meshStandardMaterial color="#228b22" />
            </mesh>
            {/* Trees */}
            {Array.from({ length: 12 }, (_, i) => {
              const treeX = park.x + (Math.random() - 0.5) * park.size * 0.8;
              const treeZ = park.z + (Math.random() - 0.5) * park.size * 0.8;
              if (!isOnRoad(treeX, treeZ)) {
                return (
                  <mesh key={`tree-${i}`} position={[treeX, 4, treeZ]}>
                    <cylinderGeometry args={[0.5, 0.5, 8]} />
                    <meshStandardMaterial color="#8b4513" />
                  </mesh>
                );
              }
              return null;
            })}
            {/* Tree tops */}
            {Array.from({ length: 12 }, (_, i) => {
              const treeX = park.x + (Math.random() - 0.5) * park.size * 0.8;
              const treeZ = park.z + (Math.random() - 0.5) * park.size * 0.8;
              if (!isOnRoad(treeX, treeZ)) {
                return (
                  <mesh key={`leaves-${i}`} position={[treeX, 8, treeZ]}>
                    <sphereGeometry args={[2.5]} />
                    <meshStandardMaterial color="#228b22" />
                  </mesh>
                );
              }
              return null;
            })}
          </RigidBody>
        );
      }
    });

    return result;
  }, []);

  return <>{buildings}</>;
}