using { mongodb as myur } from '../models/ztprecios_items';
@impl: 'src/api/controllers/ztprecios_items-controller.js'
service ZTPreciosItemsService @(path:'/api/ztprecios-items') {
  entity PreciosItems as projection on myur.ZTPRECIOS_ITEMS;
  @Core.Description: 'CRUD de Precios de Productos'
  @path: 'preciosItemsCRUD'
  action preciosItemsCRUD(
    ProcessType     : String,      
    IdPrecioOK      : String,
    IdListaOK       : String,
    SKUID           : String,
    IdPresentaOK    : String,
    IdTipoFormulaOK : String,
    Formula         : String,
    CostoIni        : Decimal(15,2),
    CostoFin        : Decimal(15,2),
    Precio          : Decimal(15,2),
    ACTIVED         : Boolean,
    DELETED         : Boolean,
    REGUSER         : String
  ) returns array of PreciosItems;
}