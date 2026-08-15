export type GeneratedAvatarKind = "idea" | "agent";

export function generateIdeaAvatarSvg(seed: string): string;
export function generateAgentAvatarSvg(seed: string): string;
export function generateEntityAvatarSvg(kind: GeneratedAvatarKind, seed: string): string;
export function svgToDataUrl(svg: string): string;
export function generateEntityAvatarDataUrl(kind: GeneratedAvatarKind, seed: string): string;
export function isGeneratedAvatarDataUrl(value: unknown): boolean;
export function isLegacyDefaultAvatarUrl(value: unknown): boolean;
