export function coverStyle(cover) {
  if (!cover) return { background: 'var(--grad-1)' };
  if (cover.image) {
    return {
      backgroundImage: `url('${cover.image}')`,
      backgroundSize: 'cover',
      backgroundPosition: cover.position || 'center',
    };
  }
  return { background: cover.gradient || 'var(--grad-1)' };
}
