namespace mongodb;

entity ZTPRECIOS_LISTAS {
  key IDLISTAOK            : String(64);      // Identificador único de lista
      IDINSTITUTOOK        : String(64);      // Identificador de institución
      IDLISTABK            : String(64);      // Identificador alternativo
      DESLISTA             : String(255);     // Descripción de la lista
      SKUSIDS              : LargeString;     // Arreglo de SKUs (como JSON string)
      FECHAEXPIRAINI       : Date;            // Fecha inicio de validez
      FECHAEXPIRAFIN       : Date;            // Fecha fin de validez
      IDTIPOLISTAOK        : String(64);      // Tipo de lista
      IDTIPOGENERALISTAOK  : String(64);      // Generación de lista
      IDTIPOFORMULAOK      : String(64);      // Tipo de fórmula aplicada
      ACTIVED              : Boolean;         // Estado activo/inactivo
      DELETED              : Boolean;         // Borrado lógico
      REGUSER              : String(64);      // Usuario que registró
      REGDATE              : DateTime;        // Fecha de registro
      MODUSER              : String(64);      // Usuario que modificó
      MODDATE              : DateTime;        // Fecha de modificación
      CREATEDAT            : DateTime;        // Fecha de creación (sistema)
      UPDATEDAT            : DateTime;        // Fecha de última actualización (sistema)
}
