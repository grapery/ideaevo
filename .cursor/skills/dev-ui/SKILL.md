---
name: dev-ui
description: >-
  Expert AI interface design system covering liquid-glass materials, optical
  physics, monochrome tinting, semantic spatial grouping, canvas extension,
  concentric corner radii, fluid morphing, and unified glass sampling. Use when
  designing or implementing UI/UX for AI apps, toolbars, floating chrome,
  glassmorphism, SwiftUI/UIKit, web frontends, Ardot/Figma screens, or when the
  user mentions liquid glass, material design, motion morphing, or WCAG contrast
  on translucent surfaces.
---

# Dev UI · Expert AI Interface Design

Apply this skill when **designing, reviewing, or implementing** AI product UI — not for generic CRUD unless glass/chrome/motion is involved.

## Quick workflow

1. **Classify surfaces** — content vs structural chrome vs transient overlay (sheet/menu).
2. **Pick material tier** — opaque surface / frosted / **liquid-glass lens** (only where justified).
3. **Group actions** — cohesive glass cluster vs segregated floats (see §Spatial).
4. **Quantize geometry** — concentric radii, platform density (phone vs pad/desktop).
5. **Plan motion** — every overlay must have a **source anchor** and reabsorption path.
6. **Validate** — run checklist below; read [reference.md](reference.md) for full theory.

## 1. Material & optical physics

### Liquid-glass lens (not flat, not basic blur)

Components float as **lenses** over content — refract, don't mask.

| Rule | Implementation |
|------|----------------|
| Contextual sampling | Sample underlying layer histogram; tint light/dark smoothly on scroll; keep text **WCAG AA+** on glass |
| Kinetic shimmer | Hover/press: spring scale **5–10%** + brief surface shimmer (liquid compression) |
| Unified sampler | Adjacent glass elements share **one sampling domain** — never per-widget scrims |

**Antipatterns (reject in review)**

- ❌ Black semi-transparent scrims under glass
- ❌ Independent samplers on adjacent glass → seam at boundaries
- ❌ Static frosted panels with no contextual tint

**Platform hints**

- **SwiftUI:** `Material` + custom `VisualEffect` / backdrop sampling; group siblings in one container; `matchedGeometryEffect` for morphs.
- **Web:** single backdrop-filter parent; `backdrop-filter` on container, children use shared clip + composite.
- **Ardot/Figma:** document sampling parent frame; avoid duplicate overlay rectangles.

### Monochrome dynamic tinting

| State | Color |
|-------|-------|
| Default toolbar/nav icons | **Monochrome / grayscale only** — no gradients, no multicolor |
| CTA / active / warning / badge | **Vibrant tint** — saturated after glass refraction, not flat fill |

Tint is **earned** by semantics (primary action, selection, alert) — not decoration.

## 2. Spatial layout & eye-gaze

### Semantic spatial grouping (Gestalt proximity)

```
[ ♥  ✿ ]  ←gap→  [ 分享 ]  ←gap→  [ ⋯ ]
  cohesive          isolated      isolated
  glass cluster     float         float
```

| Cluster type | Rule |
|--------------|------|
| **Cohesive** | Related actions (like + favorite, undo + redo) → **one** glass capsule, shared outline |
| **Segregated** | Global / destructive / share / more → **fixed spacer** or separate isolated float |

Do not merge unrelated actions to save pixels.

### Visual canvas extension

When chrome covers hero art:

1. **Mirror** occluded artwork beyond safe area (horizontal/vertical flip).
2. **Gaussian blur** mirrored extension → color halo for legibility without hard crop.
3. Foreground text stays on guaranteed contrast path (not on unblurred busy regions).

## 3. Geometry & quantization

### Concentric corner formula

Nested rounded shapes must share centers:

$$R_{inner} = R_{outer} - D$$

where $D$ = padding between outer and inner edge.

**Example:** card $R_{outer}=20$, inset $D=8$ → button $R_{inner}=12$.

### Responsive curvature

| Context | Curvature |
|---------|-----------|
| iPhone full-bleed | Larger radius (screen `screen` token, ~40 device frame) |
| iPad / Mac / dense panels | Tighter radius — preserve horizontal information density |

Always recompute $R_{inner}$ when $R_{outer}$ or $D$ changes.

## 4. Kinetic continuity & morphing

### Source-anchored scaling

Sheets, menus, popovers **morph from trigger** (button center origin), not slide from arbitrary screen edge — unless platform convention requires (iOS system sheet) and then **cross-fade + scale from source** in addition.

### Liquid reabsorption

On dismiss: child elements **merge toward geometric centroid** → single droplet → absorb into trigger. No instant `opacity: 0`.

### Unified glass containerization

Multiple glass elements that animate near/over each other → one **Unified Container Area** with shared pixel buffer so edges refract neighbors correctly.

## Design review checklist

Copy and fill when reviewing a screen or PR:

```
Material
- [ ] No scrims under glass; unified sampler for adjacent glass
- [ ] Scroll/context tint keeps text WCAG AA+
- [ ] Press/hover has spring + shimmer (or documented exception)
- [ ] Icons monochrome unless semantic tint

Spatial
- [ ] Related actions share one glass cluster
- [ ] Unrelated actions separated by spacer or isolated floats
- [ ] Hero under sidebar: mirror + blur extension if applicable

Geometry
- [ ] Nested radii satisfy R_inner = R_outer - D
- [ ] Phone vs pad/desktop curvature appropriate

Motion
- [ ] Overlays anchored to source control
- [ ] Dismiss uses reabsorption / morph, not pop-off
- [ ] Glass siblings share container during overlap animations
```

## Output format (design tasks)

When producing specs or Ardot edits, structure as:

1. **Surface map** — which regions are lens / opaque / content
2. **Action clusters** — grouped vs segregated with spacing tokens
3. **Radius table** — outer, D, inner per nested pair
4. **Motion storyboard** — source node → expanded state → reabsorption
5. **Antipattern audit** — explicit pass/fail against ❌ list

## Additional resources

- Full skill library (verbatim theory): [reference.md](reference.md)
- Project tokens (if in ideaevo): `ideaevoapp/ardot/design-tokens-v5.md`, `screens/00-navigation-ia.md`
