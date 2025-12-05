using { mongodb as myur } from '../models/ztcategorias';

@impl: 'src/api/controllers/ztcategorias-controller.js'

service ZTCategoriasService @(path:'/api/ztcategorias') {
    
    // Entidad básica
    entity Categorias as projection on myur.ZTCATEGORIAS;
    
    // CRUD de Categorías
    @Core.Description: 'CRUD de Categorías con Bitácora'
    @path: 'categoriasCRUD'
    action categoriasCRUD(
        ProcessType: String,
        LoggedUser: String,
        DBServer: String,
        CATID: String,         // <-- cambiado a CATID (mayúsculas)
        Nombre: String,
        PadreCATID: String,
        ACTIVED: Boolean,
        DELETED: Boolean,
        REGUSER: String
    ) returns array of Categorias;
    
    
    // === EJEMPLOS DE USO ===
    // GET ALL CATEGORIAS
    // POST /api/ztcategorias/categoriasCRUD?ProcessType=GetAll&LoggedUser=jlopezm
    
    // GET ONE CATEGORIA
    // POST /api/ztcategorias/categoriasCRUD?ProcessType=GetOne&catid=CAT_001&LoggedUser=jlopezm
    
    // CREATE CATEGORIA
    // POST /api/ztcategorias/categoriasCRUD?ProcessType=AddOne&LoggedUser=jlopezm
    
    // UPDATE CATEGORIA
    // POST /api/ztcategorias/categoriasCRUD?ProcessType=UpdateOne&catid=CAT_001&LoggedUser=jlopezm
    
    // ACTIVATE CATEGORIA
    // POST /api/ztcategorias/categoriasCRUD?ProcessType=Activate&catid=CAT_001&LoggedUser=jlopezm
    
    // DELETE LOGIC
    // POST /api/ztcategorias/categoriasCRUD?ProcessType=DeleteLogic&catid=CAT_001&LoggedUser=jlopezm
    
    // DELETE HARD
    // POST /api/ztcategorias/categoriasCRUD?ProcessType=DeleteHard&catid=CAT_001&LoggedUser=jlopezm
}