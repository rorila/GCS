/** Dateiübertragung ist von GameProject-Persistenz (IStorageAdapter) getrennt. */
export interface IUploadAdapter {
 choose(accept:string,selected:(file:File|null)=>void):()=>void;
 send(endpoint:string,file:File,metadata:Record<string,string>,token:string,progress:(value:number)=>void,signal:AbortSignal):Promise<any>;
}
