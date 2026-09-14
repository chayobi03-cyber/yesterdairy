// Real licensed illustrations (Adobe Stock, cropped to individual characters
// and background-removed) instead of hand-coded SVG shapes -- the SVG
// version kept looking like separately-outlined parts glued together no
// matter how much it was refined. Which image a given item renders as is a
// deterministic hash of the item's own id, so a specific achievement always
// looks like the same creature.

export const TREE_CREATURES = ["/creatures/fox.png", "/creatures/owl.png", "/creatures/rabbit.png", "/creatures/frog.png"];

export const CONSTELLATION_CREATURES = ["/creatures/bunny.png", "/creatures/bear.png"];

export const PLANET_CREATURES = ["/creatures/bunny.png", "/creatures/bear.png", "/creatures/sun.png"];

export function pickCreature(list: string[], id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return list[h % list.length];
}
