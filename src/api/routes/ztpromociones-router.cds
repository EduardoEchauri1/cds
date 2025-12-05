using { mongodb as myur } from '../models/ztpromociones';

@impl: 'src/api/controllers/ztpromociones-controller.js'

service ZTPromocionesService @(path:'/api/ztpromociones') {
    
    // Entidad básica
    entity Promociones as projection on myur.ZTPROMOCIONES;
    
    // CRUD de Promociones
    @Core.Description: 'CRUD de Promociones con Bitácora'
    @path: 'crudPromociones'
    action crudPromociones(
        ProcessType: String,
        IdPromoOK: String,
        idsPromoOK: array of String, // Para operaciones bulk (DeleteLogicMany, DeleteHardMany, ActivateMany)
        Titulo: String,
        Descripcion: String,
        FechaIni: String,
        FechaFin: String,
        // Nuevos campos para estructura moderna (basado en presentaciones)
        ProductosAplicables: array of {
            IdPresentaOK: String;
            SKUID: String;
            NombreProducto: String;
            NombrePresentacion: String;
            PrecioOriginal: Double;
        },
        CategoriasAplicables: array of String,
        MarcasAplicables: array of String,
        TipoPromocion: String,
        DescuentoPorcentaje: Double,
        DescuentoMonto: Double,
        TipoDescuento: String,
        PermiteAcumulacion: Boolean,
        LimiteUsos: Integer,
        UsosActuales: Integer,
        // Compatibilidad hacia atrás
        IdListaOK: String,
        SKUID: String,
        REGUSER: String,
        MODUSER: String,
        ACTIVED: Boolean,
        DELETED: Boolean
    ) returns array of Promociones;
    
    
    // GET ALL PROMOCIONES
    // POST /api/ztpromociones/crudPromociones?ProcessType=GetFilters&LoggedUser=jlopezm
    
    // GET ONE PROMOCION
    // POST /api/ztpromociones/crudPromociones?ProcessType=GetFilters&type=one&IdPromoOK=PROMO001&LoggedUser=jlopezm
    
    // CREATE PROMOCION
    // POST /api/ztpromociones/crudPromociones?ProcessType=AddMany&LoggedUser=jlopezm
    
    // UPDATE PROMOCION
    // POST /api/ztpromociones/crudPromociones?ProcessType=UpdateMany&IdPromoOK=PROMO001&LoggedUser=jlopezm
    
    // ACTIVATE PROMOCION
    // POST /api/ztpromociones/crudPromociones?ProcessType=UpdateMany&operation=activate&IdPromoOK=PROMO001&LoggedUser=jlopezm
    
    // DELETE LOGIC
    // POST /api/ztpromociones/crudPromociones?ProcessType=DeleteMany&type=logic&IdPromoOK=PROMO001&LoggedUser=jlopezm
    
    // DELETE HARD
    // POST /api/ztpromociones/crudPromociones?ProcessType=DeleteMany&type=hard&IdPromoOK=PROMO001&LoggedUser=jlopezm
}
