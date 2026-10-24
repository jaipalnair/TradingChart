/**
 * Interactive Drawing Tools Engine for TradeView Multi-Chart
 * Maps screen pixels <-> chart logical coordinates (time, price)
 * Renders on high-DPI transparent canvas overlays.
 */

class DrawingOverlay {
  constructor(canvasElement, chartInstance) {
    this.canvas = canvasElement;
    this.ctx = canvasElement.getContext('2d');
    this.chartInstance = chartInstance;
    this.chart = chartInstance.chart;
    this.series = chartInstance.mainSeries;

    this.drawings = [];
    this.activeTool = 'cursor'; // cursor, trendline, horizontal, vertical, rectangle, fibonacci, measure, eraser
    this.drawingState = null; // in-progress drawing points
    this.selectedDrawing = null;
    this.hoveredDrawing = null;

    this.setupCanvasDPI();
    this.bindEvents();
    this.setTool('cursor');
  }

  setupCanvasDPI() {
    const rect = this.canvas.parentElement ? this.canvas.parentElement.getBoundingClientRect() : { width: 0, height: 0 };
    if (!rect.width || !rect.height) return;
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = rect.width * dpr;
    this.canvas.height = rect.height * dpr;
    this.canvas.style.width = `${rect.width}px`;
    this.canvas.style.height = `${rect.height}px`;
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.scale(dpr, dpr);
    this.width = rect.width;
    this.height = rect.height;
  }

  resize() {
    this.setupCanvasDPI();
    this.render();
  }

  setTool(tool) {
    this.activeTool = tool;
    this.drawingState = null;
    if (tool === 'cursor') {
      this.canvas.classList.remove('interactive');
      this.canvas.style.pointerEvents = 'none';
    } else {
      this.canvas.classList.add('interactive');
      this.canvas.style.pointerEvents = 'auto';
    }
    this.render();
  }

  // Convert mouse pixel coordinates to Logical { time, price }
  pixelToLogical(x, y) {
    if (!this.chart || !this.chartInstance.mainSeries) return null;
    const timeScale = this.chart.timeScale();
    const time = timeScale.coordinateToTime(x);
    const price = this.chartInstance.mainSeries.coordinateToPrice(y);
    return { time, price, x, y };
  }

  // Convert logical { time, price } to pixel coordinates
  logicalToPixel(point) {
    if (!point || !this.chart || !this.chartInstance.mainSeries) return null;
    const timeScale = this.chart.timeScale();
    const x = point.time ? timeScale.timeToCoordinate(point.time) : point.x;
    const y = point.price ? this.chartInstance.mainSeries.priceToCoordinate(point.price) : point.y;
    if (x === null || y === null) return null;
    return { x, y };
  }

  bindEvents() {
    this.canvas.addEventListener('mousedown', (e) => this.onMouseDown(e));
    this.canvas.addEventListener('mousemove', (e) => this.onMouseMove(e));
    this.canvas.addEventListener('mouseup', (e) => this.onMouseUp(e));

    // Re-render drawings whenever the chart pans, zooms, or time scale changes
    this.chart.timeScale().subscribeVisibleLogicalRangeChange(() => {
      requestAnimationFrame(() => this.render());
    });
  }

  onMouseDown(e) {
    if (this.activeTool === 'cursor') return;
    const rect = this.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const logical = this.pixelToLogical(x, y);
    if (!logical || !logical.price) return;

    if (this.activeTool === 'eraser') {
      this.deleteDrawingAt(x, y);
      return;
    }

    if (this.activeTool === 'horizontal') {
      this.drawings.push({
        id: 'draw_' + Date.now(),
        type: 'horizontal',
        price: logical.price,
        color: '#2962ff',
        width: 1.5
      });
      this.saveDrawings();
      this.render();
      return;
    }

    if (this.activeTool === 'vertical') {
      this.drawings.push({
        id: 'draw_' + Date.now(),
        type: 'vertical',
        time: logical.time,
        color: '#2962ff',
        width: 1.5
      });
      this.saveDrawings();
      this.render();
      return;
    }

    // 2-point tools (trendline, rectangle, fibonacci, measure)
    if (!this.drawingState) {
      this.drawingState = {
        tool: this.activeTool,
        p1: logical,
        p2: logical
      };
    } else {
      // Finalize drawing
      this.drawings.push({
        id: 'draw_' + Date.now(),
        type: this.activeTool,
        p1: this.drawingState.p1,
        p2: logical,
        color: this.activeTool === 'measure' ? '#089981' : '#2962ff',
        width: 1.5
      });
      this.drawingState = null;
      this.saveDrawings();
      this.render();
    }
  }

