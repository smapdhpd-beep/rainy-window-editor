/* ===== controlPanel.js — 右侧可折叠控制面板 ===== */

class ControlPanel {
  constructor(onChange) {
    this.el = document.getElementById('controlPanel');
    this.onChange = onChange;
    this.collapsed = false;
    this._render();
    this._createTrigger();
    this._bind();
  }

  _render() {
    this.el.innerHTML = `
      <div class="panel-header">
        <h3>Entertainment Area</h3>
        <span class="panel-close" id="btnClose">×</span>
      </div>

      <div class="control-row">
        <label><span>雨滴密度</span><span id="val-density">${RAIN_CONFIG.staticDensity}</span></label>
        <input type="range" id="density" min="0" max="60" value="${RAIN_CONFIG.staticDensity}">
      </div>

      <div class="control-row">
        <label><span>雨滴大小</span><span id="val-size">${RAIN_CONFIG.maxRadius}</span></label>
        <input type="range" id="size" min="4" max="20" value="${RAIN_CONFIG.maxRadius}">
      </div>

      <div class="control-row">
        <label><span>折射强度</span><span id="val-refract">${(RAIN_CONFIG.refraction * 1000).toFixed(0)}</span></label>
        <input type="range" id="refract" min="0" max="350" value="${(RAIN_CONFIG.refraction * 1000).toFixed(0)}">
      </div>

      <div class="control-row">
        <label><span>雾化程度</span><span id="val-fog">${(FOG_CONFIG.intensity * 100).toFixed(0)}%</span></label>
        <input type="range" id="fog" min="0" max="100" value="${(FOG_CONFIG.intensity * 100).toFixed(0)}">
      </div>

      <div class="control-row">
        <label><span>雨势大小</span><span id="val-rain">${RAIN_CONFIG.rainIntensity}</span></label>
        <input type="range" id="rain" min="0" max="100" value="${RAIN_CONFIG.rainIntensity}">
      </div>

      <div class="control-row">
        <label><span>镜头缩放</span><span id="val-zoom">100</span></label>
        <input type="range" id="zoom" min="80" max="150" value="100">
      </div>

      <div class="toggle-row">
        <span>闪电</span>
        <div class="toggle-switch" id="toggleLightning"></div>
      </div>

      <div class="toggle-row">
        <span>背景铺满</span>
        <div class="toggle-switch on" id="toggleBgMode"></div>
      </div>

      <button class="control-btn" id="btnUpload">上传背景图/视频</button>
      <button class="control-btn" id="btnAddText">添加文字框</button>
      <button class="control-btn primary" id="btnExport">导出当前画面</button>
    `;
  }

  _createTrigger() {
    if (document.getElementById('panelTrigger')) return;
    const btn = document.createElement('div');
    btn.id = 'panelTrigger';
    btn.innerHTML = '⚙️';
    btn.title = '打开控制面板';
    document.body.appendChild(btn);
    btn.addEventListener('click', () => this.toggle(true));
  }

  toggle(show) {
    this.collapsed = !show;
    const trigger = document.getElementById('panelTrigger');
    if (show) {
      this.el.classList.remove('collapsed');
      if (trigger) trigger.style.display = 'none';
    } else {
      this.el.classList.add('collapsed');
      if (trigger) trigger.style.display = 'flex';
    }
  }

  _bind() {
    // close
    document.getElementById('btnClose').addEventListener('click', () => this.toggle(false));

    // sliders
    const sliders = ['density', 'size', 'refract', 'fog', 'rain', 'zoom'];
    sliders.forEach(id => {
      const el = document.getElementById(id);
      if (!el) return;
      el.addEventListener('input', () => {
        const val = parseInt(el.value, 10);
        const label = document.getElementById('val-' + id);
        if (label) {
          label.textContent =
            id === 'fog' ? val + '%' :
            id === 'zoom' ? val + '%' :
            id === 'refract' ? val : val;
        }
        this._emit(id, val);
      });
    });

    // buttons
    document.getElementById('btnUpload').addEventListener('click', () => {
      document.getElementById('uploadInput').click();
    });

    document.getElementById('btnAddText').addEventListener('click', () => {
      this._emit('addText', true);
    });

    document.getElementById('btnExport').addEventListener('click', () => {
      this._emit('export', true);
    });

    // toggles
    const bgModeToggle = document.getElementById('toggleBgMode');
    bgModeToggle.addEventListener('click', () => {
      bgModeToggle.classList.toggle('on');
      this._emit('bgMode', bgModeToggle.classList.contains('on') ? 1 : 0);
    });

    const lightningToggle = document.getElementById('toggleLightning');
    lightningToggle.addEventListener('click', () => {
      lightningToggle.classList.toggle('on');
      this._emit('lightning', lightningToggle.classList.contains('on') ? 1 : 0);
    });
  }

  _emit(key, value) {
    if (this.onChange) this.onChange(key, value);
  }
}
