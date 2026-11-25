/**
 * Construcción del plan estético y aplicación no destructiva sobre `Project` (FDN-060).
 */
import type {
  Asset,
  Curve,
  ExternalProjectRef,
  Keyframe,
  Layer,
  Project,
  Scene,
  Sequence,
} from '@fme/project';
import { evaluateLayerChannel } from './rules.ts';
import {
  ART_DIRECTION_SCHEMA_VERSION,
  parseStyleProfile,
  type ArtDirectionPlan,
  type ArtDirectionValidationIssue,
  type LayerArtPlan,
  type SceneArtPlan,
  type SequenceArtPlan,
  type StyleProfile,
} from './schema.ts';

/** Error emitido cuando un `StyleProfile` no supera la validación en runtime. */
export class ArtDirectionValidationError extends Error {
  readonly issues: ArtDirectionValidationIssue[];

  constructor(message: string, issues: ArtDirectionValidationIssue[]) {
    super(message);
    this.name = 'ArtDirectionValidationError';
    this.issues = issues;
  }
}

export type ApplyArtDirectionOptions = {
  /** Por defecto `true`. Si es `false`, conserva curvas `expression`/`integration` ya definidas en cada capa. */
  overwriteExisting?: boolean;
};

function assertValidProfile(profile: StyleProfile): StyleProfile {
  const parsed = parseStyleProfile(profile);
  if (!parsed.ok) {
    const summary = parsed.issues
      .map((issue) => `${issue.path}: ${issue.message}`)
      .join('; ');
    throw new ArtDirectionValidationError(
      `StyleProfile inválido: ${summary}`,
      parsed.issues,
    );
  }
  return parsed.value;
}

function cloneKeyframe(keyframe: Keyframe): Keyframe {
  return {
    frame: keyframe.frame,
    value: keyframe.value,
    ...(keyframe.easing !== undefined ? { easing: keyframe.easing } : {}),
  };
}

function cloneCurve(curve: Curve): Curve {
  return {
    defaultValue: curve.defaultValue,
    keyframes: curve.keyframes.map(cloneKeyframe),
  };
}

function cloneAsset(asset: Asset): Asset {
  return {
    id: asset.id,
    type: asset.type,
    uri: asset.uri,
    ...(asset.hash !== undefined ? { hash: asset.hash } : {}),
    ...(asset.licenseId !== undefined ? { licenseId: asset.licenseId } : {}),
  };
}

function cloneExternalProject(ref: ExternalProjectRef): ExternalProjectRef {
  return {
    pluginId: ref.pluginId,
    uri: ref.uri,
    ...(ref.engineVersion !== undefined
      ? { engineVersion: ref.engineVersion }
      : {}),
    ...(ref.renderArtifactId !== undefined
      ? { renderArtifactId: ref.renderArtifactId }
      : {}),
  };
}

function cloneLayer(layer: Layer): Layer {
  const clonedChannels: Layer['channels'] = {};
  for (const [channelKey, curve] of Object.entries(layer.channels)) {
    if (curve !== undefined) {
      clonedChannels[channelKey as keyof Layer['channels']] = cloneCurve(curve);
    }
  }

  return {
    id: layer.id,
    kind: layer.kind,
    ...(layer.assetId !== undefined ? { assetId: layer.assetId } : {}),
    startFrame: layer.startFrame,
    durationFrames: layer.durationFrames,
    ...(layer.sourceInFrame !== undefined
      ? { sourceInFrame: layer.sourceInFrame }
      : {}),
    zIndex: layer.zIndex,
    techniques: [...layer.techniques],
    ...(layer.guide3DLayerId !== undefined
      ? { guide3DLayerId: layer.guide3DLayerId }
      : {}),
    channels: clonedChannels,
    ...(layer.externalProject !== undefined
      ? { externalProject: cloneExternalProject(layer.externalProject) }
      : {}),
  };
}

function cloneScene(scene: Scene): Scene {
  return {
    id: scene.id,
    durationFrames: scene.durationFrames,
    layers: scene.layers.map(cloneLayer),
  };
}

function cloneSequence(sequence: Sequence): Sequence {
  return {
    id: sequence.id,
    scenes: sequence.scenes.map(cloneScene),
  };
}

