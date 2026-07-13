/* ===== fog.js — 雾气噪声纹理预生成（Step 2） ===== */

class FogTexture {
  constructor(w, h) {
    this.w = w;
    this.h = h;
    this.graphics = createGraphics(w, h);
    // 消除 Chrome 的 willReadFrequently 警告（fog 纹理只需初始化时读回一次）
    if (this.graphics.drawingContext && this.graphics.drawingContext.canvas) {
      this.graphics.drawingContext.canvas.willReadFrequently = true;
    }
    this.regenerate();
  }

  /* 使用 p5.js Perlin 噪声生成无缝感雾图 */
  regenerate() {
    const g = this.graphics;
    g.loadPixels();
    const d = g.pixelDensity();
    const totalW = this.w * d;
    const totalH = this.h * d;

    noiseDetail(4, 0.5);

    for (let y = 0; y < totalH; y++) {
      for (let x = 0; x < totalW; x++) {
        const nx = x * FOG_CONFIG.noiseScale;
        const ny = y * FOG_CONFIG.noiseScale;
        const n = noise(nx, ny); // 0~1
        const idx = (y * totalW + x) * 4;
        const v = Math.floor(n * 255);
        g.pixels[idx] = v;
        g.pixels[idx + 1] = v;
        g.pixels[idx + 2] = v;
        g.pixels[idx + 3] = 255;
      }
    }
    g.updatePixels();
  }

  /* 获取纹理（供 shader 使用） */
  getTexture() {
    return this.graphics;
  }

  onResize(w, h) {
    this.w = w;
    this.h = h;
    this.graphics.resizeCanvas(w, h);
    this.regenerate();
  }
}