  onMouseMove(e) {
    if (this.activeTool === 'cursor') return;
    const rect = this.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const logical = this.pixelToLogical(x, y);
    if (!logical) return;

    if (this.drawingState) {
      this.drawingState.p2 = logical;
      this.render();
    }
  }

  onMouseUp(e) {
    // handled in onMouseDown for click-click flow
  }

  deleteDrawingAt(x, y) {
    // Check if clicked close to any horizontal line
    for (let i = this.drawings.length - 1; i >= 0; i--) {
      const d = this.drawings[i];
      if (d.type === 'horizontal') {
        const py = this.chartInstance.mainSeries.priceToCoordinate(d.price);
        if (Math.abs(y - py) < 8) {
          this.drawings.splice(i, 1);
          this.saveDrawings();
          this.render();
          return;
        }
      }
    }
    // Otherwise remove last drawing
    if (this.drawings.length > 0) {
      this.drawings.pop();
      this.saveDrawings();
      this.render();
    }
  }

  clearAllDrawings() {
    this.drawings = [];
    this.drawingState = null;
    this.saveDrawings();
    this.render();
  }

  saveDrawings() {
    try {
      const key = `drawings_${this.chartInstance.symbol || 'default'}`;
      localStorage.setItem(key, JSON.stringify(this.drawings));
    } catch (e) {}
  }

  loadDrawings() {
    try {
      const key = `drawings_${this.chartInstance.symbol || 'default'}`;
      const saved = localStorage.getItem(key);
      if (saved) {
        this.drawings = JSON.parse(saved);
        this.render();
      }
    } catch (e) {}
  }

  render() {
    this.ctx.clearRect(0, 0, this.width, this.height);

    // Render finalized drawings
    for (const d of this.drawings) {
      this.renderDrawing(d);
    }

    // Render in-progress drawing preview
    if (this.drawingState) {
      this.renderDrawing({
        type: this.drawingState.tool,
        p1: this.drawingState.p1,
        p2: this.drawingState.p2,
        color: '#2962ff',
        width: 1.5,
        isPreview: true
      });
    }
  }

