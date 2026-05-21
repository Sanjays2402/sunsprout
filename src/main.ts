const canvas = document.getElementById('game') as HTMLCanvasElement | null;
if (canvas) {
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#1a1426';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#f5e9d4';
    ctx.font = '20px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('🌱 sunsprout — loading…', canvas.width / 2, canvas.height / 2);
  }
}
export {};
