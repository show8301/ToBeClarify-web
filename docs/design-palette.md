# Lucid Dream colour history

This file records the visual palette before and after the August 2026 dark-hotel redesign.

## Archived palette — editorial daylight

Previously defined in `styles/public/site.css`:

| Role | Token | Value | Visual use |
| --- | --- | --- | --- |
| Ink | `--ink` | `#18201d` | Main text, rules and dark buttons |
| Paper | `--paper` | `#f3eee4` | Site background |
| Coral | `--coral` | `#ff705c` | Main accent and prices |
| Mint | `--mint` | `#bdf1df` | Panels, shadows and status accents |
| Lilac | `--lilac` | `#b9aaff` | Decorative gradients and shadows |
| Line | `--line` | `rgba(24,32,29,.22)` | Dividers and subtle borders |

Supporting surfaces were mostly `#faf7ef`, `#f9f6ef`, `#f8f4eb`, `#f5efe6`, `#dcf6ec`, and `#ebe6f3`. The result was a bright cream-paper editorial identity with coral, mint and lilac highlights.

## Archived palette snapshot — deep-sea hotel lounge

Recorded again on 2026-08-17 before exploring the next visual direction. Treat this section as a restorable snapshot even after the live theme changes.

The live theme is defined by semantic tokens at the end of `styles/public/site.css`:

| Role | Token | Value | Visual use |
| --- | --- | --- | --- |
| Pearl text | `--ink` | `#e8e2d7` | Primary text and high-contrast rules |
| Midnight | `--paper` | `#101820` | Site background |
| Smoked gold | `--coral` | `#b58a4d` | Premium accent, prices and focus states |
| Peacock teal | `--mint` | `#147d82` | Water-light accent and active states |
| Mulberry | `--lilac` | `#5a354f` | Intimate secondary accent |
| Deep ocean | `--ocean` | `#172735` | Main raised surface |
| Lagoon | `--lagoon` | `#294a4b` | Secondary panels and aquatic highlights |
| Abyss | `--abyss` | `#091118` | Deepest background and overlays |
| Warm stone | `--stone` | `#c8c0b2` | Reserved light neutral |

Recommended balance: 60% midnight/deep ocean, 20% teal/lagoon, 10% warm stone, 7% smoked gold, and no more than 3% mulberry or luminous accents.

### Recovery token block

```css
:root {
  --ink: #e8e2d7;
  --paper: #101820;
  --coral: #b58a4d;
  --mint: #147d82;
  --lilac: #5a354f;
  --line: rgba(232, 226, 215, .2);
  --ocean: #172735;
  --lagoon: #294a4b;
  --abyss: #091118;
  --stone: #c8c0b2;
  --surface: rgba(23, 39, 53, .94);
  --surface-soft: rgba(41, 74, 75, .58);
  --gold-glow: rgba(181, 138, 77, .2);
}
```

Characteristic use: midnight-to-abyss page gradients, deep-ocean cards, peacock-teal water light, smoked-gold calls to action, pearl typography, and very limited mulberry shadows. The overall impression is an underwater boutique hotel: calm, nocturnal, restrained and slightly Art Deco.

## Current palette — Shoko pearl bubble

Introduced on 2026-08-17. This direction combines the supplied dreamy-ocean colours with the silver blue, periwinkle and lavender-grey range seen in Shoko's hair. Black surfaces are removed; deep colour is reserved for typography and necessary contrast.

| Role | Token | Value | Visual use |
| --- | --- | --- | --- |
| Deep ocean slate | `--ink` | `#31334a` | Main text, icons and accessible contrast |
| Pearl mist | `--paper` | `#e7e8f3` | Main page background |
| Hair blue | `--coral` | `#7189b8` | Primary accent and active controls |
| Seafoam mint | `--mint` | `#a0d9d6` | Water light, soft shadows and status accents |
| Dreamy lilac | `--lilac` | `#b8bbd8` | Brand gradients and dreamlike depth |
| Silver-blue glass | `--ocean` | `#dce2f0` | Main raised surface |
| Pale lagoon | `--lagoon` | `#c5e3e2` | Secondary panels and aquatic highlights |
| Periwinkle shadow | `--abyss` | `#c8cce1` | Deeper light surface, never black |
| Muted slate | `--stone` | `#656a83` | Secondary copy |
| Shoko highlight | `--hair-blue` | `#8ba7ca` | Titles and luminous blue accents |
| Shoko shadow | `--hair-shadow` | `#65789f` | Labels, prices and stronger accents |
| Pearl white | `--pearl` | `#f7f7fb` | Glass highlights and high-light surfaces |

Recommended balance: 44% pearl and silver-blue surfaces, 24% dreamy lilac, 18% seafoam, 10% mist/hair blue, and 4% deep ocean slate. Bubble forms use transparent white rings, very soft blue-lilac shadows and restrained motion; they sit behind content rather than competing with it.

## Motion language — lucid drift

Dreamlike motion is deliberately slow and peripheral: overlapping image dissolves, moving water-light, low fog, almost-imperceptible title echoes, and a brief submerged route transition. The global depth system adds near-field pearl bubbles that drift downward with scroll, a slower counter-moving mist layer, and abstract seafoam/lilac coral silhouettes around the staff roster. Content surfaces remain stable. Mobile layouts use fewer bubbles, and every ambient animation or parallax transform is disabled when `prefers-reduced-motion` is enabled.

The staff roster avoids square personnel cards. Portraits use tall pearl-like arches, staggered vertical rhythm, full-bleed photography, and a floating glass caption at the base so the people feel suspended in the scene rather than filed into a grid.

### Soft gradient revision

Refined after stakeholder feedback: lavender, mist blue and blush pink are no longer assigned to separate blocks. They appear as oversized, blurred gradients that overlap across the page, while glass surfaces stay neutral enough to reveal the colour underneath. Blush pink `#E8C7DA`, mist blue `#A9C7EA`, and lavender `#C1B9DF` form the primary atmosphere; seafoam is reduced to a minor aquatic highlight. Pearl bubbles use translucent iridescent reflections from the same three colours.
