# Pruebas defensivas de límites

```powershell
npm run typecheck
node --test "tests/seguridad/*.test.ts"
```

Las pruebas usan archivos sintéticos y directorios exclusivos bajo el temporal del sistema. Los enlaces de directorio apuntan a un directorio vecino de la misma fixture. El worker ejecuta únicamente Node con el script de prueba versionado. MCP usa transporte en memoria y un adaptador centinela. La suite puede ejecutarse sin Blender, Revideo ni FreeCut.

| Superficie | Control comprobado |
|---|---|
| Worker | Raíz autorizada, componentes padre y junctions. Entrega literal de `literal&marca` como un argumento. |
| Blender | Proyecto y directorio de trabajo limitados a las raíces declaradas. Rechazo de enlaces y de un campo de código con texto inerte. |
| Revideo | Rechazo de tipo de entrada ajeno al contrato y conservación de `literal&marca` como texto al preparar una capa. |
| FreeCut | Rechazo de tipo de entrada ajeno al contrato y contención de los medios de `edit.export` en la carpeta del proyecto. |
| MCP | `project.open` y `job.run` aplican la raíz configurada. Una entrada rechazada no llega al adaptador ni crea su directorio de trabajo. |

Los casos `TODO` registran controles sin una política configurable en la API actual. La CLI admite rutas locales sin una raíz de proyecto configurable. Los adaptadores directos de Revideo y FreeCut reciben el contexto autorizado de quien los llama. La llamada directa a `edit.compose` de FreeCut no establece raíces configuradas para sus entradas absolutas. Estos escenarios quedan pendientes de una decisión de alcance.

El comando anterior ejecuta la suite focal. La incorporación a `npm test` corresponde a la integración de A0.
