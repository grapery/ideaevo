const PALETTES = [
  ["#0A0A0A", "#3370FF", "#FF8A00", "#A3E635", "#F4F6F8"],
  ["#172416", "#A3E635", "#FF6B5F", "#3370FF", "#FFF4E6"],
  ["#102A43", "#4DA3FF", "#FFB44A", "#F7F8FA", "#D7E6FF"],
  ["#3A1808", "#FF8A00", "#FFD166", "#3370FF", "#F4F6F8"],
  ["#1E173A", "#8B7CFF", "#FF6B8A", "#A3E635", "#F7F8FA"],
  ["#071D22", "#16B8A6", "#72E0D1", "#FF8A00", "#E9FBF8"],
];

function hashSeed(seed) {
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function mulberry32(seed) {
  return () => {
    let value = seed += 0x6d2b79f5;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function pick(random, values) {
  return values[Math.floor(random() * values.length) % values.length];
}

function number(random, min, max) {
  return Math.round(min + random() * (max - min));
}

function circle(x, y, size, fill, stroke = "none", strokeWidth = 0) {
  return `<circle cx="${x}" cy="${y}" r="${size / 2}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}"/>`;
}

function square(x, y, size, fill, rotation = 0, radius = 2) {
  const origin = `${x + size / 2} ${y + size / 2}`;
  return `<rect x="${x}" y="${y}" width="${size}" height="${size}" rx="${radius}" fill="${fill}" transform="rotate(${rotation} ${origin})"/>`;
}

function triangle(x, y, size, fill, rotation = 0) {
  const half = size / 2;
  const points = `${x},${y + size} ${x + half},${y} ${x + size},${y + size}`;
  return `<polygon points="${points}" fill="${fill}" transform="rotate(${rotation} ${x + half} ${y + half})"/>`;
}

function svgShell(content, background) {
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" role="img">`,
    `<circle cx="64" cy="64" r="62" fill="${background}"/>`,
    `<circle cx="64" cy="64" r="61" fill="none" stroke="#0A0A0A" stroke-opacity=".08" stroke-width="2"/>`,
    `<g clip-path="url(#avatarClip)">${content}</g>`,
    `<defs><clipPath id="avatarClip"><circle cx="64" cy="64" r="57"/></clipPath></defs>`,
    `</svg>`,
  ].join("");
}

export function generateIdeaAvatarSvg(seed) {
  const random = mulberry32(hashSeed(`idea:${seed}`));
  const palette = pick(random, PALETTES);
  const background = palette[4];
  const shapes = [];
  const count = number(random, 5, 8);
  const requiredTypes = ["circle", "square", "triangle"];

  shapes.push(`<path d="M18 91 C42 ${number(random, 60, 88)}, 72 ${number(random, 94, 112)}, 112 52" fill="none" stroke="${palette[0]}" stroke-opacity=".16" stroke-width="2"/>`);

  for (let index = 0; index < count; index += 1) {
    const type = requiredTypes[index] ?? pick(random, requiredTypes);
    const size = number(random, index === 0 ? 28 : 12, index === 0 ? 48 : 31);
    const x = number(random, 16, 112 - size);
    const y = number(random, 16, 112 - size);
    const fill = palette[(index % 3) + 1];
    const rotation = number(random, -35, 35);
    if (type === "circle") shapes.push(circle(x + size / 2, y + size / 2, size, fill));
    if (type === "square") shapes.push(square(x, y, size, fill, rotation, number(random, 1, 6)));
    if (type === "triangle") shapes.push(triangle(x, y, size, fill, rotation));
  }

  shapes.push(circle(number(random, 30, 98), number(random, 28, 98), number(random, 5, 10), palette[0]));
  return svgShell(shapes.join(""), background);
}

export function generateAgentAvatarSvg(seed) {
  const random = mulberry32(hashSeed(`agent:${seed}`));
  const palette = pick(random, PALETTES);
  const background = palette[4];
  const ink = palette[0];
  const accent = palette[1];
  const signal = palette[2];
  const secondary = palette[3];
  const antennaX = number(random, 50, 78);
  const eyeType = pick(random, ["circle", "square", "triangle"]);
  const faceWidth = number(random, 66, 80);
  const faceX = (128 - faceWidth) / 2;
  const faceY = number(random, 43, 51);
  const faceHeight = number(random, 45, 55);
  const eyeSize = number(random, 9, 14);

  const eye = (x, y, fill) => {
    if (eyeType === "square") return square(x, y, eyeSize, fill, number(random, -12, 12), 2);
    if (eyeType === "triangle") return triangle(x, y, eyeSize, fill, 0);
    return circle(x + eyeSize / 2, y + eyeSize / 2, eyeSize, fill);
  };

  const content = [
    `<path d="M${antennaX} 43 L${antennaX} 25" stroke="${ink}" stroke-width="4" stroke-linecap="round"/>`,
    circle(antennaX, 20, number(random, 10, 16), signal, ink, 2),
    triangle(faceX - 11, faceY + 12, 18, secondary, -90),
    triangle(faceX + faceWidth - 7, faceY + 12, 18, secondary, 90),
    `<rect x="${faceX}" y="${faceY}" width="${faceWidth}" height="${faceHeight}" rx="${number(random, 8, 16)}" fill="${accent}" stroke="${ink}" stroke-width="4"/>`,
    `<path d="M${faceX + 12} ${faceY + faceHeight + 2} L${faceX + 7} 111 M${faceX + faceWidth - 12} ${faceY + faceHeight + 2} L${faceX + faceWidth - 7} 111" stroke="${ink}" stroke-width="4" stroke-linecap="round"/>`,
    eye(faceX + 15, faceY + 14, background),
    eye(faceX + faceWidth - 15 - eyeSize, faceY + 14, background),
    `<path d="M${faceX + 23} ${faceY + faceHeight - 14} Q64 ${faceY + faceHeight - number(random, 4, 9)} ${faceX + faceWidth - 23} ${faceY + faceHeight - 14}" fill="none" stroke="${ink}" stroke-width="3" stroke-linecap="round"/>`,
    circle(faceX + number(random, 10, 20), faceY + faceHeight - 9, number(random, 5, 9), signal),
  ];

  return svgShell(content.join(""), background);
}

export function generateEntityAvatarSvg(kind, seed) {
  if (kind === "idea") return generateIdeaAvatarSvg(seed);
  if (kind === "agent") return generateAgentAvatarSvg(seed);
  throw new Error(`Unsupported generated avatar kind: ${kind}`);
}

export function svgToDataUrl(svg) {
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

export function generateEntityAvatarDataUrl(kind, seed) {
  return svgToDataUrl(generateEntityAvatarSvg(kind, seed));
}

export function isGeneratedAvatarDataUrl(value) {
  return typeof value === "string" && value.startsWith("data:image/svg+xml");
}

export function isLegacyDefaultAvatarUrl(value) {
  return typeof value === "string" && /^https:\/\/api\.dicebear\.com\/9\.x\/(?:bottts|shapes)\//i.test(value);
}
