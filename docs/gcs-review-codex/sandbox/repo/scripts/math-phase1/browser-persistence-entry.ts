import {projectPersistenceService} from '../../src/services/ProjectPersistenceService';
(globalThis as any).mathProbePersistence={save:(project:any)=>projectPersistenceService.saveProject(project)};
