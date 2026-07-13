/* ===== shader.js — WebGL Shader 字符串管理（Step 1） ===== */

const vertShader = `
precision highp float;
attribute vec3 aPosition;
attribute vec2 aTexCoord;
uniform mat4 uModelViewMatrix;
uniform mat4 uProjectionMatrix;
varying vec2 vTexCoord;

void main() {
  vTexCoord = aTexCoord;
  gl_Position = uProjectionMatrix * uModelViewMatrix * vec4(aPosition, 1.0);
}
`;

const fragShader = `
precision highp float;

varying vec2 vTexCoord;

uniform sampler2D uBackground;
uniform sampler2D uDropLayer;
uniform sampler2D uFogNoise;
uniform vec2 uResolution;
uniform float uRefraction;
uniform float uFogIntensity;
uniform float uTime;
uniform float uBlurMix;
uniform float uBackgroundMode;
uniform vec2 uTexResolution;
uniform vec2 uParallax;
uniform float uProcDensity;
uniform float uZoom;
uniform float uLightning;
uniform float uRainIntensity;

/* box blur 采样：5x5=25 点，纯手工展开，避免驱动对 for-loop 的严格限制 */
vec4 blurredSample(sampler2D tex, vec2 uv, float radius) {
  vec2 px = radius / uResolution;
  vec4 sum = vec4(0.0);
  sum += texture2D(tex, uv + vec2(-2.0, -2.0) * px);
  sum += texture2D(tex, uv + vec2(-1.0, -2.0) * px);
  sum += texture2D(tex, uv + vec2( 0.0, -2.0) * px);
  sum += texture2D(tex, uv + vec2( 1.0, -2.0) * px);
  sum += texture2D(tex, uv + vec2( 2.0, -2.0) * px);
  sum += texture2D(tex, uv + vec2(-2.0, -1.0) * px);
  sum += texture2D(tex, uv + vec2(-1.0, -1.0) * px);
  sum += texture2D(tex, uv + vec2( 0.0, -1.0) * px);
  sum += texture2D(tex, uv + vec2( 1.0, -1.0) * px);
  sum += texture2D(tex, uv + vec2( 2.0, -1.0) * px);
  sum += texture2D(tex, uv + vec2(-2.0,  0.0) * px);
  sum += texture2D(tex, uv + vec2(-1.0,  0.0) * px);
  sum += texture2D(tex, uv + vec2( 0.0,  0.0) * px);
  sum += texture2D(tex, uv + vec2( 1.0,  0.0) * px);
  sum += texture2D(tex, uv + vec2( 2.0,  0.0) * px);
  sum += texture2D(tex, uv + vec2(-2.0,  1.0) * px);
  sum += texture2D(tex, uv + vec2(-1.0,  1.0) * px);
  sum += texture2D(tex, uv + vec2( 0.0,  1.0) * px);
  sum += texture2D(tex, uv + vec2( 1.0,  1.0) * px);
  sum += texture2D(tex, uv + vec2( 2.0,  1.0) * px);
  sum += texture2D(tex, uv + vec2(-2.0,  2.0) * px);
  sum += texture2D(tex, uv + vec2(-1.0,  2.0) * px);
  sum += texture2D(tex, uv + vec2( 0.0,  2.0) * px);
  sum += texture2D(tex, uv + vec2( 1.0,  2.0) * px);
  sum += texture2D(tex, uv + vec2( 2.0,  2.0) * px);
  return sum / 25.0;
}

/* Bokeh 径向模糊：8 次固定角度采样，无循环，模拟失焦光斑 */
vec3 bokehBlur(sampler2D tex, vec2 uv, float radius) {
  if (radius < 1.5) return texture2D(tex, uv).rgb;
  vec2 px = radius / uResolution;
  vec3 sum = texture2D(tex, uv).rgb;
  sum += texture2D(tex, uv + vec2( 1.0,  0.0) * px).rgb;
  sum += texture2D(tex, uv + vec2(-1.0,  0.0) * px).rgb;
  sum += texture2D(tex, uv + vec2( 0.0,  1.0) * px).rgb;
  sum += texture2D(tex, uv + vec2( 0.0, -1.0) * px).rgb;
  sum += texture2D(tex, uv + vec2( 0.7,  0.7) * px).rgb;
  sum += texture2D(tex, uv + vec2(-0.7,  0.7) * px).rgb;
  sum += texture2D(tex, uv + vec2( 0.7, -0.7) * px).rgb;
  sum += texture2D(tex, uv + vec2(-0.7, -0.7) * px).rgb;
  return sum / 9.0;
}

// 来自 rocksdanister/rain 的 hash & static drops
vec3 N13(float p) {
  vec3 p3 = fract(vec3(p) * vec3(.1031, .11369, .13787));
  p3 += dot(p3, p3.yzx + 19.19);
  return fract(vec3((p3.x + p3.y) * p3.z, (p3.x + p3.z) * p3.y, (p3.y + p3.z) * p3.x));
}

float Saw(float b, float t) {
  return smoothstep(0.0, b, t) * smoothstep(1.0, b, t);
}

float StaticDrops(vec2 uv, float t) {
  uv *= 45.0;
  vec2 id = floor(uv);
  uv = fract(uv) - .5;
  vec3 n = N13(id.x * 107.45 + id.y * 3543.654);
  vec2 p = (n.xy - .5) * .7;
  float d = length(uv - p);
  float fade = Saw(.025, fract(t + n.z));
  float c = smoothstep(.3, .0, d) * fract(n.z * 10.) * fade;
  return c;
}

/* DropLayer2：网格化动态雨滴（带拖尾），来自 rocksdanister/rain，适配 UV 坐标系 */
vec2 DropLayer2(vec2 uv, float t) {
  vec2 UV = uv;
  uv.y += t * 0.75;
  vec2 a = vec2(6.0, 1.0);
  vec2 grid = a * 2.0;
  vec2 id = floor(uv * grid);

  float colShift = N13(id.x).x;
  uv.y += colShift;

  id = floor(uv * grid);
  vec3 n = N13(id.x * 35.2 + id.y * 2376.1);
  vec2 st = fract(uv * grid) - vec2(0.5, 0.0);

  float x = n.x - 0.5;

  float y = UV.y * 20.0;
  float wiggle = sin(y + sin(y));
  x += wiggle * (0.5 - abs(x)) * (n.z - 0.5);
  x *= 0.7;
  float ti = fract(t + n.z);
  y = (Saw(0.85, ti) - 0.5) * 0.9 + 0.5;
  vec2 p = vec2(x, y);

  float d = length((st - p) * a.yx);

  float mainDrop = smoothstep(0.4, 0.0, d);

  float r = sqrt(smoothstep(1.0, y, st.y));
  float cd = abs(st.x - x);
  float trail = smoothstep(0.23 * r, 0.15 * r * r, cd);
  float trailFront = smoothstep(-0.02, 0.02, st.y - y);
  trail *= trailFront * r * r;

  y = UV.y;
  float trail2 = smoothstep(0.2 * r, 0.0, cd);
  float droplets = max(0.0, (sin(y * (1.0 - y) * 120.0) - st.y)) * trail2 * trailFront * n.z;
  y = fract(y * 10.0) + (st.y - 0.5);
  float dd = length(st - vec2(x, y));
  droplets = smoothstep(0.3, 0.0, dd);
  float m = mainDrop + droplets * r * trailFront;

  return vec2(m, trail);
}

void main() {
  vec2 uv = vTexCoord;

  // Zoom：对玻璃（雨滴层）的缩放，模拟长焦/广角镜头，背景保持不动
  vec2 dropUV = (uv - 0.5) / uZoom + 0.5;

  // ---- 背景 UV：cover 适配 + 鼠标视差 ----
  vec2 bgUV = uv;
  if (uBackgroundMode > 0.5 && uTexResolution.x > 0.0) {
    float screenAspect = uResolution.x / uResolution.y;
    float texAspect = uTexResolution.x / uTexResolution.y;
    vec2 scale = vec2(1.0);
    if (texAspect > screenAspect) {
      scale.x = screenAspect / texAspect;
    } else {
      scale.y = texAspect / screenAspect;
    }
    bgUV = scale * (uv - 0.5) + 0.5;
  }
  // 鼠标视差：背景轻微偏移，模拟玻璃后的空间深度
  bgUV += uParallax * 0.4;

  // 1. 采样雨滴法线层 (R,G 作为 XY 法线, B 作为高度/Alpha)
  vec4 drop = texture2D(uDropLayer, dropUV);
  vec2 dropNormal = (drop.rg - 0.5) * 2.0;
  float dropStrength = drop.b;

  // 防止越界采样（zoom < 1 时 dropUV 可能超出 [0,1]）导致法线异常
  if (dropStrength < 0.001) dropNormal = vec2(0.0);

  // 恢复原始法线方向（tint alpha 会缩放 RG，必须还原才能得到真实球面方向）
  // 注意：此计算必须在叠加动态法线之前，因为动态法线没有 alpha 缩放问题
  vec2 dropNormalRaw = dropNormal / max(dropStrength, 0.001);
  float rawLen = length(dropNormalRaw);
  if (rawLen > 1.0) dropNormalRaw = normalize(dropNormalRaw);

  // ---- Procedural 静态微水珠层（shader 内生成，极高密度底衬）----
  float procDrops = StaticDrops(uv, uTime * 0.0003) * uProcDensity * 0.55;

  // ---- Procedural 动态雨滴层（shader 内网格化雨滴，大雨时极密）----
  // 借鉴 rocksdanister/rain：两层 DropLayer2 按 uRainIntensity 混合
  vec2 dynNormal = vec2(0.0);
  float dynamicDrops = 0.0;
  if (uRainIntensity > 0.01) {
    float tRain = uTime * 0.00025;
    vec2 screenUV = (uv - 0.5) * vec2(uResolution.x / uResolution.y, -1.0);
    float layer1 = smoothstep(0.25, 0.75, uRainIntensity);
    float layer2 = smoothstep(0.0, 0.5, uRainIntensity);

    vec2 e = vec2(0.0015, 0.0);
    float c1  = DropLayer2(screenUV, tRain).x;
    float c2  = DropLayer2(screenUV * 1.85, tRain).x;
    float cx1 = DropLayer2(screenUV + e, tRain).x;
    float cx2 = DropLayer2(screenUV * 1.85 + e, tRain).x;
    float cy1 = DropLayer2(screenUV + e.yx, tRain).x;
    float cy2 = DropLayer2(screenUV * 1.85 + e.yx, tRain).x;

    dynamicDrops = c1 * layer1 + c2 * layer2;
    float dxc = (cx1 - c1) * layer1 + (cx2 - c2) * layer2;
    float dyc = (cy1 - c1) * layer1 + (cy2 - c2) * layer2;
    dynNormal = vec2(dxc, dyc) * 10.0;

    // 动态雨滴法线叠加：只在有动态雨滴的区域增强折射方向
    dropNormal += dynNormal * smoothstep(0.0, 0.3, dynamicDrops);
  }

  float combinedStrength = max(dropStrength, max(procDrops, dynamicDrops));

  // ---- LOD 折射分级 ----
  float lodSmall = 1.0 - smoothstep(0.10, 0.35, dropStrength); // 小水珠
  float lodLarge = smoothstep(0.40, 0.80, dropStrength);       // 大水珠
  float lodMed = 1.0 - lodSmall - lodLarge;                     // 中等

  // 2. 折射：基于 bgUV + LOD 强度缩放（大水珠折射更强，更像放大镜）
  // 折射强度同时受 CPU 水珠(dropStrength) 和 shader 动态雨滴(dynamicDrops) 调制
  float refStrength = max(dropStrength, dynamicDrops);
  float refScale = 1.0 + lodMed * 0.6 + lodLarge * 1.6; // 小:1.0 中:1.6 大:2.6
  float refR = uRefraction * refScale;
  float refG = uRefraction * refScale;
  float refB = uRefraction * refScale;
  vec2 refractUV_R = bgUV + dropNormal * refR * refStrength;
  vec2 refractUV_G = bgUV + dropNormal * refG * refStrength;
  vec2 refractUV_B = bgUV + dropNormal * refB * refStrength;

  float r = texture2D(uBackground, refractUV_R).r;
  float g = texture2D(uBackground, refractUV_G).g;
  float b = texture2D(uBackground, refractUV_B).b;
  vec3 bgSharp = vec3(r, g, b);

  // 基础模糊：只在有水珠/水膜/动态雨滴的区域才计算
  vec3 bgColor = bgSharp;
  if (dropStrength > 0.01 || procDrops > 0.01 || dynamicDrops > 0.01) {
    vec3 bgBlur = blurredSample(uBackground, bgUV + dropNormal * uRefraction * 0.5 * refStrength, 4.0).rgb;
    bgColor = mix(bgSharp, bgBlur, uBlurMix * refStrength);
  }

  // ---- 大水珠额外径向失焦（模拟放大镜边缘虚化 / bokeh 感）----
  if (lodLarge > 0.01) {
    float rbRadius = min(14.0 + uRefraction * 60.0, 20.0);
    vec3 bgLargeBlur = bokehBlur(uBackground, bgUV + dropNormal * uRefraction * dropStrength * 0.8, rbRadius);
    bgColor = mix(bgColor, bgLargeBlur, lodLarge * 0.55);
  }

  // 3. 水珠球面感：柔和的整体提亮，避免锐利边缘环和黑洞中心
  vec3 normalVec = normalize(vec3(dropNormalRaw.x, dropNormalRaw.y,
                               sqrt(max(1.0 - dot(dropNormalRaw, dropNormalRaw), 0.0))));

  // 极弱的菲涅尔边缘光：过渡宽而淡，不像白环
  float fresnel = pow(1.0 - normalVec.z, 2.0);
  vec3 highlight = vec3(0.90, 0.94, 1.0) * fresnel * 0.035;

  // 顶部极弱镜面高光（只有大水珠才明显）
  vec3 lightDir = normalize(vec3(0.3, 0.5, 0.8));
  float spec = pow(max(dot(normalVec, lightDir), 0.0), 20.0) * combinedStrength;
  highlight += vec3(1.0, 0.98, 0.94) * spec * 0.06;

  // 中心天光微亮：让水珠整体像微弱凸起的透镜，而不是黑洞
  float skyGlow = pow(normalVec.z, 2.0) * 0.06 * combinedStrength;
  highlight += vec3(0.88, 0.92, 1.0) * skyGlow;

  // 4. 雾气噪声采样
  float fogNoise = texture2D(uFogNoise, uv * 0.35 + uTime * 0.012).r;
  float fogMask = smoothstep(0.20, 0.80, fogNoise) * uFogIntensity;

  // 水珠/水迹区域降低雾气（水流过的地方保持清晰）
  float wetness = combinedStrength * 2.2;
  fogMask *= (1.0 - smoothstep(0.0, 0.18, wetness) * 0.65);

  // 5. 雾化 = 背景失焦（景深模糊），不发灰
  vec3 bgDefocus = bgColor;
  if (fogMask > 0.02) {
    float defocusRadius = mix(0.0, 28.0, fogMask);
    bgDefocus = bokehBlur(uBackground, bgUV, defocusRadius);
    bgColor = mix(bgColor, bgDefocus, fogMask * 0.55);
  }

  // 水膜区域也会让背景局部失焦（真实湿玻璃的效果）
  float localDefocus = smoothstep(0.06, 0.30, combinedStrength) * 0.12;
  bgColor = mix(bgColor, bgDefocus, localDefocus);

  // 6. 水珠本体极淡染色
  vec3 dropTint = vec3(0.88, 0.91, 0.96) * combinedStrength * 0.035;

  // 7. 动态暗角（雾化越强，暗角越重）
  vec2 vignetteUV = uv - 0.5;
  float vignette = 1.0 - dot(vignetteUV, vignetteUV) * (0.5 + uFogIntensity * 0.35);
  vignette = clamp(vignette, 0.72, 1.0);

  // 8. 合成：背景 + 水珠柔和高光 + 淡染色
  vec3 final = bgColor + highlight + dropTint;
  final *= vignette;

  // 9. 雨夜湿润化后处理
  // 9a. 降低饱和度，模拟雨夜光线暗淡
  float luminance = dot(final, vec3(0.299, 0.587, 0.114));
  vec3 gray = vec3(luminance);
  final = mix(final, gray, 0.10);

  // 9b. 选择性调色：暗部蓝紫，亮部暖
  vec3 coolShadow = final * vec3(0.86, 0.90, 1.10);
  vec3 warmHighlight = final * vec3(1.06, 1.02, 0.94);
  final = mix(coolShadow, warmHighlight, smoothstep(0.22, 0.60, luminance));

  // 9c. 底部地面反光（模拟湿漉漉路面反射灯光）
  float groundMask = smoothstep(0.70, 0.95, uv.y);
  float wetStripe = sin(bgUV.x * 60.0 + uTime * 0.35) * 0.5 + 0.5;
  wetStripe *= sin(bgUV.x * 140.0 + uTime * 0.6) * 0.5 + 0.5;
  wetStripe = pow(wetStripe, 3.0);
  float groundReflect = wetStripe * groundMask * 0.055 * smoothstep(0.15, 0.45, luminance);
  final += vec3(0.92, 0.94, 1.0) * groundReflect;

  // 9d. 大气雨雾（极淡的水平noise，模拟空气中雨丝导致的远处朦胧）
  float rainHaze = texture2D(uFogNoise, vec2(bgUV.x * 2.5, bgUV.y * 0.08 + uTime * 0.006)).r;
  rainHaze = smoothstep(0.30, 0.70, rainHaze) * 0.035;
  final = mix(final, final * vec3(0.88, 0.92, 1.0) + vec3(0.015), rainHaze);

  // 9e. 轻微冷灰蓝全局调色
  final = mix(final, final * vec3(0.90, 0.95, 1.04), 0.08);

  // 10. 闪电（随机闪烁+闪光爆发）
  if (uLightning > 0.5) {
    float lt = uTime * 0.001;
    float lightning = sin(lt * sin(lt * 10.0));
    lightning *= pow(max(0.0, sin(lt + sin(lt))), 10.0);
    final *= 1.0 + lightning * 0.35;
  }

  gl_FragColor = vec4(final, 1.0);
}
`;
