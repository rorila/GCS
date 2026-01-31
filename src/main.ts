import './style.css'

document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
  <div id="app-layout">
    <!-- Menu Bar -->
    <div id="menu-bar"></div>
    
    <!-- Editor Container (Grid Layout) -->
    <div id="editor-container">
      <!-- Vertical Toolbox (JSON-based) -->
      <aside id="toolbox" class="panel">
        <h2>Toolbox <span id="toolbox-layout-toggle" style="font-size: 16px; cursor: pointer; float: right; padding: 0 8px;" title="Toggle Horizontal/Vertical Layout">⇄</span></h2>
        <div id="toolbox-content" style="display: none;"></div>
        <div id="json-toolbox-content"></div>
      </aside>
      
      <!-- Main content area -->
      <div id="main-area">
        <!-- Horizontal Header (hidden by default) -->
        <div id="horizontal-header" style="display: none;">
          <div id="horizontal-toolbar"></div>
          <div id="horizontal-palette"></div>
        </div>
        
        <!-- Stage Container -->
        <main id="stage-container">
          <div id="view-tabs" class="tabs-header">
            <button class="tab-btn active" data-view="stage">Stage</button>
            <button class="tab-btn" data-view="run">Run</button>
            <button class="tab-btn" data-view="json">JSON</button>
            <button class="tab-btn" data-view="flow">Flow</button>
            <button class="tab-btn" data-view="code">Pascal</button>
            <button class="tab-btn" data-view="management">Manager</button>
          </div>
          <div id="view-content">
            <div id="stage-wrapper">
              <div id="stage"></div>
            </div>
            <div id="json-viewer" class="json-panel" style="display: none;"></div>
            <div id="flow-viewer" class="flow-panel" style="display: none;"></div>
            <div id="code-viewer" class="code-panel" style="display: none;"></div>
            <div id="management-viewer" class="management-panel" style="display: none;"></div>
          </div>
        </main>
      </div>
      
      <div id="inspector-resize-handle"></div>
      <aside id="inspector" class="panel">
        <h2>Inspector</h2>
        <div id="inspector-content" style="display: none;"></div>
        <div id="json-inspector-content"></div>
      </aside>
    </div>
  </div>
`


// Inspector Resize Logic
const inspectorResizeHandle = document.getElementById('inspector-resize-handle')!;
const inspector = document.getElementById('inspector')!;

let isResizing = false;

inspectorResizeHandle.addEventListener('mousedown', (e) => {
  isResizing = true;
  document.body.style.cursor = 'ew-resize';
  document.body.style.userSelect = 'none';
  e.preventDefault();
});

document.addEventListener('mousemove', (e) => {
  if (!isResizing) return;
  const containerRight = document.getElementById('editor-container')!.getBoundingClientRect().right;
  const newWidth = containerRight - e.clientX;
  const clampedWidth = Math.max(200, Math.min(500, newWidth));
  inspector.style.width = clampedWidth + 'px';
});

document.addEventListener('mouseup', () => {
  if (isResizing) {
    isResizing = false;
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  }
});

import { Editor } from './editor/Editor';

new Editor();

