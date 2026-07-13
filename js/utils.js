/* ===== utils.js — 工具函数 ===== */

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function map(n, start1, stop1, start2, stop2, withinBounds) {
  const newval = (n - start1) / (stop1 - start1) * (stop2 - start2) + start2;
  if (!withinBounds) return newval;
  if (start2 < stop2) return clamp(newval, start2, stop2);
  return clamp(newval, stop2, start2);
}

/* 二维噪声（Simplex 简化版，用于雾气预生成） */
function noise2D(x, y) {
  return noise(x, y);
}

/* 心形 SDF：返回点到心形边界的有向距离 */
function heartSDF(px, py, cx, cy, size) {
  const x = (px - cx) / size;
  const y = (cy - py) / size; // 翻转 Y，屏幕坐标向下
  const a = x * x + y * y - 1;
  return a * a * a - x * x * y * y * y;
}

/* 判断点是否在心脏内 */
function insideHeart(px, py, cx, cy, size) {
  return heartSDF(px, py, cx, cy, size) <= 0;
}

/* 生成心脏内随机点（拒绝采样） */
function randomHeartPoint(cx, cy, size) {
  let x, y;
  let guard = 0;
  do {
    x = random(cx - size * 1.2, cx + size * 1.2);
    y = random(cy - size * 1.2, cy + size);
    guard++;
  } while (!insideHeart(x, y, cx, cy, size) && guard < 200);
  return createVector(x, y);
}

/* 文件转 p5.Image */
function loadImageFromFile(file, callback) {
  const url = URL.createObjectURL(file);
  loadImage(url, (img) => {
    URL.revokeObjectURL(url);
    callback(img);
  }, () => {
    URL.revokeObjectURL(url);
    console.error('[Utils] Failed to load image');
  });
}

/* 文件转 p5.Video（ muted + loop + autoplay ） */
function loadVideoFromFile(file, callback) {
  const url = URL.createObjectURL(file);
  const vid = createVideo(url, () => {
    vid.hide();
    vid.volume(0);
    vid.loop();
    callback(vid);
  });
}
