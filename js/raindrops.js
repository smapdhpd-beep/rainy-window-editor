/* ===== raindrops.js — 雨滴物理与法线贴图层（Step 1） ===== */

class Drop {
  constructor(x, y, r) {
    this.pos = createVector(x, y);
    this.r = r || random(RAIN_CONFIG.minRadius, RAIN_CONFIG.maxRadius);
    this.baseSpeed = map(this.r, RAIN_CONFIG.minRadius, RAIN_CONFIG.maxRadius,
                         RAIN_CONFIG.minSpeed, RAIN_CONFIG.maxSpeed);
    this.speed = this.baseSpeed * random(0.6, 1.4);
    this.active = true;
    // 多层随机相位，避免运动雷同
    this.phase1 = random(TWO_PI);
    this.phase2 = random(TWO_PI);
    this.phase3 = random(TWO_PI);
    this.noiseOff = random(1000);
    // 随机计时器：偶尔突变加速/减速/停顿
    this.burstTimer = floor(random(20, 80));
    this.state = 'normal'; // normal | burst | pause
  }

  update() {
    if (!this.active) return;

    // 随机状态机：让每滴雨的行为不可预测
    this.burstTimer--;
    if (this.burstTimer <= 0) {
      const roll = random();
      if (roll < 0.25) {
        this.state = 'burst';
        this.speed += random(0.8, 2.5);
        this.burstTimer = floor(random(10, 30));
      } else if (roll < 0.40) {
        this.state = 'pause';
        this.burstTimer = floor(random(15, 40));
      } else {
        this.state = 'normal';
        this.burstTimer = floor(random(40, 120));
      }
    }

    if (this.state === 'pause') {
      // 停顿：几乎不动，只有极微晃动
      this.pos.y += this.speed * 0.05;
      this.pos.x += (noise(this.pos.y * 0.02 + this.noiseOff) - 0.5) * 0.4;
    } else if (this.state === 'burst') {
      // 突进：快速下滑，伴随横向甩动
      this.speed += RAIN_CONFIG.gravity * 2.0;
      this.pos.y += this.speed;
      this.pos.x += sin(this.pos.y * 0.04 + this.phase1) * 0.6
                  + (noise(this.pos.y * 0.03 + this.noiseOff) - 0.5) * 1.2;
    } else {
      // 正常：缓慢下滑 + 多层漂移
      this.speed += RAIN_CONFIG.gravity * random(0.5, 1.5);
      this.speed = constrain(this.speed, 0.2, this.baseSpeed * 2.2);
      this.pos.y += this.speed;
      // 横向：低频正弦 + 中频噪声 + 高频随机
      this.pos.x += sin(this.pos.y * 0.012 + this.phase1) * 0.25
                  + sin(this.pos.y * 0.035 + this.phase2) * 0.12
                  + (noise(this.pos.y * 0.02 + this.noiseOff, frameCount * 0.01) - 0.5) * 0.5
                  + random(-0.2, 0.2);
    }

    if (this.pos.y > height + this.r * 5 || this.pos.x < -this.r * 3 || this.pos.x > width + this.r * 3) {
      this.active = false;
    }
  }
}

class RainSystem {
  constructor() {
    this.drops = [];
    this.staticDrops = [];
    this.streaks = [];
    this.trails = [];
    this.waterFilms = []; // 大片水膜斑块
    this.normalLayer = createGraphics(width, height);
    this.normalLayer.pixelDensity(1);
    this.highlightLayer = createGraphics(width, height); // tiny 白点单独一层
    this.highlightLayer.pixelDensity(1);

    this.spriteSize = 128; // 提高法线贴图精度
    this.dropSprite = this.createDropSprite(this.spriteSize);
    this.initStaticDrops(RAIN_CONFIG.staticDensity);
    this.initStreaks();
    this.initMainStreaks();
    this.initWaterFilms();
  }

