# coordinacion/

Estado compartido entre sesiones y agentes IA. **Protocolo completo: [`docs/agentes.md`](../docs/agentes.md).**

- `sesiones/`: una por sesión; solo la edita su dueña.
- `buzon/`: un archivo por mensaje (para una sesión, `equipo:<x>` o `todos`).
- `reclamos/`: rutas reservadas para editar.

Empieza con `node scripts/coord.mjs estado`. No guardes aquí secretos ni rutas personales: se versiona.
