/* ===== sketch.js — p5.js WEBGL 主循环（Step 1-3） ===== */

let rainSystem;
let fogTex;
let myShader;
let bgImage = null;    // p5.Image
let bgVideo = null;    // p5.MediaElement
let textOverlay;
let controlPanel;

let exportRequested = false;
let exportGraphics = null;
let defaultBg = null;   // 默认程序生成背景

let bgMode = 1; // 0=stretch, 1=cover
let parallaxX = 0, parallaxY = 0;
let targetParallaxX = 0, targetParallaxY = 0;
let zoomLevel = 1.0;

function setup() {
  createCanvas(windowWidth, windowHeight, WEBGL);
  setAttributes('antialias', true);

  // 鼠标视差监听
  document.addEventListener('mousemove', (e) => {
    targetParallaxX = (e.clientX / window.innerWidth - 0.5) * 0.025;
    targetParallaxY = (e.clientY / window.innerHeight - 0.5) * 0.025;
  });
  document.addEventListener('touchmove', (e) => {
    if (e.touches.length > 0) {
      targetParallaxX = (e.touches[0].clientX / window.innerWidth - 0.5) * 0.02;
      targetParallaxY = (e.touches[0].clientY / window.innerHeight - 0.5) * 0.02;
    }
  }, { passive: true });

  // 初始化 shader
  myShader = createShader(vertShader, fragShader);

  // 生成默认夜景背景（确保未上传时也能看到折射/雾气效果）
  defaultBg = createDefaultBackground();

  // 初始化子系统
  applyRainIntensity(RAIN_CONFIG.rainIntensity);
  rainSystem = new RainSystem();
  fogTex = new FogTexture(width, height);
  textOverlay = new TextOverlay();
  textOverlay.createDefaults();

  // 初始化控制面板
  controlPanel = new ControlPanel((key, val) => {
    handleControlChange(key, val);
  });

  // 上传监听
  document.getElementById('uploadInput').addEventListener('change', (e) => {
    handleUpload(e.target.files[0]);
    e.target.value = '';
  });

  // 提示条
  updateHint('双击文字编辑 · 拖拽移动 · 右下角调节参数 · [S] 导出');
}

function draw() {
  // 1. 更新雨滴物理
  rainSystem.update();

  // 2. 绘制层：隔帧更新以减轻 CPU 绘制负担（shader 仍每帧运行保持流畅）
  if (frameCount % 2 === 0) {
    rainSystem.drawLayers();
  }

  // 3. 获取当前背景纹理：用户上传 > 视频 > 默认夜景
  let bgTex = defaultBg;
  if (bgImage) bgTex = bgImage;
  if (bgVideo && bgVideo.elt.readyState >= 2) bgTex = bgVideo;

  // 3. Shader 绘制全屏平面
  shader(myShader);

  // 视差缓动
  parallaxX += (targetParallaxX - parallaxX) * 0.06;
  parallaxY += (targetParallaxY - parallaxY) * 0.06;

  myShader.setUniform('uResolution', [width, height]);
  myShader.setUniform('uRefraction', RAIN_CONFIG.refraction);
  myShader.setUniform('uFogIntensity', FOG_CONFIG.intensity);
  myShader.setUniform('uTime', millis());
  myShader.setUniform('uBlurMix', FOG_CONFIG.blurMix);
  myShader.setUniform('uBackgroundMode', bgMode);
  myShader.setUniform('uParallax', [parallaxX, -parallaxY]); // Y 轴翻转以匹配屏幕坐标
  myShader.setUniform('uProcDensity', RAIN_CONFIG.staticDensity / 60.0);
  myShader.setUniform('uZoom', zoomLevel);
  myShader.setUniform('uLightning', LIGHTNING_CONFIG.enabled ? 1.0 : 0.0);
  myShader.setUniform('uRainIntensity', RAIN_CONFIG.rainIntensity / 100.0);

  // 纹理绑定：背景
  myShader.setUniform('uBackground', bgTex);
  // 背景纹理分辨率（cover 适配用）
  let texRes = [width, height];
  if (bgImage) {
    texRes = [bgImage.width, bgImage.height];
  } else if (bgVideo && bgVideo.elt.readyState >= 2) {
    const vw = bgVideo.elt.videoWidth || bgVideo.width;
    const vh = bgVideo.elt.videoHeight || bgVideo.height;
    texRes = [vw || width, vh || height];
  } else if (defaultBg) {
    texRes = [defaultBg.width, defaultBg.height];
  }
  myShader.setUniform('uTexResolution', texRes);

  // 纹理绑定：雨滴法线层（现在纯净，不含 tiny 污染）
  myShader.setUniform('uDropLayer', rainSystem.normalLayer);

  // 纹理绑定：雾气噪声
  myShader.setUniform('uFogNoise', fogTex.getTexture());

  // 画全屏 plane
  ortho(-width / 2, width / 2, -height / 2, height / 2, 0, 1000);
  noStroke();
  plane(width, height);

  // 恢复默认 shader
  resetShader();

  // 4. 叠加 highlight 层（白色针尖点 + medium/large 微高光，不参与折射）
  imageMode(CENTER);
  tint(255, 255);
  image(rainSystem.highlightLayer, 0, 0, width * zoomLevel, height * zoomLevel);
  noTint();

  // 5. 导出逻辑
  if (exportRequested) {
    doExport();
    exportRequested = false;
  }

  // 6. 性能监控与自适应降级
  monitorPerformance();
}

