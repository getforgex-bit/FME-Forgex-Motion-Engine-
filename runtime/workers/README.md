# Workers de FME

`@fme/runtime-workers` ejecuta procesos locales de adaptadores de confianza con archivos de salida separados, un directorio por trabajo y un tiempo máximo.

```typescript
const result = await runIsolated({
  cmd: blenderExe,
  args: ['-b', '--factory-startup', '--disable-autoexec', '-P', { path: sceneScript }],
  workDir: jobsRoot,
  allowedPaths: [blenderExe, jobsRoot, sceneScript],
  timeoutMs: 60_000,
  env: {},
});
```

- `cmd` es la ruta absoluta de un ejecutable autorizado individualmente en `allowedPaths`. En Windows debe ser un archivo `.exe`.
- `workDir` es un directorio existente bajo una raíz autorizada. El worker crea allí un subdirectorio distinto para cada ejecución y lo conserva para inspeccionar la salida.
- `allowedPaths` contiene rutas absolutas existentes de archivos o directorios. Los archivos autorizan esa ruta concreta y los directorios autorizan sus descendientes. Se rechazan raíces de volumen, componentes `..`, enlaces simbólicos y junctions. La comparación usa las rutas canónicas. Para guardar un archivo nuevo se comprueba su ancestro existente.
- Declara las rutas de argumentos con `{ path }`. Las relativas se resuelven contra el directorio del trabajo. Usa strings para argumentos literales que prepara el adaptador. Las apariencias de ruta con separadores, prefijos de unidad o `..` deben declararse mediante `{ path }`. Un literal como `literal&without-shell` se entrega como argumento único. Si una expresión fija del adaptador incluye un separador, declárala con `{ literal: '30000/1001' }`. Esta opción se reserva para sintaxis construida por el adaptador y rechaza rutas claramente absolutas o con componentes `..`. Las referencias a archivos deben usar `{ path }`.
- `env` contiene el entorno explícito del adaptador y por defecto es vacío. El worker usa `shell: false`, stdin ignorado y la opción de ocultar ventanas de Node.

El resultado es `{ exitCode, stdoutPath, stderrPath, durationMs, killed }`. `exitCode` puede ser `null` si no se obtiene un código. `killed` indica que el sistema aceptó terminar el árbol tras el timeout. Junto con stdout y stderr se guarda `worker.json` con PID, duración, fecha de inicio, timeout y diagnósticos del lanzador. Las rutas de los logs se reservan en `.fme-worker/` dentro del trabajo. El adaptador conserva el control sobre cualquier contenido sensible que la herramienta escriba en sus propios logs.

En Windows, al vencer el timeout se usa el `taskkill.exe` del sistema con `/PID /T /F`. En sistemas POSIX se solicita la terminación del grupo del proceso. La duración puede incluir hasta cinco segundos para `taskkill` y otros dos para confirmar el cierre. Si falla la terminación del árbol, se registra el error y se intenta terminar el proceso raíz de forma directa. [Referencia de taskkill](https://learn.microsoft.com/en-us/windows-server/administration/windows-commands/taskkill)

La lista de rutas se aplica a los argumentos que entrega el adaptador y al directorio de trabajo. El proceso conserva los permisos de acceso a archivos y red de la cuenta anfitriona. El adaptador prepara el ejecutable, las opciones y cualquier sintaxis que la herramienta pueda interpretar. Las raíces autorizadas deben estar bajo control local y protegidas frente a escrituras de terceros. El proceso raíz debe mantenerse activo mientras sus descendientes trabajan. Un proceso ajeno al árbol, por ejemplo un servicio lanzado fuera de él, queda fuera del alcance de la terminación.

Ejecuta la comprobación tipada y las pruebas del workspace con:

```powershell
npm --workspace @fme/runtime-workers test
```
