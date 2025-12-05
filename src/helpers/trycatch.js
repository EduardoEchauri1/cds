async function executeMethod(bitacora, method) {
    try {
        const result = await method();
        const data = DATA();
        data.dataRes = result;
        return AddMSG(bitacora, data, 'OK');
    } catch (error) {
        const data = DATA();
        data.messageUSR = 'Error al ejecutar operación';
        data.messageDEV = error.message;
        return AddMSG(bitacora, data, 'FAIL');
    }
}
