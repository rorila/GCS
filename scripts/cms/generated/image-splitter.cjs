"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/utils/ImageSplitterModel.ts
var ImageSplitterModel_exports = {};
__export(ImageSplitterModel_exports, {
  createImagePieces: () => createImagePieces,
  fitImageBounds: () => fitImageBounds,
  loadSplitterImage: () => loadSplitterImage,
  prepareImagePieces: () => prepareImagePieces,
  resolveSplitterImageSource: () => resolveSplitterImageSource,
  validateImageSplit: () => validateImageSplit
});
module.exports = __toCommonJS(ImageSplitterModel_exports);

// src/utils/PuzzleShape.ts
var PUZZLE_TAB_DEPTH = 0.18;
function createPuzzleEdges(rows, columns) {
  const horizontal = Array.from({ length: Math.max(0, rows - 1) }, (_, row) => Array.from({ length: columns }, (_2, col) => (row + col) % 2 === 0 ? 1 : -1));
  const vertical = Array.from({ length: rows }, (_, row) => Array.from({ length: Math.max(0, columns - 1) }, (_2, col) => (row + col) % 2 === 0 ? 1 : -1));
  return Array.from({ length: rows * columns }, (_, index) => {
    const row = Math.floor(index / columns), col = index % columns;
    return [
      row === 0 ? 0 : -horizontal[row - 1][col],
      col === columns - 1 ? 0 : vertical[row][col],
      row === rows - 1 ? 0 : horizontal[row][col],
      col === 0 ? 0 : -vertical[row][col - 1]
    ].join(",");
  });
}

// src/utils/ImageSplitterModel.ts
function validateImageSplit(config) {
  if (!String(config.imageSource || "").trim()) return "Bitte eine Bilddatei ausw\xE4hlen.";
  for (const count of [config.rows, config.columns]) {
    if (!Number.isInteger(count) || count < 1 || count > 6) {
      return "Zeilen und Spalten m\xFCssen ganze Zahlen zwischen 1 und 6 sein.";
    }
  }
  return null;
}
function createImagePieces(config, sourceWidth, sourceHeight) {
  const error = validateImageSplit(config);
  if (error) throw new Error(error);
  if (![sourceWidth, sourceHeight].every((n) => Number.isFinite(n) && n > 0)) {
    throw new Error("Das Bild hat keine g\xFCltige Gr\xF6\xDFe.");
  }
  const imageAspect = sourceWidth / sourceHeight;
  const targetAspect = Number(config.targetAspect) || imageAspect;
  let cropX = 0, cropY = 0, cropW = sourceWidth, cropH = sourceHeight;
  if (imageAspect > targetAspect) {
    cropW = sourceHeight * targetAspect;
    cropX = (sourceWidth - cropW) / 2;
  } else if (imageAspect < targetAspect) {
    cropH = sourceWidth / targetAspect;
    cropY = (sourceHeight - cropH) / 2;
  }
  const width = cropW / config.columns;
  const height = cropH / config.rows;
  const edges = config.pieceShape === "puzzle" ? createPuzzleEdges(config.rows, config.columns) : [];
  const puzzleTabDepth = Math.min(0.4, Math.max(0.05, Number(config.tabSize) || PUZZLE_TAB_DEPTH));
  return Array.from({ length: config.rows * config.columns }, (_, index) => {
    const row = Math.floor(index / config.columns), column = index % config.columns;
    return {
      id: `${config.id}_r${row}_c${column}`,
      index,
      row,
      column,
      matchValue: `r${row}_c${column}`,
      source: config.imageSource,
      sourceWidth,
      sourceHeight,
      x: cropX + column * width,
      y: cropY + row * height,
      width,
      height,
      puzzleEdges: edges[index] || "",
      puzzleTabDepth
    };
  });
}
function fitImageBounds(sourceWidth, sourceHeight, boxWidth, boxHeight) {
  if (![sourceWidth, sourceHeight, boxWidth, boxHeight].every((n) => Number.isFinite(n) && n > 0)) {
    return { x: 0, y: 0, width: boxWidth, height: boxHeight };
  }
  const scale = Math.min(boxWidth / sourceWidth, boxHeight / sourceHeight);
  const width = sourceWidth * scale, height = sourceHeight * scale;
  return { x: (boxWidth - width) / 2, y: (boxHeight - height) / 2, width, height };
}
function resolveSplitterImageSource(source) {
  let result = String(source || "").trim();
  if (/^data:image\//i.test(result) || /^blob:/i.test(result)) return result;
  if (/^[a-z][a-z\d+.-]*:/i.test(result) && !/^https?:/i.test(result)) {
    throw new Error("Bitte eine Bilddatei aus der Medienauswahl verwenden.");
  }
  if (result.startsWith("/images/")) result = "." + result;
  else if (!/^(https?:|\/|\.)/i.test(result)) {
    result = result.startsWith("images/") || result.startsWith("assets/") ? "./" + result : "./images/" + result;
  }
  return result.split("/").map((part) => part.replace(/\s/g, (char) => encodeURIComponent(char))).join("/");
}
function loadSplitterImage(source) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const timer = setTimeout(() => finish(new Error("Zeit\xFCberschreitung beim Laden des Bildes.")), 15e3);
    const finish = (error) => {
      clearTimeout(timer);
      image.onload = null;
      image.onerror = null;
      if (error) reject(error);
      else if (image.naturalWidth > 0 && image.naturalHeight > 0) {
        resolve({ width: image.naturalWidth, height: image.naturalHeight });
      } else reject(new Error("Das Bild hat keine g\xFCltige Gr\xF6\xDFe."));
    };
    image.onload = () => finish();
    image.onerror = () => finish(new Error("Bild konnte nicht geladen werden. Bitte die Bildquelle pr\xFCfen."));
    try {
      image.src = resolveSplitterImageSource(source);
    } catch (error) {
      finish(error instanceof Error ? error : new Error(String(error)));
    }
  });
}
async function prepareImagePieces(config) {
  const error = validateImageSplit(config);
  if (error) throw new Error(error);
  const size = await loadSplitterImage(config.imageSource);
  return createImagePieces(config, size.width, size.height);
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  createImagePieces,
  fitImageBounds,
  loadSplitterImage,
  prepareImagePieces,
  resolveSplitterImageSource,
  validateImageSplit
});