/* ===== 控制面板事件处理 ===== */
function handleControlChange(key, val) {
  switch (key) {
    case 'density':
      RAIN_CONFIG.staticDensity = val;
      rainSystem.initStaticDrops(val); // 按新密度重建静态水珠
      rainSystem.trails = [];
      break;
    case 'rain':
      applyRainIntensity(val);
      rainSystem.drops = []; // 立即清空，用新参数重新生成
      rainSystem.initStreaks();
      rainSystem.initMainStreaks();
      break;
    case 'size':
      RAIN_CONFIG.maxRadius = val;
      rainSystem.drops = []; // 立即清空，用新尺寸重新生成
      break;
    case 'refract':
      RAIN_CONFIG.refraction = val / 1000;
      break;
    case 'fog':
      FOG_CONFIG.intensity = val / 100;
      break;
    case 'bgMode':
      bgMode = val ? 1 : 0;
      break;
    case 'zoom':
      zoomLevel = val / 100;
      break;
    case 'lightning':
      LIGHTNING_CONFIG.enabled = !!val;
      break;
    case 'addText':
      textOverlay.addBox('subtitle', '新文本', 18, 300, 0.1, 0.3 + random(0, 0.3));
      break;
    case 'export':
      exportRequested = true;
      break;
  }
}

/* 雨势大小映射：0~100 对应毛毛雨到暴雨 */
function applyRainIntensity(val) {
  const v = constrain(val, 0, 100);
  RAIN_CONFIG.rainIntensity = v;
  // 动态雨滴上限：0 ~ 120（mobile 0~60），大雨时更密集
  currentMaxDrops = isMobile
    ? Math.floor(map(v, 0, 100, 0, 60))
    : Math.floor(map(v, 0, 100, 0, 120));
  RAIN_CONFIG.maxDrops = currentMaxDrops;
  // 速度：0.2~3.0 / 0.8~8.0，大雨下落更快
  RAIN_CONFIG.minSpeed = map(v, 0, 100, 0.2, 3.0);
  RAIN_CONFIG.maxSpeed = map(v, 0, 100, 0.8, 8.0);
  // 重力：0.004 ~ 0.050
  RAIN_CONFIG.gravity = map(v, 0, 100, 0.004, 0.050);
  // 生成速率：0 ~ 10
  RAIN_CONFIG.spawnRate = Math.floor(map(v, 0, 100, 0, 10));
}

/* ===== 文件上传处理 ===== */
function handleUpload(file) {
  if (!file) return;
  const type = file.type;

  // 释放旧视频资源，防止内存泄漏和后台播放
  if (bgVideo) {
    try {
      bgVideo.stop();
      bgVideo.remove();
    } catch (e) {
      // ignore
    }
    bgVideo = null;
  }

  if (type.startsWith('image/')) {
    loadImageFromFile(file, (img) => {
      bgImage = img;
      bgVideo = null;
      console.log('[Upload] Image loaded:', img.width, 'x', img.height);
    });
  } else if (type.startsWith('video/')) {
    loadVideoFromFile(file, (vid) => {
      bgVideo = vid;
      bgImage = null;
      console.log('[Upload] Video loaded');
    });
  } else {
    alert('请上传图片或视频文件');
  }
}

/* ===== 导出：合成 Canvas + 文字层 ===== */
function doExport() {
  // 创建离屏 graphics
  const g = createGraphics(width, height);
  g.pixelDensity(1);

  // 复用当前 shader 画面
  // 由于 p5 WEBGL 的 shader 不好直接渲染到 2D graphics，
  // 这里采用：保存当前 canvas 为 dataURL，再绘制到 graphics
  const canvasData = canvas.toDataURL('image/png');
  const tempImg = createImage(width, height);

  // 异步加载再保存
  loadImage(canvasData, (loaded) => {
    g.image(loaded, 0, 0, width, height);

    // 叠加文字层（读取 DOM 位置在 graphics 上重绘）
    textOverlay.drawToGraphics(g);

    // 下载
    g.save(`rainy-window-${Date.now()}.png`);
    g.remove();
    updateHint('已导出！');
    setTimeout(() => updateHint('双击文字编辑 · 拖拽移动 · 右下角调节参数 · [S] 导出'), 2000);
  });
}

/* ===== 键盘快捷键 ===== */
function keyPressed() {
  if (key === 's' || key === 'S') {
    exportRequested = true;
  }
}

