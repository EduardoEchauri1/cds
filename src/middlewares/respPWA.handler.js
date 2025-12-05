const { whatTypeVarIs } = require('../helpers/variables');


const BITACORA = () => {

    const bitacora = {
        success         : false,
        status          : 0,
        process         : '',
        processType     : '',
        messageUSR      : '',
        messageDEV      : '',
        countData       : 0,
        countDataReq    : 0,
        countDataRes    : 0,
        countMsgUSR     : 0,
        countMsgDEV     : 0,
        dbServer        : '',
        server          : '',
        data            : [],
        loggedUser      : '',
        finalRes        : false
    };

    return bitacora;
};

const DATA = () => {

    const data = {
        success         : false,
        status          : 0,
        process         : '',
        processType     : '',
        principal       : false,
        secuencia       : 0,
        countDataReq    : 0,
        countDataRes    : 0,
        countFile       : 0,
        messageUSR      : '',
        messageDEV      : '',
        method          : '',
        api             : '',
        dataReq         : [],
        dataRes         : [],
        file            : []
    };

    return data;
};

const AddMSG = (bitacora, data, tipo, status = 500, principal = false) => {

    if (tipo === 'OK') {
        data.success = data.success     || true;
        bitacora.success = data.sucess  || true;
    } else {
        data.success = data.success     || false;
        bitacora.success = data.sucess  || false;
    }

    data.status      = data.status       || status;
    data.process     = data.process      || 'No Especificado';
    data.processType = data.processType  || 'No Especificado';
    data.principal   = data.principal    || principal;
    data.method      = data.method       || 'No Especificado';
    data.api         = data.api          || 'No Especificado';

    data.secuencia++;

    if (data.messageDEV) {
        bitacora.messageDEV = data.messageDEV;
        bitacora.countMsgDEV++;
    };

    if (data.messageUSR) {
        bitacora.messageUSR = data.messageUSR;
        bitacora.countMsgUSR++;
    };

    if (data.dataReq) {
        //data.countDataReq++;
        //if(data.dataReq.length)
        //     data.countDataReq = data.dataReq.length;
        // else
        //     data.countDataReq = 0;

        if (whatTypeVarIs(data.dataReq)==='isArray')
            data.countDataReq = data.dataReq.length;
        else if (whatTypeVarIs(data.dataReq)==='isObject')
            data.countDataReq = 1;
        else if (whatTypeVarIs(data.dataReq)===null)
            data.countDataReq = 0;

        bitacora.countDataReq++;
    }

    if (data.dataRes) {
        //data.countDataRes++;
        //FIC: if length is not defined, it goes to else 
        //because data is an object and not an array 
        //if(data.dataRes.length)
        //   data.countDataRes = data.dataRes.length;
        //else
        //    data.countDataRes = 1;   
        
        if (whatTypeVarIs(data.dataRes)==='isArray')
            data.countDataRes = data.dataRes.length;
        else if (whatTypeVarIs(data.dataRes)==='isObject')
            data.countDataRes = 1;
        else if (whatTypeVarIs(data.dataRes)===null)
            data.countDataRes = 0;
            
        bitacora.countDataRes++;
    };

    if (data.file) {
        if (whatTypeVarIs(data.countFile)==='isArray')
            data.countFile = data.countFile.length;
        else if (whatTypeVarIs(data.countFile)==='isObject')
            data.countFile = 1;
        else if (whatTypeVarIs(data.countFile)===null)
            data.countFile = 0;
    };

    bitacora.status = data.status;
    bitacora.data.push(data);
    bitacora.countData++;

    return bitacora;
};

const OK = (bitacora) => {

    if (!bitacora.dbServer)
        bitacora.dbServer= dbServer = process.env.CONNECTION_TO_HANA;

    return {
        success         : bitacora.success      || true,
        status          : bitacora.status       || 500,
        process         : bitacora.process      || 'No Especificado',
        processType     : bitacora.processType  || 'No Especificado',
        messageUSR      : bitacora.messageUSR   || 'No Especificado',
        messageDEV      : bitacora.messageDEV   || 'No Especificado',
        countData       : bitacora.countData    || 0,
        countDataReq    : bitacora.countDataReq || 0,
        countDataRes    : bitacora.countDataRes || 0,
        countMsgUSR     : bitacora.countMsgUSR  || 0,
        countMsgDEV     : bitacora.countMsgDEV  || 0,
        dbServer        : bitacora.dbServer     || 'Default',
        server          : bitacora.server       || 'Default',
        data            : bitacora.data         || [],
        session         : bitacora.session      || 'No Especificado',
        loggedUser      : bitacora.loggedUser   || 'No Especificado',
        finalRes        : bitacora.finalRes     || false
    }
};

const FAIL = (bitacora) => {

    if (!bitacora.dbServer)
        bitacora.dbServer= dbServer = process.env.CONNECTION_TO_HANA;

    return {
        success         : bitacora.success      || false,
        status          : bitacora.status       || 500,
        process         : bitacora.process      || 'No Especificado',
        processType     : bitacora.processType  || 'No Especificado',
        messageUSR      : bitacora.messageUSR   || 'No Especificado',
        messageDEV      : bitacora.messageDEV   || 'No Especificado',
        countData       : bitacora.countData    || 0,
        countDataReq    : bitacora.countDataReq || 0,
        countDataRes    : bitacora.countDataRes || 0,
        countMsgUSR     : bitacora.countMsgUSR  || 0,
        countMsgDEV     : bitacora.countMsgDEV  || 0,
        dbServer        : bitacora.dbServer     || 'Default',
        server          : bitacora.server       || 'Default',
        data            : bitacora.data         || [],
        session         : bitacora.session      || 'No Especificado',
        loggedUser      : bitacora.loggedUser   || 'No Especificado',
        finalRes        : bitacora.finalRes     || false
    }
};

const TRANSOPTIONS = () => {

    const transactionOptions = {
        readPreference: 'primary',
        //readPreference: 'secondary',
        readConcern: {level: 'local'},
        writeConcern: {w: 'majority'},
        maxCommitTimeMS: 1000
    };

    return transactionOptions;
};

module.exports = {
    BITACORA,
    DATA,
    AddMSG,
    OK,
    FAIL
}