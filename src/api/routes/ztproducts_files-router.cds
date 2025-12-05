using { mongodb as myur } from '../models/ztproducts_files';

@impl: 'src/api/controllers/ztproducts_files-controller.js'

service ZTProductFilesService @(path:'/api/ztproducts-files') {
    
    // Entidad básica
    entity Files as projection on myur.ZTPRODUCTS_FILES;
    
    // CRUD de Archivos de Productos
    @Core.Description: 'CRUD de Archivos de Productos'
    @path: 'productsFilesCRUD'
    action productsFilesCRUD(
        ProcessType: String,
        fileBase64: String,
        SKUID: String,
        FILETYPE: String,
        REGUSER: String,
        originalname: String,
        mimetype: String,
        INFOAD: String,
        PRINCIPAL: Boolean,
        SECUENCE: Integer,
        IdPresentaOK: String,
        FILE: String,
        ACTIVED: Boolean,
        DELETED: Boolean
    ) returns array of Files;
    
    
}