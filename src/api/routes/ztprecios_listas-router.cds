using { mongodb as myur } from '../models/ztprecios_listas';

@impl: 'src/api/controllers/ztprecios_listas-controller.js'
//Define un servicio (una API) con su ruta.
service ZTPreciosListasService @(path:'/api/ztprecios-listas') {

  // Entidad principal
  entity PreciosListas as projection on myur.ZTPRECIOS_LISTAS;

  // CRUD de Listas de Precios
  @Core.Description: 'CRUD de Listas de Precios'
  @path: 'preciosListasCRUD'
  action preciosListasCRUD( //Define los parámetros que el cliente debe enviar.
    ProcessType: String,
    IDLISTAOK: String,
    IDINSTITUTOOK: String,
    IDLISTABK: String,
    DESLISTA: String,
    FECHAEXPIRAINI: Date,
    FECHAEXPIRAFIN: Date,
    IDTIPOLISTAOK: String,
    IDTIPOGENERALISTAOK: String,
    IDTIPOFORMULAOK: String,
    skuid: String,
    SKUSIDS: LargeString,
    REGUSER: String,
    ACTIVED: Boolean,
    DELETED: Boolean
  ) returns array of PreciosListas;

  // Acción para actualizar SKUSIDs . Otra acción para actualizar solo los SKUs.
  @Core.Description: 'Actualiza los SKUs de una Lista de Precios'
  @path: 'updateSKUSIDs'
  action updateSKUSIDs(
    IDLISTAOK: String,
    SKUSIDS: LargeString
  ) returns PreciosListas;

  // Ejemplos de uso 
  // GET ALL LISTAS
  // POST /api/ztprecios-listas/preciosListasCRUD?ProcessType=GetAll

  // GET ONE LISTA
  // POST /api/ztprecios-listas/preciosListasCRUD?ProcessType=GetOne&IDLISTAOK=LISTA001

  // CREATE LISTA
  // POST /api/ztprecios-listas/preciosListasCRUD?ProcessType=AddOne

  // UPDATE LISTA
  // POST /api/ztprecios-listas/preciosListasCRUD?ProcessType=UpdateOne&IDLISTAOK=LISTA001

  // DELETE LOGIC
  // POST /api/ztprecios-listas/preciosListasCRUD?ProcessType=DeleteLogic&IDLISTAOK=LISTA001

  // DELETE HARD
  // POST /api/ztprecios-listas/preciosListasCRUD?ProcessType=DeleteHard&IDLISTAOK=LISTA001

  // ACTIVATE LISTA
  // POST /api/ztprecios-listas/preciosListasCRUD?ProcessType=ActivateOne&IDLISTAOK=LISTA001
}