/* ===== 窗口缩放 ===== */
function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  rainSystem.onResize();
  fogTex.onResize(width, height);
  // 重建默认背景以匹配新尺寸
  if (defaultBg) defaultBg.remove();
  defaultBg = createDefaultBackground();
}

/* ===== 生成默认夜景背景（城市街景：建筑+灯光+树木） ===== */
function createDefaultBackground() {
  const g = createGraphics(width, height);
  g.background(5, 7, 14);

  // 1. 远景微光散点（城市远处灯光）
  for (let i = 0; i < 150; i++) {
    g.noStroke();
    g.fill(180, 200, 255, random(4, 15));
    g.circle(random(width), random(height * 0.7), random(2, 6));
  }

  // 2. 建筑剪影（底部 30%~70% 区域）
  let bx = 0;
  while (bx < width) {
    const bw = random(40, 120);
    const bh = random(height * 0.25, height * 0.55);
    const by = height - bh;

    // 建筑主体（暗色但可见）
    g.fill(random(22, 42), random(25, 48), random(40, 65));
    g.rect(bx, by, bw, bh);

    // 窗户灯光（小矩形，随机亮灭）
    for (let wy = by + 10; wy < height - 10; wy += random(12, 20)) {
      for (let wx = bx + 6; wx < bx + bw - 6; wx += random(10, 16)) {
        if (random() < 0.35) {
          const winCol = random() < 0.7
            ? g.color(255, 220, 120, random(50, 110))   // 暖黄灯光
            : g.color(200, 230, 255, random(40, 85));  // 冷白灯光
          g.fill(winCol);
          g.rect(wx, wy, random(3, 6), random(4, 8));
        }
      }
    }

    // 建筑顶部偶尔有天线/装饰
    if (random() < 0.3) {
      g.stroke(30, 35, 50);
      g.strokeWeight(1);
      g.line(bx + bw/2, by, bx + bw/2, by - random(10, 30));
    }

    bx += bw + random(-5, 2); // 偶尔建筑重叠
  }

  // 3. 树木轮廓（建筑前方，底部有不规则圆形）
  for (let i = 0; i < 12; i++) {
    g.noStroke();
    g.fill(random(15, 30), random(22, 42), random(22, 42));
    const tx = random(width);
    const tr = random(15, 40);
    g.circle(tx, height - tr * 0.3, tr * 2);
  }

  // 4. 路灯垂直光柱（几根）
  for (let i = 0; i < 4; i++) {
    const lx = random(width);
    g.noStroke();
    const grad = g.drawingContext.createLinearGradient(lx, height * 0.3, lx, height);
    grad.addColorStop(0, 'rgba(255, 220, 100, 0)');
    grad.addColorStop(0.5, 'rgba(255, 220, 100, 0.08)');
    grad.addColorStop(1, 'rgba(255, 220, 100, 0.15)');
    g.drawingContext.fillStyle = grad;
    g.drawingContext.fillRect(lx - 8, height * 0.3, 16, height * 0.7);
  }

  // 5. 水平光带（街道反光）
  for (let i = 0; i < 5; i++) {
    g.noStroke();
    g.fill(180, 210, 255, random(5, 12));
    g.rect(0, random(height * 0.7, height), width, random(1, 3));
  }

  // 6. 中景光斑（路灯/车灯，小而散）
  for (let i = 0; i < 40; i++) {
    g.noStroke();
    const alpha = random(15, 40);
    if (random() < 0.5) {
      g.fill(255, 190, 70, alpha);
    } else {
      g.fill(120, 190, 255, alpha);
    }
    g.circle(random(width), random(height), random(10, 35));
  }

  // 7. 暗角 + 整体蓝紫色调
  const ctx = g.drawingContext;
  const radGrad = ctx.createRadialGradient(width/2, height/2, height*0.2, width/2, height/2, height*0.95);
  radGrad.addColorStop(0, 'rgba(0,0,0,0)');
  radGrad.addColorStop(1, 'rgba(0,0,0,0.6)');
  ctx.fillStyle = radGrad;
  ctx.fillRect(0, 0, width, height);

  return g;
}

/* ===== 性能监控 ===== */
function monitorPerformance() {
  fpsHistory.push(frameRate());
  if (fpsHistory.length > 120) fpsHistory.shift();

  if (frameCount > 120 && frameCount % 60 === 0) {
    const avg = fpsHistory.reduce((a, b) => a + b, 0) / fpsHistory.length;

    // 帧率过低时减少雨滴上限
    if (avg < 30 && currentMaxDrops > 15) {
      currentMaxDrops = Math.max(15, Math.floor(currentMaxDrops * 0.8));
      console.warn(`[Performance] FPS ${avg.toFixed(1)} too low. Reduced max drops to ${currentMaxDrops}`);
    }
  }
}

/* ===== 底部提示更新 ===== */
function updateHint(str) {
  document.getElementById('hintBar').textContent = str;
}