function cloneProject(project: Project): Project {
  return {
    schemaVersion: project.schemaVersion,
    id: project.id,
    name: project.name,
    fps: { num: project.fps.num, den: project.fps.den },
    width: project.width,
    height: project.height,
    seed: project.seed,
    assets: project.assets.map(cloneAsset),
    sequences: project.sequences.map(cloneSequence),
  };
}

/**
 * Construye un `ArtDirectionPlan` determinista recorriendo secuencias, escenas y capas
 * en el orden del proyecto, sin modificar `project`.
 */
export function buildArtDirectionPlan(
  project: Project,
  profile: StyleProfile,
): ArtDirectionPlan {
  const validProfile = assertValidProfile(profile);

  const sequences: SequenceArtPlan[] = project.sequences.map((sequence) => {
    const scenes: SceneArtPlan[] = sequence.scenes.map((scene) => {
      const layers: LayerArtPlan[] = scene.layers.map((layer) => {
        const context = {
          projectSeed: project.seed,
          sequenceId: sequence.id,
          sceneId: scene.id,
          layer,
        };

        const exprResult = evaluateLayerChannel(
          context,
          validProfile,
          'expression',
        );
        const integResult = evaluateLayerChannel(
          context,
          validProfile,
          'integration',
        );

        const appliedRules = [
          ...exprResult.appliedRules,
          ...integResult.appliedRules,
        ];

        const rationale =
          appliedRules.length > 0
            ? appliedRules.map((item) => item.rationale)
            : [
                `Sin reglas específicas para capa "${layer.id}"; se aplican anclas base (${validProfile.expressionAnchor} / ${validProfile.integrationAnchor}) del perfil "${validProfile.id}".`,
              ];

        return {
          layerId: layer.id,
          layerKind: layer.kind,
          techniques: [...layer.techniques],
          expression: exprResult.curve,
          integration: integResult.curve,
          appliedRules,
          rationale,
        };
      });

      return {
        sceneId: scene.id,
        durationFrames: scene.durationFrames,
        layers,
      };
    });

    return {
      sequenceId: sequence.id,
      scenes,
    };
  });

  return {
    schemaVersion: ART_DIRECTION_SCHEMA_VERSION,
    projectId: project.id,
    profileId: validProfile.id,
    profileName: validProfile.name,
    family: validProfile.family,
    seed: project.seed,
    sequences,
  };
}

/**
 * Aplica de forma no destructiva un `StyleProfile` sobre una copia profunda de `project`,
 * devolviendo tanto el nuevo `Project` como el `ArtDirectionPlan` generado.
 */
export function applyArtDirection(
  project: Project,
  profile: StyleProfile,
  options: ApplyArtDirectionOptions = {},
): { project: Project; plan: ArtDirectionPlan } {
  const overwriteExisting = options.overwriteExisting ?? true;
  const plan = buildArtDirectionPlan(project, profile);
  const nextProject = cloneProject(project);

  for (let seqIdx = 0; seqIdx < nextProject.sequences.length; seqIdx += 1) {
    const sequence = nextProject.sequences[seqIdx];
    const sequencePlan = plan.sequences[seqIdx];
    if (sequence === undefined || sequencePlan === undefined) {
      continue;
    }

    for (let sceneIdx = 0; sceneIdx < sequence.scenes.length; sceneIdx += 1) {
      const scene = sequence.scenes[sceneIdx];
      const scenePlan = sequencePlan.scenes[sceneIdx];
      if (scene === undefined || scenePlan === undefined) {
        continue;
      }

      for (let layerIdx = 0; layerIdx < scene.layers.length; layerIdx += 1) {
        const layer = scene.layers[layerIdx];
        const layerPlan = scenePlan.layers[layerIdx];
        if (layer === undefined || layerPlan === undefined) {
          continue;
        }

        if (overwriteExisting || layer.channels.expression === undefined) {
          layer.channels.expression = cloneCurve(layerPlan.expression);
        }
        if (overwriteExisting || layer.channels.integration === undefined) {
          layer.channels.integration = cloneCurve(layerPlan.integration);
        }
      }
    }
  }

  return {
    project: nextProject,
    plan,
  };
}
