namespace mongodb;
entity ZTPRECIOS_ITEMS {
  key IdPrecioOK     : String(64);
      IdListaOK      : String(64);
      SKUID          : String(64);
      IdPresentaOK   : String(64);
      IdTipoFormulaOK: String(64);
      Formula        : String;
      CostoIni       : Decimal(15,2);
      CostoFin       : Decimal(15,2);
      Precio         : Decimal(15,2);
      REGUSER        : String(64);
      REGDATE        : DateTime;
      MODUSER        : String(64);
      MODDATE        : DateTime;
      ACTIVED        : Boolean;
      DELETED        : Boolean;
      createdAt      : DateTime;
      updatedAt      : DateTime;
}
