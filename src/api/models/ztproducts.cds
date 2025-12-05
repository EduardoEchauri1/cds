namespace mongodb;

entity ZTPRODUCTS {
  key id        : String(100); // Clave principal para compatibilidad con CAP y Cosmos DB
  @odata.etag
  SKUID         : String(100); // Mantenemos SKUID como identificador de negocio
  PRODUCTNAME   : String(255);
  DESSKU        : String(255);
  MARCA         : String(100);
  CATEGORIAS    : many String;
  IDUNIDADMEDIDA: String(50);
  BARCODE       : String(100);
  INFOAD        : String(255);
  REGUSER       : String(100);
  REGDATE       : DateTime;
  MODUSER       : String(100);
  MODDATE       : DateTime;
  ACTIVED       : Boolean;
  DELETED       : Boolean;

}
