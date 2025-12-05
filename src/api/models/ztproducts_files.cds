namespace mongodb;

entity ZTPRODUCTS_FILES {
  key FILEID       : String(64);
      SKUID        : String(64);
      IdPresentaOK : String(64);
      FILETYPE     : String(16);
      FILE         : String;
      PRINCIPAL    : Boolean;

      INFOAD       : String;
      REGUSER      : String(64);
      REGDATE      : DateTime;
      MODUSER      : String(64);
      MODDATE      : DateTime;
      ACTIVED      : Boolean;
      DELETED      : Boolean;
      createdAt    : DateTime;
      updatedAt    : DateTime;
}
