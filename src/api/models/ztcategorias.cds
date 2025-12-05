namespace mongodb;


entity ZTCATEGORIAS {
    key CATID       : String(64);
        Nombre      : String(128);
        PadreCATID  : String(64);
        ACTIVED     : Boolean;
        DELETED     : Boolean;
        REGUSER     : String(64);
        REGDATE     : DateTime;
        MODUSER     : String(64);
        MODDATE     : DateTime;
        createdAt   : DateTime;
        updatedAt   : DateTime;
}