  /* 生成法线 sprite：主体微凸透镜 + 边缘卫星 bump（折射必须可见）
   * 主体使用混合函数：sqrt(1-d^2)*0.8 + (1-d^2)^2*0.2
   * 确保中心法线足够强（缩放后仍有折射），边缘因卫星 bump 而不规则
   */
  createDropSprite(size) {
    const g = createGraphics(size, size);
    g.pixelDensity(1);
    g.loadPixels();

    for (let i = 0; i < g.pixels.length; i += 4) {
      g.pixels[i] = 128;
      g.pixels[i + 1] = 128;
      g.pixels[i + 2] = 0;
      g.pixels[i + 3] = 0;
    }

    const bumps = [];
    // 主体：恢复足够边缘强度，确保水珠可见但不过于立体
    bumps.push({
      x: size / 2 + random(-3, 3),
      y: size / 2 + random(-3, 3),
      r: size * random(0.36, 0.44),
      strength: random(0.85, 1.0)
    });
    // 2-3 个卫星 bump（边缘不规则）
    const extra = floor(random(2, 4));
    for (let i = 0; i < extra; i++) {
      const angle = random(TWO_PI);
      const dist = random(0.30, 0.60) * size * random(0.36, 0.44);
      bumps.push({
        x: size / 2 + Math.cos(angle) * dist,
        y: size / 2 + Math.sin(angle) * dist,
        r: size * random(0.12, 0.22),
        strength: random(0.40, 0.65)
      });
    }
    // 1-2 个微纹理 bump
    const micro = floor(random(1, 3));
    for (let i = 0; i < micro; i++) {
      bumps.push({
        x: size / 2 + random(-10, 10),
        y: size / 2 + random(-10, 10),
        r: size * random(0.07, 0.14),
        strength: random(0.25, 0.45)
      });
    }

    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        let accumNx = 0, accumNy = 0, accumH = 0, accumW = 0;

        for (let b of bumps) {
          const dx = (x - b.x) / b.r;
          const dy = (y - b.y) / b.r;
          const distSq = dx * dx + dy * dy;
          if (distSq < 1.0) {
            const d = Math.sqrt(distSq);
            const falloff1 = Math.sqrt(Math.max(0.0, 1.0 - distSq));
            const falloff2 = (1.0 - distSq) * (1.0 - distSq);
            // 平衡扁平与可见：边缘有足够折射，但不过于立体
            const h = (falloff1 * 0.60 + falloff2 * 0.40) * b.strength;
            accumH += h;
            accumNx += dx * h;
            accumNy += dy * h;
            accumW += h;
          }
        }

        if (accumW > 0.001) {
          const nx = accumNx / accumW;
          const ny = accumNy / accumW;
          const h = Math.min(accumH, 1.0);
          const idx = (y * size + x) * 4;
          g.pixels[idx] = (nx * 0.5 + 0.5) * 255;
          g.pixels[idx + 1] = (ny * 0.5 + 0.5) * 255;
          g.pixels[idx + 2] = h * 255;
          g.pixels[idx + 3] = 255;
        }
      }
    }
    g.updatePixels();
    return g;
  }

  /* 静态水珠：density 控制总体密度（0~60），确保水膜感 */
  initStaticDrops(density = 30) {
    this.staticDrops = [];
    const d = constrain(density, 0, 60);

    // 更多聚类中心（模拟大片水膜），大小不一差异大
    const clusters = [];
    const clusterCount = floor(random(18, 28));
    for (let i = 0; i < clusterCount; i++) {
      clusters.push({
        x: random(width * 0.02, width * 0.98),
        y: random(height * 0.02, height * 0.98),
        radius: random(60, 400)
      });
    }

    const inCluster = () => {
      const c = random(clusters);
      const angle = random(TWO_PI);
      const dist = sqrt(random(0, 1)) * c.radius;
      return {
        x: constrain(c.x + cos(angle) * dist, 0, width),
        y: constrain(c.y + sin(angle) * dist, 0, height)
      };
    };

    // 第1层：极小雨珠（数量减少，避免噪点感；部分在 normalLayer 画微 sprite）
    const tinyCount = 80 + d * 3;
    for (let i = 0; i < tinyCount; i++) {
      const pos = random() < 0.85 ? inCluster() : { x: random(width), y: random(height) };
      this.staticDrops.push({
        x: pos.x, y: pos.y,
        r: random(0.4, 2.0),
        type: 'tiny',
        alpha: random(12, 30),
        vx: 0, vy: 0,
        jitterPhase: random(TWO_PI),
      });
    }

    // 第2层：小水珠（法线折射，默认静止，数量适中）
    const smallCount = 80 + d * 4;
    for (let i = 0; i < smallCount; i++) {
      const pos = random() < 0.85 ? inCluster() : { x: random(width), y: random(height) };
      this.staticDrops.push({
        x: pos.x, y: pos.y,
        r: random(1.8, 5.0),
        type: 'small',
        alpha: random(110, 175),
        rot: random(TWO_PI),
        aspect: random(0.5, 1.6),
        vx: 0, vy: 0,
        moving: false,
        noiseOff: random(1000),
      });
    }

    // 第3层：中等水珠（默认静止，更易被激活）
    const mediumCount = 20 + d * 3;
    for (let i = 0; i < mediumCount; i++) {
      const pos = random() < 0.80 ? inCluster() : { x: random(width), y: random(height) };
      this.staticDrops.push({
        x: pos.x, y: pos.y,
        r: random(5.0, 10.0),
        type: 'medium',
        alpha: random(160, 220),
        rot: random(TWO_PI),
        aspect: random(0.5, 1.7),
        vx: 0, vy: 0,
        moving: false,
        noiseOff: random(1000),
      });
    }

    // 第4层：大水珠（默认静止，最容易被激活）
    const largeCount = 6 + floor(d * 0.7);
    for (let i = 0; i < largeCount; i++) {
      this.staticDrops.push({
        x: random(width), y: random(height),
        r: random(10.0, 16.0),
        type: 'large',
        alpha: random(150, 210),
        rot: random(TWO_PI),
        aspect: random(0.6, 1.6),
        vx: 0, vy: 0,
        moving: false,
        noiseOff: random(1000),
      });
    }
  }

  /* 水膜斑块：大片极淡的湿润区域，让玻璃有"淋了雨"的膜状感 */
  initWaterFilms() {
    this.waterFilms = [];
    const count = isMobile ? 4 : 10;
    for (let i = 0; i < count; i++) {
      const w = random(120, 400);
      const h = random(100, 320);
      this.waterFilms.push({
        x: random(width),
        y: random(height),
        w, h,
        alpha: random(6, 16),
        b: random(30, 55),
        blobs: []
      });
      // 每个水膜由 2~4 个重叠椭圆组成，形状不规则
      const blobCount = floor(random(2, 5));
      for (let j = 0; j < blobCount; j++) {
        this.waterFilms[i].blobs.push({
          xOff: random(-w * 0.35, w * 0.35),
          yOff: random(-h * 0.35, h * 0.35),
          w: w * random(0.5, 1.1),
          h: h * random(0.5, 1.1),
        });
      }
    }
  }

  /* 水痕 streaks：数量随雨势变化，动态流动 */
  initStreaks() {
    this.streaks = [];
    const intensity = RAIN_CONFIG.rainIntensity || 25;
    const count = isMobile
      ? floor(map(intensity, 0, 100, 6, 24))
      : floor(map(intensity, 0, 100, 10, 35));
    for (let i = 0; i < count; i++) {
      const baseX = random(width * 0.05, width * 0.95);
      this.streaks.push({
        baseX: baseX,
        speed: random(0.03, 0.22),
        phase: random(TWO_PI),
        yOffset: random(height),
        segments: []
      });
      const segCount = floor(random(8, 16));
      for (let j = 0; j < segCount; j++) {
        this.streaks[i].segments.push({
          relY: (j / segCount) * height,
          xOff: random(-30, 30),
          w: random(1.5, 4.5),
          alpha: random(12, 32)
        });
      }
    }
  }

  /* 主干水痕：数量随雨势变化，粗大蜿蜒，形成雨水冲刷通道 */
  initMainStreaks() {
    this.mainStreaks = [];
    const intensity = RAIN_CONFIG.rainIntensity || 25;
    const count = isMobile
      ? floor(map(intensity, 0, 100, 1, 5))
      : floor(map(intensity, 0, 100, 2, 8));
    for (let i = 0; i < count; i++) {
      const length = random(height * 0.45, height * 0.95);
      const segCount = floor(random(16, 28));
      const segments = [];
      for (let j = 0; j < segCount; j++) {
        segments.push({
          relY: (j / segCount) * length,
          xOff: random(-35, 35),
          w: random(0.8, 1.4)
        });
      }
      this.mainStreaks.push({
        baseX: random(width * 0.15, width * 0.85),
        speed: random(0.04, 0.14),
        phase: random(TWO_PI),
        width: random(3.0, 6.5),
        length: length,
        headY: random(-length * 0.3, height * 0.3),
        alphaHead: random(38, 70),
        alphaTail: random(3, 10),
        segments: segments
      });
    }
  }

  spawn() {
    if (this.drops.length >= currentMaxDrops) return;
    const x = random(width);
    const y = random() < 0.3 ? random(-10, height * 0.4) : random(-120, -20);
    const r = random(RAIN_CONFIG.minRadius, RAIN_CONFIG.maxRadius);

    // 落点融合：如果雨滴落在 static drop 附近，直接融合进去而不是生成独立个体
    for (let s of this.staticDrops) {
      if (s.type === 'tiny') continue;
      const dx = x - s.x;
      const dy = y - s.y;
      const threshold = (r + s.r) * 0.45;
      if (dx * dx + dy * dy < threshold * threshold) {
        // 融合：static drop 吸收雨滴，体积微增（大滴收益递减），获得初速度
        const newArea = s.r * s.r + r * r * 0.30;
        s.r = Math.min(Math.sqrt(newArea), 10);
        s.x = (s.x * 2 + x) / 3; // 轻微偏移向落点
        s.y = (s.y * 2 + y) / 3;
        if (!s.moving) {
          s.moving = true;
          s.vy = random(0.2, 1.0);
          s.vx = random(-0.2, 0.2);
        } else {
          s.vy += random(0.05, 0.3);
        }
        return; // 不生成独立雨滴
      }
    }

    this.drops.push(new Drop(x, y, r));
  }

  /* 静态水珠物理：绝大多数静止，偶尔被随机激活后滑落 */
  updateStaticDrops() {
    const newDrops = [];

    for (let s of this.staticDrops) {
      if (s.type === 'tiny') {
        s.x += sin(frameCount * 0.05 + s.jitterPhase) * 0.03;
        s.y += cos(frameCount * 0.03 + s.jitterPhase) * 0.03;
        newDrops.push(s);
        continue;
      }

      // 静止水珠：有概率被激活（开始滑动）
      if (!s.moving) {
        // 大水滴强制滑落：太重了挂不住
        if (s.r > 7) {
          s.moving = true;
          s.vy = random(0.3, 0.9);
          s.vx = random(-0.2, 0.2);
          newDrops.push(s);
          continue;
        }

        // 大水滴缓慢蒸发（防止无限积累成果冻）
        if (s.r > 5 && random() < 0.003) {
          s.r *= 0.97;
        }

        // 激活概率极低：大滴更容易滑落，但总体非常安静
        const baseProb = map(s.r, 2, 10, 0.00003, 0.00025);
        const slipField = noise(s.x * 0.003, s.y * 0.003 + frameCount * 0.001);
        const activateProb = baseProb * (0.3 + slipField * 1.4);

        if (random() < activateProb) {
          s.moving = true;
          // 激活时赋予较低初速度，大多数只会滑一小段就停住
          s.vy = random(0.05, 0.9);
          s.vx = random(-0.3, 0.3);
        }
        newDrops.push(s);
        continue;
      }

      // ========== 运动中的水珠 ==========
      // 极弱重力 + 强摩擦 = 容易停住
      s.vy += map(s.r, 2, 16, 0.0003, 0.002);
      const friction = map(s.r, 2, 16, 0.90, 0.82);
      s.vy *= friction;
      s.vx *= 0.90;

      // 极微横向噪声漂移
      s.vx += (noise(s.x * 0.01, s.y * 0.01 + s.noiseOff) - 0.5) * 0.04;

      // 更新位置
      s.x += s.vx;
      s.y += s.vy;

      // 边界约束
      if (s.x < 0 || s.x > width) {
        s.vx *= -0.6;
        s.x = constrain(s.x, 0, width);
      }

      // 速度降到很低时重新挂住（静止）—— 大多数激活的水珠只会滑一小段
      if (s.vy < 0.10 && random() < 0.06) {
        s.moving = false;
        s.vy = 0;
        s.vx = 0;
      }

      // 到达底部：消失或转化为动态雨滴
      if (s.y > height + s.r * 2) {
        if ((s.type === 'medium' || s.type === 'large') && random() < 0.35) {
          const d = new Drop(s.x, height + s.r, s.r * 0.6);
          d.speed = s.vy * 0.6 + random(0.4, 1.2);
          d.state = 'burst';
          this.drops.push(d);
        }
        // 重生到顶部（静止状态，尺寸重置防止无限积累）
        s.y = random(-25, -5);
        s.x = random(width);
        s.moving = false;
        s.vy = 0;
        s.vx = 0;
        s.r = constrain(s.r * random(0.35, 0.6), 2, 6);
        s.rot = random(TWO_PI);
      }

      newDrops.push(s);
    }

    this.staticDrops = newDrops;

    // 偶尔在顶部生成新水珠（静止）
    if (random() < 0.04) {
      this.spawnStaticDrop();
    }
  }

  spawnStaticDrop() {
    const maxTotal = 700 + (RAIN_CONFIG.staticDensity || 30) * 25;
    if (this.staticDrops.length > maxTotal) {
      const idx = this.staticDrops.findIndex(s => s.type === 'tiny');
      if (idx >= 0) this.staticDrops.splice(idx, 1);
      else return;
    }
    const roll = random();
    let type, r, alpha;
    if (roll < 0.65) {
      type = 'tiny'; r = random(0.5, 2.2); alpha = random(12, 30);
    } else if (roll < 0.90) {
      type = 'small'; r = random(2.0, 5.0); alpha = random(110, 175);
    } else if (roll < 0.98) {
      type = 'medium'; r = random(5.0, 10.0); alpha = random(160, 220);
    } else {
      type = 'large'; r = random(10.0, 14.0); alpha = random(150, 210);
    }
    const s = {
      x: random(width),
      y: random(-30, -5),
      r, type, alpha,
      vx: 0, vy: 0,
      moving: false,
      rot: random(TWO_PI),
      aspect: random(0.7, 1.4),
      noiseOff: random(1000),
    };
    if (type === 'tiny') s.jitterPhase = random(TWO_PI);
    this.staticDrops.push(s);
  }

  /* 运动水珠产生的水迹 trail */
  updateTrails() {
    // 现有水迹继续缓慢下滑并淡出
    for (let t of this.trails) {
      t.y += t.speed;
      t.alpha *= 0.988;
      t.life--;
    }
    this.trails = this.trails.filter(t => t.life > 0 && t.alpha > 2);

    // 限制 trails 最大数量，防止无限积累变脏
    if (this.trails.length > 120) return;

    // 运动中的 static drops 产生 trail（概率生成，避免过密）
    for (let s of this.staticDrops) {
      if (s.type === 'tiny') continue;
      if (s.moving && (Math.abs(s.vy) > 0.06 || Math.abs(s.vx) > 0.04)) {
        if (random() < 0.35) {
          this.trails.push({
            x: s.x + random(-2, 2),
            y: s.y + random(-2, 3),
            w: random(0.4, s.r * 0.15),
            alpha: random(18, 35),
            life: random(80, 220),
            speed: random(0.015, 0.06),
          });
        }
      }
    }

    // 快速下落的 dynamic drops 产生 trail
    for (let d of this.drops) {
      if (d.speed > 0.6 && random() < 0.35) {
        this.trails.push({
          x: d.pos.x + random(-1.5, 1.5),
          y: d.pos.y + random(-1, 2),
          w: random(0.4, d.r * 0.15),
          alpha: random(15, 30),
          life: random(70, 180),
          speed: random(0.02, 0.07),
        });
      }
    }
  }

  /* 动态雨滴与静态水珠碰撞融合 */
  coalesceDynamicWithStatic() {
    // 倒序遍历，方便删除
    for (let i = this.drops.length - 1; i >= 0; i--) {
      const d = this.drops[i];
      if (!d.active) continue;

      let merged = false;
      for (let s of this.staticDrops) {
        if (s.type === 'tiny') continue;

        const dx = d.pos.x - s.x;
        const dy = d.pos.y - s.y;
        const distSq = dx * dx + dy * dy;
        const threshold = (d.r + s.r) * 0.55;

        if (distSq < threshold * threshold) {
          // 融合：static drop 吸收 dynamic drop（体积微增，上限 10）
          const newArea = s.r * s.r + d.r * d.r * 0.30;
          s.r = Math.min(Math.sqrt(newArea), 10);
          // 位置向落点轻微偏移
          s.x = (s.x * 3 + d.pos.x) / 4;
          s.y = (s.y * 3 + d.pos.y) / 4;
          // 传递动量：让 static drop 动起来
          s.moving = true;
          s.vy = Math.max(s.vy || 0, d.speed * 0.35) + random(0.05, 0.3);
          s.vx += (d.pos.x - s.x) * 0.15 + random(-0.15, 0.15);

          d.active = false;
          merged = true;
          break; // 一颗雨滴只融合一次
        }
      }
    }
    this.drops = this.drops.filter(d => d.active);
  }

  update() {
    // 1. 静态水珠物理
    this.updateStaticDrops();

    // 2. 水迹更新
    this.updateTrails();

    // 3. 动态水痕位置
    for (let s of this.streaks) {
      s.yOffset += s.speed;
      if (s.yOffset > height * 1.2) {
        s.yOffset = -height * 0.2;
        s.baseX = random(width * 0.1, width * 0.9);
      }
    }

    // 3b. 主干水痕位置
    for (let ms of this.mainStreaks) {
      ms.headY += ms.speed;
      if (ms.headY > height + ms.length) {
        ms.headY = -ms.length * 0.3;
        ms.baseX = random(width * 0.15, width * 0.85);
      }
    }

    // 4. 动态雨滴
    for (let i = 0; i < RAIN_CONFIG.spawnRate; i++) {
      this.spawn();
    }
    for (let d of this.drops) {
      d.update();
    }
    this.drops = this.drops.filter(d => d.active);

    // 5. 雨滴与静态水珠融合
    this.coalesceDynamicWithStatic();
  }

  /* 绘制法线贴图 + 高光层 */
  drawLayers() {
    // ---- normalLayer：只画法线 sprite + streaks + trails（不含 tiny）----
    const g = this.normalLayer;
    g.clear();
    g.imageMode(CENTER);

    // 0. tiny 水珠：完全交给 shader 的 procedural StaticDrops，CPU 侧不再绘制
    // （避免每帧 200+ 次无意义 circle 调用，视觉效果由 shader 高密度微水珠替代）

    // 1. 静态水珠法线（small + medium + large）
    for (let s of this.staticDrops) {
      if (s.type === 'tiny') continue;

      if (s.moving) {
        // 运动中：画成自然泪痕，避免极度拉伸的果冻感
        const sy = s.r * 1.6 + Math.abs(s.vy) * 3.0;
        const sx = s.r * 0.75;
        g.tint(255, s.alpha * 0.50);
        g.image(this.dropSprite, s.x, s.y, sx, sy);
      } else {
        // 静止时：保留透镜折射感，但尺寸稍小更精致
        const baseSize = s.r * 2.2;
        const sx = baseSize * s.aspect;
        const sy = baseSize / s.aspect;
        g.tint(255, s.alpha);
        g.image(this.dropSprite, s.x, s.y, sx, sy);
      }
    }
    g.noTint();

    // 2. 动态雨滴（尺寸与可见度随雨势增强）
    const rainBoost = map(RAIN_CONFIG.rainIntensity || 0, 0, 100, 0.6, 1.4);
    for (let d of this.drops) {
      if (d.r > 3.5) {
        g.tint(255, 35 * rainBoost);
        g.image(this.dropSprite, d.pos.x, d.pos.y - d.r * 1.2, d.r * 0.4 * rainBoost, d.r * 3.0 * rainBoost);
      }

      const sx = d.r * 0.8 * rainBoost;
      const sy = d.r * 2.6 * rainBoost;
      g.tint(255, 55 * rainBoost);
      g.image(this.dropSprite, d.pos.x, d.pos.y, sx, sy);
    }
    g.noTint();

    // 3. 水膜斑块：已禁用（易产生规则大气泡状模糊，视觉上不自然；膜状感由 procedural StaticDrops + streaks 替代）
    // g.noStroke();
    // for (let film of this.waterFilms) {
    //   for (let b of film.blobs) {
    //     g.fill(128, 128, film.b, film.alpha);
    //     g.ellipse(film.x + b.xOff, film.y + b.yOff, b.w, b.h);
    //   }
    // }

    // 4. 水痕 streaks（较强法线信号，让 Shader 能明显降低雾气）
    for (let streak of this.streaks) {
      for (let seg of streak.segments) {
        const segY = seg.relY + streak.yOffset;
        if (segY < -20 || segY > height + 20) continue;
        const wobble = sin(segY * 0.007 + streak.phase) * 10;
        const x = streak.baseX + seg.xOff + wobble;
        // B=75 产生明确 dropStrength，让 Shader 在此区域大幅降低雾气
        g.fill(128, 128, 75, seg.alpha * 2.0);
        g.ellipse(x, segY, seg.w, height / streak.segments.length + 6);
      }
    }

    // 4b. 主干水痕（粗大蜿蜒，头部浓尾部淡，极强的雾气擦除）
    for (let ms of this.mainStreaks) {
      for (let j = 0; j < ms.segments.length; j++) {
        const seg = ms.segments[j];
        const segY = ms.headY - ms.length + seg.relY;
        if (segY < -40 || segY > height + 40) continue;
        // 头部(0)浓，尾部(1)淡
        const t = j / (ms.segments.length - 1);
        const segAlpha = lerp(ms.alphaHead, ms.alphaTail, t);
        // 双重正弦蜿蜒，幅度更大
        const wobble = sin(segY * 0.004 + ms.phase) * 24
                     + sin(segY * 0.011 + ms.phase * 1.7) * 9;
        const x = ms.baseX + seg.xOff + wobble;
        // B=95 极强的法线信号，shader 在此处几乎完全擦除雾气
        g.fill(128, 128, 95, segAlpha * 2.4);
        const segH = ms.length / ms.segments.length + 10;
        g.ellipse(x, segY, seg.w * ms.width, segH);
      }
    }

    // 5. trails 水迹（较强法线信号）
    for (let t of this.trails) {
      g.fill(128, 128, 75, t.alpha * 0.8);
      g.ellipse(t.x, t.y, t.w, t.w * 2.5 + 2);
    }

    // ---- highlightLayer：medium/large 微高光 ----
    const h = this.highlightLayer;
    h.clear();
    h.noStroke();
    for (let s of this.staticDrops) {
      if (!s.moving && (s.type === 'medium' || s.type === 'large')) {
        h.fill(255, 255, 255, s.alpha * 0.05);
        h.circle(s.x - s.r * 0.15, s.y - s.r * 0.15, s.r * 0.25);
      }
    }
  }

  onResize() {
    this.normalLayer.resizeCanvas(width, height);
    this.highlightLayer.resizeCanvas(width, height);
    this.initStaticDrops(RAIN_CONFIG.staticDensity);
    this.initStreaks();
    this.initMainStreaks();
    this.initWaterFilms();
    this.trails = [];
  }
}
