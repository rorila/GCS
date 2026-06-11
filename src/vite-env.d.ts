/// <reference types="vite/client" />

import type { Editor } from './editor/Editor';
import type { HelpOverlay } from './editor/HelpOverlay';
import type { GameProject } from './model/types';

declare global {
  interface Window {
    /** Haupt-Editor-Instanz */
    editor: Editor;
    /** HelpOverlay Singleton für Ctrl+Klick auf Links */
    helpOverlay: HelpOverlay;
    /** Aktuell geladenes Projekt (Runtime) */
    PROJECT: GameProject;
    /** Electron FileSystem Adapter (nur in Electron-Builds) */
    electronFS?: {
      readFile: (path: string) => Promise<string>;
      writeFile: (path: string, data: string) => Promise<void>;
      exists: (path: string) => Promise<boolean>;
      mkdir: (path: string) => Promise<void>;
      readdir: (path: string) => Promise<string[]>;
    };
    /** Tauri FS API (nur in Tauri-Builds) */
    tauriFS?: {
      readTextFile: (path: string) => Promise<string>;
      writeTextFile: (path: string, contents: string) => Promise<void>;
      exists: (path: string) => Promise<boolean>;
      createDir: (path: string, options?: { recursive?: boolean }) => Promise<void>;
      readDir: (path: string) => Promise<{ name: string; isFile: boolean; isDirectory: boolean }[]>;
    };
  }
}

export {};
