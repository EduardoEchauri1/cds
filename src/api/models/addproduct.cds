namespace addproduct_def;

// Estructura para los datos del producto
type ProductData {
    SKUID          : String(100);
    PRODUCTNAME    : String(255);
    DESSKU         : String(255);
    MARCA          : String(100);
    IDUNIDADMEDIDA : String(50);
    CATEGORIAS     : many String;
    BARCODE        : String(100);
    INFOAD         : String(255);
}

// Estructura para los datos de un archivo
type FileData {
    fileBase64   : LargeString;
    FILETYPE     : String(10); // IMG, PDF, etc.
    originalname : String(255);
    mimetype     : String(100);
    PRINCIPAL    : Boolean;
    INFOAD       : String(255);
}

// Estructura para los datos de una presentación
type PresentationData {
    IdPresentaOK : String(100);
    NOMBREPRESENTACION : String(255);
    Descripcion  : String(255);
    PropiedadesExtras : LargeString; // Representa un objeto JSON como string
    files        : many FileData;
}