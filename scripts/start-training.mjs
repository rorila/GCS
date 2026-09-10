// Bewusst gewählter lokaler Start mit freigeschalteter Trainings-API.
process.env.GCS_TRAINING_ENABLED = '1';
await import('./start-local.mjs');
