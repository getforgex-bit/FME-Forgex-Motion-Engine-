"""Construye y renderiza la escena de aceptación FDN-011."""
import json
from math import radians
from pathlib import Path
import sys
from time import perf_counter

import bpy


def point_at_origin(obj):
    obj.rotation_euler = (-obj.location).to_track_quat("-Z", "Y").to_euler()


def build_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.frame_start = 1
    scene.frame_end = 90
    scene.render.fps = 30
    scene.render.fps_base = 1.0
    scene.render.engine = "CYCLES"
    scene.cycles.device = "CPU"
    scene.cycles.samples = 4
    scene.cycles.use_adaptive_sampling = False
    scene.cycles.use_denoising = False
    scene.cycles.seed = 11
    scene.render.resolution_x = 960
    scene.render.resolution_y = 540
    scene.render.resolution_percentage = 100
    scene.render.film_transparent = True
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"
    scene.render.image_settings.color_depth = "8"

    bpy.ops.mesh.primitive_cube_add(size=1.7)
    cube = bpy.context.object
    cube.name = "FDN-011 Cube"
    bevel = cube.modifiers.new(name="Bevel", type="BEVEL")
    bevel.width = 0.12
    bevel.segments = 3

    material = bpy.data.materials.new("Copper")
    shader = material.node_tree.nodes.get("Principled BSDF")
    shader.inputs["Base Color"].default_value = (0.58, 0.15, 0.045, 1)
    shader.inputs["Roughness"].default_value = 0.38
    cube.data.materials.append(material)

    for frame, angle in ((1, 10), (45, 135), (90, 260)):
        cube.rotation_euler = (radians(17), radians(11), radians(angle))
        cube.keyframe_insert(data_path="rotation_euler", frame=frame)

    bpy.ops.object.camera_add(location=(3.9, -5.4, 3.1))
    scene.camera = bpy.context.object
    scene.camera.data.lens = 48
    point_at_origin(scene.camera)

    bpy.ops.object.light_add(type="AREA", location=(0, -4, 5))
    light = bpy.context.object
    light.data.energy = 950
    light.data.shape = "DISK"
    light.data.size = 4
    point_at_origin(light)
    return scene


def main():
    output = Path(sys.argv[sys.argv.index("--") + 1]).resolve(strict=True)
    scene = build_scene()
    frame_seconds = []
    for frame in range(scene.frame_start, scene.frame_end + 1):
        scene.frame_set(frame)
        scene.render.filepath = str(output / f"frame-{frame:04d}.png")
        started = perf_counter()
        bpy.ops.render.render(write_still=True)
        frame_seconds.append(round(perf_counter() - started, 4))

    metrics = {
        "version": bpy.app.version_string,
        "buildHash": bpy.app.build_hash.decode("ascii"),
        "width": scene.render.resolution_x,
        "height": scene.render.resolution_y,
        "fps": scene.render.fps / scene.render.fps_base,
        "engine": scene.render.engine,
        "device": scene.cycles.device,
        "samples": scene.cycles.samples,
        "frameSeconds": frame_seconds,
    }
    (output / "render.json").write_text(
        json.dumps(metrics, indent=2) + "\n", encoding="utf-8"
    )


if __name__ == "__main__":
    main()
