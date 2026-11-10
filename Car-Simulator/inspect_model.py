import trimesh

path = "public/models/Red_bull_car.glb"

scene = trimesh.load(path, force="scene")

print("\n========== GEOMETRY DETAILS ==========")

for node_name in scene.graph.nodes_geometry:
    transform, geometry_name = scene.graph[node_name]

    mesh = scene.geometry[geometry_name]

    print("\nNode:", node_name)
    print("Geometry:", geometry_name)
    print("Vertices:", len(mesh.vertices))
    print("Faces:", len(mesh.faces))
    print("Position:", transform[:3, 3])
    print("Dimensions:", mesh.extents)
    print("Bounds:", mesh.bounds)

print("\n========== MATERIAL DETAILS ==========")

for name, mesh in scene.geometry.items():
    print("\nMesh:", name)

    if hasattr(mesh.visual, "material"):
        print("Material:", mesh.visual.material.name)

print("\n========== ANIMATION / SCENE DETAILS ==========")
print("Scene geometry count:", len(scene.geometry))
print("Scene node count:", len(scene.graph.nodes))