  renderDrawing(d) {
    const ctx = this.ctx;
    ctx.save();

    if (d.type === 'horizontal') {
      const y = this.chartInstance.mainSeries.priceToCoordinate(d.price);
      if (y !== null) {
        ctx.strokeStyle = d.color || '#2962ff';
        ctx.lineWidth = d.width || 1.5;
        ctx.setLineDash(d.isPreview ? [4, 4] : []);
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(this.width, y);
        ctx.stroke();

        // Price badge pill
        ctx.fillStyle = d.color || '#2962ff';
        ctx.fillRect(this.width - 70, y - 10, 68, 20);
        ctx.fillStyle = '#ffffff';
        ctx.font = '11px -apple-system, BlinkMacSystemFont, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(d.price.toFixed(2), this.width - 36, y);
      }
    } else if (d.type === 'vertical') {
      const x = this.chart.timeScale().timeToCoordinate(d.time);
      if (x !== null) {
        ctx.strokeStyle = d.color || '#2962ff';
        ctx.lineWidth = d.width || 1.5;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, this.height);
        ctx.stroke();
      }
    } else if (d.type === 'trendline') {
      const pt1 = this.logicalToPixel(d.p1);
      const pt2 = this.logicalToPixel(d.p2);
      if (pt1 && pt2) {
        ctx.strokeStyle = d.color || '#2962ff';
        ctx.lineWidth = d.width || 2;
        ctx.beginPath();
        ctx.moveTo(pt1.x, pt1.y);
        ctx.lineTo(pt2.x, pt2.y);
        ctx.stroke();

        // Handles
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(pt1.x, pt1.y, 4, 0, Math.PI * 2);
        ctx.arc(pt2.x, pt2.y, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
    } else if (d.type === 'rectangle') {
      const pt1 = this.logicalToPixel(d.p1);
      const pt2 = this.logicalToPixel(d.p2);
      if (pt1 && pt2) {
        const rx = Math.min(pt1.x, pt2.x);
        const ry = Math.min(pt1.y, pt2.y);
        const rw = Math.abs(pt2.x - pt1.x);
        const rh = Math.abs(pt2.y - pt1.y);

        ctx.fillStyle = 'rgba(41, 98, 255, 0.15)';
        ctx.fillRect(rx, ry, rw, rh);
        ctx.strokeStyle = d.color || '#2962ff';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(rx, ry, rw, rh);
      }
    } else if (d.type === 'fibonacci') {
      const pt1 = this.logicalToPixel(d.p1);
      const pt2 = this.logicalToPixel(d.p2);
      if (pt1 && pt2) {
        const levels = [
          { lvl: 0.0, color: '#787b86' },
          { lvl: 0.236, color: '#f23645' },
          { lvl: 0.382, color: '#ff9800' },
          { lvl: 0.5, color: '#089981' },
          { lvl: 0.618, color: '#2962ff' },
          { lvl: 0.786, color: '#9c27b0' },
          { lvl: 1.0, color: '#787b86' }
        ];

        const minX = Math.min(pt1.x, pt2.x);
        const maxX = Math.max(pt1.x, pt2.x);
        const yDiff = pt2.y - pt1.y;

        levels.forEach(l => {
          const ly = pt1.y + (yDiff * l.lvl);
          ctx.strokeStyle = l.color;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(minX, ly);
          ctx.lineTo(maxX, ly);
          ctx.stroke();

          // Label
          ctx.fillStyle = l.color;
          ctx.font = '10px -apple-system, sans-serif';
          ctx.fillText(`Fib ${l.lvl}`, minX + 5, ly - 3);
        });
      }
    } else if (d.type === 'measure') {
      const pt1 = this.logicalToPixel(d.p1);
      const pt2 = this.logicalToPixel(d.p2);
      if (pt1 && pt2) {
        const rx = Math.min(pt1.x, pt2.x);
        const ry = Math.min(pt1.y, pt2.y);
        const rw = Math.abs(pt2.x - pt1.x);
        const rh = Math.abs(pt2.y - pt1.y);

        const price1 = d.p1.price;
        const price2 = d.p2.price;
        const deltaPrice = price2 - price1;
        const deltaPct = ((deltaPrice / price1) * 100).toFixed(2);
        const isBull = deltaPrice >= 0;

        ctx.fillStyle = isBull ? 'rgba(8, 153, 129, 0.18)' : 'rgba(242, 54, 69, 0.18)';
        ctx.fillRect(rx, ry, rw, rh);
        ctx.strokeStyle = isBull ? '#089981' : '#f23645';
        ctx.strokeRect(rx, ry, rw, rh);

        // Center measurement badge
        const badgeText = `${deltaPrice >= 0 ? '+' : ''}${deltaPrice.toFixed(2)} (${deltaPct}%)`;
        ctx.font = 'bold 12px sans-serif';
        const textWidth = ctx.measureText(badgeText).width;
        const cx = rx + rw / 2;
        const cy = ry + rh / 2;

        ctx.fillStyle = 'rgba(19, 23, 34, 0.9)';
        ctx.fillRect(cx - textWidth / 2 - 8, cy - 12, textWidth + 16, 24);
        ctx.fillStyle = isBull ? '#089981' : '#f23645';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(badgeText, cx, cy);
      }
    }

    ctx.restore();
  }
}

window.DrawingOverlay = DrawingOverlay;
