#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .plugin(prevent_default())
    .plugin(tauri_plugin_fs::init())
    .plugin(tauri_plugin_dialog::init())
    .setup(|app| {
      app.handle().plugin(
        tauri_plugin_log::Builder::default()
          .level(if cfg!(debug_assertions) { log::LevelFilter::Info } else { log::LevelFilter::Warn })
          .build(),
      )?;
      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}

/// Dev-Mode: DevTools (F12) und Reload (F5/Ctrl+R) bleiben aktiv, alle anderen
/// Browser-Shortcuts (inkl. Ctrl+D, Ctrl+F, Ctrl+P usw.) werden blockiert.
#[cfg(debug_assertions)]
fn prevent_default() -> tauri::plugin::TauriPlugin<tauri::Wry> {
  use tauri_plugin_prevent_default::Flags;
  use tauri_plugin_prevent_default::PlatformOptions;
  tauri_plugin_prevent_default::Builder::new()
    .with_flags(Flags::all().difference(Flags::DEV_TOOLS | Flags::RELOAD))
    .platform(PlatformOptions::new().browser_accelerator_keys(false))
    .build()
}

/// Release-Mode: Alle Browser-Shortcuts blockiert.
#[cfg(not(debug_assertions))]
fn prevent_default() -> tauri::plugin::TauriPlugin<tauri::Wry> {
  use tauri_plugin_prevent_default::PlatformOptions;
  tauri_plugin_prevent_default::Builder::new()
    .platform(PlatformOptions::new().browser_accelerator_keys(false))
    .build()
}
