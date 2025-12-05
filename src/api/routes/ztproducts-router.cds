using { mongodb as mypr } from '../models/ztproducts';

@impl: 'src/api/controllers/ztproducts-controller.js'

service ZTProductsService @(path:'/api/ztproducts') {
    
    // Entidad básica
    entity Products as projection on mypr.ZTPRODUCTS;
    
    // CRUD de Productos
    @Core.Description: 'CRUD de Productos con Bitácora'
    @path: 'crudProducts'
    action crudProducts(
             id: String,
        ProcessType: String,
        skuidList: many String, // Acepta el array de SKUs desde el frontend
        PRODUCTNAME: String,
        SKUID: String,
        DESSKU: String,
        MARCA: String,
        CATEGORIAS: String,
        IDUNIDADMEDIDA: String,
        BARCODE: String,
        INFOAD: String,
        REGUSER: String,
        MODUSER: String,
        ACTIVED: Boolean,
        DELETED: Boolean,
        partitionKey: String, // Añadimos el campo que faltaba
        
    ) returns array of Products;
    
    
    // GET ALL PRODUCTS
    // POST /api/ztproducts/crudProducts?ProcessType=get&type=all
    
    // GET ONE PRODUCT
    // POST /api/ztproducts/crudProducts?ProcessType=get&type=one&skuid=PROD123
    
    // CREATE PRODUCT
    // POST /api/ztproducts/crudProducts?ProcessType=post
    
    // UPDATE PRODUCT
    // POST /api/ztproducts/crudProducts?ProcessType=put&operation=update&skuid=PROD123
    
    // ACTIVATE PRODUCT
    // POST /api/ztproducts/crudProducts?ProcessType=put&operation=activate&skuid=PROD123
    // POST /api/ztproducts/crudProducts?ProcessType=activate&skuid=PROD123
    
    // DELETE LOGIC
    // POST /api/ztproducts/crudProducts?ProcessType=delete&type=soft&skuid=PROD123
    // POST /api/ztproducts/crudProducts?ProcessType=delete&type=logic&skuid=PROD123
    
    // DELETE HARD
    // POST /api/ztproducts/crudProducts?ProcessType=delete&type=hard&skuid=PROD123
}
