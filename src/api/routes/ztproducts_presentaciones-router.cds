using { mongodb as myur } from '../models/ztproducts_presentaciones';

@impl: 'src/api/controllers/ztproducts_presentaciones-controller.js'

service ZTProductsPresentacionesService @(path:'/api/ztproducts-presentaciones') {
  entity Presentaciones as projection on myur.ZTPRODUCTS_PRESENTACIONES;

  @Core.Description: 'CRUD de Presentaciones de Productos'
  @path: 'productsPresentacionesCRUD'
  action productsPresentacionesCRUD(
    ProcessType    : String,
    IdPresentaOK   : String,
    SKUID          : String,
    NOMBREPRESENTACION : String,
    Descripcion    : String,
    ACTIVED        : Boolean,
    DELETED        : Boolean,
    REGUSER        : String,
    PropiedadesExtras : LargeString,
    files          : many myur.FileData,
    MODUSER        : String
  ) returns array of Presentaciones;

}
