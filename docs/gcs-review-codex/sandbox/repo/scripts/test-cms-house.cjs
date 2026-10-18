// Das aktuelle HouseAdmin-Modell wird in test-cms-role-model.cjs geprüft:
// Hausgrenzen, Bewohner, getrennte Raumzuordnung und die echte GCS-Oberfläche.
const path=require('node:path'),{spawnSync}=require('node:child_process');
const target=path.join(__dirname,'test-cms-role-model.cjs');
const result=spawnSync(process.execPath,[target],{stdio:'inherit'});
process.exitCode=result.status??1;
