"""Ejecuta el render reglado de FDN-040 con Blender en modo headless."""
import hashlib
import json
from math import isclose, radians
from pathlib import Path
import struct
import sys
import zlib

import bpy
from mathutils import Matrix, Vector


PNG_SIGNATURE = b"\x89PNG\r\n\x1a\n"


def paeth(left, up, upper_left):
    estimate = left + up - upper_left
    left_error = abs(estimate - left)
    up_error = abs(estimate - up)
    diagonal_error = abs(estimate - upper_left)
    if left_error <= up_error and left_error <= diagonal_error:
        return left
    return up if up_error <= diagonal_error else upper_left


def rgba_sha256(path, width, height):
    """Decodifica el PNG RGBA8 generado por Blender y excluye sus metadatos."""
    data = path.read_bytes()
    if data[:8] != PNG_SIGNATURE:
        raise ValueError("El fotograma no es un PNG.")
    compressed = bytearray()
    offset = 8
    header = None
    while offset + 12 <= len(data):
        length, kind = struct.unpack_from(">I4s", data, offset)
        start = offset + 8
        end = start + length
        if end + 4 > len(data):
            raise ValueError("Bloque PNG truncado.")
        if kind == b"IHDR":
            header = struct.unpack(">IIBBBBB", data[start:end])
        elif kind == b"IDAT":
            compressed.extend(data[start:end])
        elif kind == b"IEND":
            break
        offset = end + 4
    if header != (width, height, 8, 6, 0, 0, 0):
        raise ValueError("Se esperaba un PNG RGBA8 no entrelazado del tamaño solicitado.")

    decoded = zlib.decompress(compressed)
    stride = width * 4
    if len(decoded) != (stride + 1) * height:
        raise ValueError("Tamaño RGBA inesperado.")
    previous = bytearray(stride)
    digest = hashlib.sha256()
    for start in range(0, len(decoded), stride + 1):
        filter_type = decoded[start]
        row = bytearray(decoded[start + 1:start + stride + 1])
        if filter_type not in (0, 1, 2, 3, 4):
            raise ValueError("Filtro de PNG desconocido.")
        if filter_type:
            for position in range(stride):
                left = row[position - 4] if position >= 4 else 0
                up = previous[position]
                upper_left = previous[position - 4] if position >= 4 else 0
                if filter_type == 1:
                    predictor = left
                elif filter_type == 2:
                    predictor = up
                elif filter_type == 3:
                    predictor = (left + up) // 2
                else:
                    predictor = paeth(left, up, upper_left)
                row[position] = (row[position] + predictor) & 255
        digest.update(row)
        previous = row
    return digest.hexdigest()


def point_at(obj, target):
    obj.rotation_euler = (target - obj.location).to_track_quat("-Z", "Y").to_euler()


def verify_glb_is_self_contained(path):
    with path.open("rb") as stream:
        prefix = stream.read(20)
        if len(prefix) != 20:
            raise ValueError("Cabecera GLB incompleta.")
        magic, version, total, chunk_size, chunk_kind = struct.unpack("<4sIII4s", prefix)
        if (
            magic != b"glTF" or version != 2 or chunk_kind != b"JSON"
            or total != path.stat().st_size or chunk_size > total - 20
        ):
            raise ValueError("Se esperaba un asset GLB v2 válido.")
        metadata = json.loads(stream.read(chunk_size))
    for section in ("buffers", "images"):
        for entry in metadata.get(section, ()):
            uri = entry.get("uri")
            if uri is not None and not uri.startswith("data:"):
                raise ValueError("El asset GLB debe contener sus buffers y texturas.")


def add_model(scene, asset):
    if asset is None:
        bpy.ops.mesh.primitive_cube_add(size=1.7)
        cube = bpy.context.object
        cube.name = "FDN-040 Placeholder"
        bevel = cube.modifiers.new(name="Bevel", type="BEVEL")
        bevel.width = 0.12
        bevel.segments = 3
        material = bpy.data.materials.new("Copper")
        shader = material.node_tree.nodes.get("Principled BSDF")
        shader.inputs["Base Color"].default_value = (0.58, 0.15, 0.045, 1)
        shader.inputs["Roughness"].default_value = 0.38
        cube.data.materials.append(material)
        cube.rotation_euler = (radians(17), radians(11), radians(20))
    elif asset.suffix.lower() == ".glb":
        verify_glb_is_self_contained(asset)
        bpy.ops.import_scene.gltf(filepath=str(asset))
        for obj in tuple(scene.objects):
            if obj.type in {"CAMERA", "LIGHT"}:
                bpy.data.objects.remove(obj, do_unlink=True)
    elif asset.suffix.lower() == ".blend":
        with bpy.data.libraries.load(str(asset), link=False) as (source, target):
            target.objects = source.objects
        external_libraries = any(
            Path(bpy.path.abspath(library.filepath)).resolve() != asset.resolve()
            for library in bpy.data.libraries
        )
        external_objects = any(obj is not None and obj.library is not None for obj in target.objects)
        if external_libraries or external_objects or any(cache.filepath for cache in bpy.data.cache_files):
            raise ValueError("El .blend no debe usar bibliotecas ni cachés externas.")
        for image in bpy.data.images:
            if image.source in {"SEQUENCE", "MOVIE", "TILED"} or (image.source == "FILE" and not image.packed_file):
                raise ValueError("El .blend debe contener sus texturas empaquetadas.")
        for obj in target.objects:
            if obj is not None and obj.type in {"MESH", "EMPTY"}:
                scene.collection.objects.link(obj)
    else:
        raise ValueError("El asset 3D debe ser un GLB autocontenido o un .blend con mallas.")

    bpy.context.view_layer.update()
    points = [
        obj.matrix_world @ Vector(corner)
        for obj in scene.objects if obj.type == "MESH"
        for corner in obj.bound_box
    ]
    if not points:
        raise ValueError("El asset no contiene mallas que se puedan renderizar.")
    minimum = Vector(tuple(min(point[axis] for point in points) for axis in range(3)))
    maximum = Vector(tuple(max(point[axis] for point in points) for axis in range(3)))
    return (minimum + maximum) / 2, max(0.1, max(maximum - minimum) / 2)


