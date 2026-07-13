/* ===== main.js — 全局配置与常量 ===== */

const VERSION = '1.0.0';
const BUILD_DATE = '2026-07-11';

const isMobile = window.innerWidth < 768 ||
  ('ontouchstart' in window) ||
  (navigator.maxTouchPoints > 0);

/* ===== 雨滴系统配置（Step 1） ===== */
const RAIN_CONFIG = {
  maxDrops: isMobile ? 8 : 15,         // 由雨势 slider 动态覆盖
  spawnRate: 2,                        // 由雨势 slider 动态覆盖
  minRadius: 2,
  maxRadius: 6,
  minSpeed: 0.6,
  maxSpeed: 1.8,
  trailLength: 0.92,
  gravity: 0.008,                      // 由雨势 slider 动态覆盖
  refraction: 0.16,                     // 提高折射，亮色背景下更明显
  staticDensity: 40,                   // 静态水珠密度（0~60）
  rainIntensity: 35,                   // 雨势大小（0~100）
};

/* ===== 闪电系统配置 ===== */
const LIGHTNING_CONFIG = {
  enabled: false,
};

/* ===== 雾气系统配置（Step 2） ===== */
const FOG_CONFIG = {
  intensity: 0.60,                       // 雾化强度大幅提高
  noiseScale: 0.008,
  timeScale: 0.0003,
  blurMix: 0.14,                         // 降低模糊，让折射更清晰
};

/* ===== 文字排版默认（严格字体规范） ===== */
const TEXT_DEFAULTS = {
  title: {
    content: 'HEAVY RAIN',
    size: 72,
    weight: 900,
    x: 0.08,     // 相对屏幕宽度比例
    y: 0.12,
  },
  subtitle: {
    content: '程序化艺术生成装置',
    size: 20,
    weight: 200,
    x: 0.08,
    y: 0.22,
  },
};

/* ===== 导出配置 ===== */
const EXPORT_CONFIG = {
  imageQuality: 0.92,
  imageFormat: 'png',
};

/* ===== 性能监控 ===== */
let fpsHistory = [];
let currentMaxDrops = RAIN_CONFIG.maxDrops;
