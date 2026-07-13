/* ===== textOverlay.js — 可拖拽文字系统（Step 3） ===== */

class TextOverlay {
  constructor() {
    this.container = document.getElementById('textOverlay');
    this.boxes = [];
    this.dragState = null;
    this._bindGlobalEvents();
  }

  addBox(type, text, size, weight, relX, relY) {
    const el = document.createElement('div');
    el.className = `text-box ${type}`;
    el.textContent = text;
    el.style.left = (relX * window.innerWidth) + 'px';
    el.style.top = (relY * window.innerHeight) + 'px';
    el.style.fontSize = size + 'px';
    el.style.fontWeight = weight;

    // 删除按钮
    const del = document.createElement('span');
    del.className = 'del-btn';
    del.textContent = '×';
    del.onclick = (e) => {
      e.stopPropagation();
      this.removeBox(el);
    };
    el.appendChild(del);

    // 双击编辑
    el.addEventListener('dblclick', (e) => {
      e.stopPropagation();
      this._enterEdit(el);
    });

    // 拖拽
    el.addEventListener('mousedown', (e) => this._onDragStart(e, el));
    el.addEventListener('touchstart', (e) => this._onDragStart(e, el), { passive: false });

    this.container.appendChild(el);
    this.boxes.push(el);
    return el;
  }

  removeBox(el) {
    el.remove();
    this.boxes = this.boxes.filter(b => b !== el);
  }

  clear() {
    this.boxes.forEach(b => b.remove());
    this.boxes = [];
  }

  /* 创建默认排版 */
  createDefaults() {
    this.clear();
    this.addBox('title', TEXT_DEFAULTS.title.content,
                TEXT_DEFAULTS.title.size, TEXT_DEFAULTS.title.weight,
                TEXT_DEFAULTS.title.x, TEXT_DEFAULTS.title.y);
    this.addBox('subtitle', TEXT_DEFAULTS.subtitle.content,
                TEXT_DEFAULTS.subtitle.size, TEXT_DEFAULTS.subtitle.weight,
                TEXT_DEFAULTS.subtitle.x, TEXT_DEFAULTS.subtitle.y);
  }

  /* 进入编辑态 */
  _enterEdit(el) {
    if (el.isContentEditable) return;
    el.contentEditable = true;
    el.classList.add('editing');
    el.focus();

    const onEnd = () => {
      el.contentEditable = false;
      el.classList.remove('editing');
      el.blur();
    };

    el.addEventListener('blur', onEnd, { once: true });
    el.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        onEnd();
      }
    }, { once: true });
  }

  _onDragStart(e, el) {
    if (el.isContentEditable) return;
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;

    const rect = el.getBoundingClientRect();
    this.dragState = {
      el,
      offsetX: clientX - rect.left,
      offsetY: clientY - rect.top,
    };

    if (e.type === 'touchstart') e.preventDefault();
  }

  _bindGlobalEvents() {
    const move = (e) => {
      if (!this.dragState) return;
      const cx = e.touches ? e.touches[0].clientX : e.clientX;
      const cy = e.touches ? e.touches[0].clientY : e.clientY;
      const { el, offsetX, offsetY } = this.dragState;
      el.style.left = (cx - offsetX) + 'px';
      el.style.top = (cy - offsetY) + 'px';
    };

    const end = () => {
      this.dragState = null;
    };

    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', end);
    window.addEventListener('touchmove', move, { passive: false });
    window.addEventListener('touchend', end);
  }

  /* 为导出把文字绘制到 p5.Graphics（同位置同样式） */
  drawToGraphics(g) {
    for (let el of this.boxes) {
      const rect = el.getBoundingClientRect();
      const size = parseInt(el.style.fontSize, 10);
      const weight = el.style.fontWeight || '400';
      g.textSize(size);
      g.textAlign(LEFT, TOP);
      // 根据 weight 近似选择
      if (parseInt(weight) >= 700) {
        g.textStyle(BOLD);
      } else {
        g.textStyle(NORMAL);
      }
      g.fill(255);
      g.noStroke();
      g.text(el.childNodes[0].textContent, rect.left, rect.top);
    }
    g.textStyle(NORMAL);
  }
}
