namespace mongodb;

entity ZTPROMOCIONES {
  key IdPromoOK    : String(100);
  Titulo           : String(255);
  Descripcion      : String(500);
  FechaIni         : DateTime;
  FechaFin         : DateTime;
  
  // PRODUCTOS APLICABLES - Array de objetos (ahora basado en presentaciones)
  ProductosAplicables : array of {
    IdPresentaOK   : String(100);
    SKUID          : String(100);
    NombreProducto : String(255);
    NombrePresentacion : String(255);
    PrecioOriginal : Double;
  };
  
  // CATEGORÍAS Y MARCAS APLICABLES
  CategoriasAplicables : array of String(100);
  MarcasAplicables     : array of String(100);
  
  // TIPO DE PROMOCIÓN
  TipoPromocion    : String(50); // PRODUCTO_ESPECIFICO, CATEGORIA, MARCA, GENERAL
  
  // DESCUENTO
  DescuentoPorcentaje : Double;
  DescuentoMonto      : Double;
  TipoDescuento       : String(20); // PORCENTAJE, MONTO_FIJO
  
  // CONFIGURACIÓN ADICIONAL
  PermiteAcumulacion  : Boolean;
  LimiteUsos          : Integer;
  UsosActuales        : Integer;
  
  // COMPATIBILIDAD HACIA ATRÁS
  SKUID            : String(100);
  IdListaOK        : String(100);
  
  // AUDITORÍA Y CONTROL
  ACTIVED          : Boolean;
  DELETED          : Boolean;
  REGUSER          : String(100);
  REGDATE          : DateTime;
  MODUSER          : String(100);
  MODDATE          : DateTime;
  createdAt        : DateTime;
  updatedAt        : DateTime;
}