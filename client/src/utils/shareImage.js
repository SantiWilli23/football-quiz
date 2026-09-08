import { CHALK } from "../theme.js";

const W = 1080;
const H = 1080;

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// Dibuja la tarjeta de resultado del día en un canvas nativo (sin librerías
// externas) y devuelve un Blob PNG listo para compartir o descargar.
export async function generateResultCard({ username, date, trivia, streak }) {
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");

  // Fondo
  const grad = ctx.createLinearGradient(0, 0, W, H);
  grad.addColorStop(0, CHALK.board);
  grad.addColorStop(1, "#1a1e26");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  // Marca
  ctx.fillStyle = CHALK.blue;
  ctx.font = "600 34px system-ui, sans-serif";
  ctx.fillText("⚽ Futotal", 64, 100);

  ctx.fillStyle = CHALK.dim;
  ctx.font = "400 26px system-ui, sans-serif";
  ctx.fillText(date, 64, 138);

  // Nombre
  ctx.fillStyle = CHALK.white;
  ctx.font = "700 56px system-ui, sans-serif";
  ctx.fillText(username, 64, 230);

  // Marcador grande
  const correct = (trivia || []).filter((i) => i.answered && i.result.is_correct).length;
  const total = (trivia || []).length;
  ctx.fillStyle = CHALK.blue;
  ctx.font = "800 220px system-ui, sans-serif";
  ctx.textBaseline = "middle";
  ctx.fillText(`${correct}/${total}`, 64, 460);
  ctx.textBaseline = "alphabetic";

  ctx.fillStyle = CHALK.dim;
  ctx.font = "500 30px system-ui, sans-serif";
  ctx.fillText("preguntas correctas hoy", 64, 610);

  // Marcas por pregunta (cuadrados de color, estilo Wordle)
  const marks = (trivia || []).map((i) => (i.answered ? (i.result.is_correct ? CHALK.green : CHALK.red) : CHALK.line));
  const boxSize = 64;
  const gap = 18;
  let mx = 64;
  const my = 670;
  marks.forEach((color) => {
    ctx.fillStyle = color;
    roundRect(ctx, mx, my, boxSize, boxSize, 14);
    ctx.fill();
    mx += boxSize + gap;
  });

  // Racha
  if (streak != null) {
    ctx.fillStyle = CHALK.yellow;
    roundRect(ctx, 64, 800, 480, 120, 20);
    ctx.globalAlpha = 0.14;
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.strokeStyle = CHALK.yellow;
    ctx.lineWidth = 2;
    roundRect(ctx, 64, 800, 480, 120, 20);
    ctx.stroke();

    ctx.fillStyle = CHALK.yellow;
    ctx.font = "700 48px system-ui, sans-serif";
    ctx.fillText(`🔥 ${streak} días`, 96, 872);
    ctx.fillStyle = CHALK.dim;
    ctx.font = "400 24px system-ui, sans-serif";
    ctx.fillText("racha actual", 96, 905);
  }

  // Pie
  ctx.fillStyle = CHALK.faint;
  ctx.font = "400 28px system-ui, sans-serif";
  ctx.fillText(window.location.origin.replace(/^https?:\/\//, ""), 64, 1000);

  return new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
}

export async function shareOrDownloadCard(blob, filename = "futotal.png") {
  const file = new File([blob], filename, { type: "image/png" });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file] });
      return "shared";
    } catch {
      // cancelado por el usuario, cae a descarga
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  return "downloaded";
}
