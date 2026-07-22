export function buildToc(blocks) {
  const toc = [];
  let lastH2Id = null;
  (blocks || []).forEach((block) => {
    if (block.type !== 'heading') return;
    if (block.level === 2) {
      lastH2Id = block.id;
      toc.push({ label: block.text, href: `#${block.id}`, indent: 0 });
    } else if (block.level === 3 && lastH2Id) {
      toc.push({ label: block.text, href: `#${lastH2Id}`, indent: 12 });
    }
  });
  return toc;
}
