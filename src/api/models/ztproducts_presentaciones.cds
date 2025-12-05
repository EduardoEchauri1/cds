namespace mongodb;

type FileData {
    fileBase64   : LargeString; 
    FILETYPE     : String(10);
    originalname : String(255);
    mimetype     : String(100);
    PRINCIPAL    : Boolean;
    INFOAD       : String(255);
}

entity ZTPRODUCTS_PRESENTACIONES {
  key IdPresentaOK : String(64);
      NOMBREPRESENTACION : String;
      SKUID        : String(64);
      Descripcion  : String;
    
      ACTIVED      : Boolean;
      DELETED      : Boolean;
      REGUSER      : String(64);
      REGDATE      : DateTime;
      MODUSER      : String(64);
      MODDATE      : DateTime;
      createdAt    : DateTime;
      updatedAt    : DateTime;
      PropiedadesExtras : LargeString;
      files        : many FileData;
}
