// Der frühere kombinierte Verwaltungsdialog wurde durch getrennte HouseAdmin-
// und RaumAdmin-Arbeitsbereiche ersetzt. Dieser Kompatibilitäts-Einstieg führt
// deshalb die aktuelle Rollen-, Rechte- und Browserprüfung aus.
const path=require('node:path'),{spawnSync}=require('node:child_process');
const target=path.join(__dirname,'test-cms-role-workspaces.cjs');
const result=spawnSync(process.execPath,[target],{stdio:'inherit'});
process.exitCode=result.status??1;