def camera_curves(channels):
    result = {}
    for name in ("x", "y", "rotation", "scale"):
        if name not in channels:
            continue
        curve = channels[name]
        # A igualdad de fotograma prevalece la última clave recibida.
        by_frame = {key["frame"]: key for key in curve["keyframes"]}
        result[name] = (curve["defaultValue"], [by_frame[frame] for frame in sorted(by_frame)])
    return result


def sample_curve(curve, frame, fallback):
    if curve is None:
        return fallback
    default, keys = curve
    if not keys or frame < keys[0]["frame"]:
        return default
    for left, right in zip(keys, keys[1:]):
        if frame < right["frame"]:
            progress = (frame - left["frame"]) / (right["frame"] - left["frame"])
            easing = right.get("easing", "linear")
            if easing == "hold":
                return left["value"]
            if easing == "smooth":
                progress = progress * progress * (3 - 2 * progress)
            return left["value"] + (right["value"] - left["value"]) * progress
    return keys[-1]["value"]


def set_camera(camera, focus, radius, curves, frame):
    offset_x = sample_curve(curves.get("x"), frame, 0)
    offset_y = sample_curve(curves.get("y"), frame, 0)
    angle = sample_curve(curves.get("rotation"), frame, 0)
    scale = sample_curve(curves.get("scale"), frame, 1)
    offset = Matrix.Rotation(radians(angle), 3, "Z") @ Vector((3.9, -5.4, 3.1))
    pan = Vector((offset_x, 0, offset_y))
    camera.location = focus + radius * (offset + pan)
    camera.data.lens = max(1, 48 * scale)
    point_at(camera, focus + radius * pan)


def build_scene(params, asset):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.frame_start = 1
    scene.frame_end = params["durationFrames"]
    rate = params["fps"]["num"] / params["fps"]["den"]
    scene.render.fps = max(1, round(rate))
    scene.render.fps_base = scene.render.fps / rate
    if not isclose(scene.render.fps / scene.render.fps_base, rate, rel_tol=1e-6):
        raise ValueError("Blender no puede representar la tasa de fotogramas solicitada.")
    scene.render.engine = "CYCLES"
    scene.cycles.device = "CPU"
    scene.cycles.samples = 4
    scene.cycles.use_adaptive_sampling = False
    scene.cycles.use_denoising = False
    seed_max = scene.cycles.bl_rna.properties["seed"].hard_max
    scene.cycles.seed = params.get("seed", 11) % (seed_max + 1)
    scene.render.threads_mode = "FIXED"
    scene.render.threads = 4
    scene.render.resolution_x = params["width"]
    scene.render.resolution_y = params["height"]
    scene.render.resolution_percentage = 100
    scene.render.film_transparent = True
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"
    scene.render.image_settings.color_depth = "8"

    focus, radius = add_model(scene, asset)
    bpy.ops.object.camera_add()
    scene.camera = bpy.context.object
    scene.camera.data.clip_start = min(0.1, radius / 10)
    scene.camera.data.clip_end = max(100, radius * 20)
    bpy.ops.object.light_add(type="AREA", location=focus + radius * Vector((0, -4, 5)))
    light = bpy.context.object
    light.data.energy = 950 * radius ** 2
    light.data.shape = "DISK"
    light.data.size = 4 * radius
    point_at(light, focus)
    return scene, focus, radius


def main():
    arguments = sys.argv[sys.argv.index("--") + 1:]
    if len(arguments) not in (1, 2):
        raise ValueError("Se esperaba el JSON de parámetros y, opcionalmente, un asset 3D.")
    params = json.loads(Path(arguments[0]).read_text(encoding="utf-8"))
    asset = Path(arguments[1]) if len(arguments) == 2 else None
    scene, focus, radius = build_scene(params, asset)
    curves = camera_curves(params["channels"])
    output = Path.cwd() / "frames"
    output.mkdir(exist_ok=False)

    frames = []
    for relative_frame in range(params["durationFrames"]):
        blender_frame = relative_frame + 1
        scene.frame_set(blender_frame)
        set_camera(scene.camera, focus, radius, curves, relative_frame)
        path = output / f"frame-{blender_frame:04d}.png"
        scene.render.filepath = str(path)
        bpy.ops.render.render(write_still=True)
        frames.append({
            "name": path.name,
            "contentSha256": rgba_sha256(path, params["width"], params["height"]),
        })

    metadata = {"engineVersion": ".".join(map(str, bpy.app.version)), "frames": frames}
    (Path.cwd() / "render.json").write_text(
        json.dumps(metadata, separators=(",", ":")) + "\n", encoding="utf-8",
    )


if __name__ == "__main__":
    main()
