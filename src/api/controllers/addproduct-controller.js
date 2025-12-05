const cds = require('@sap/cds');
const { addProductWithPresentations } = require('../services/addproduct-service');

class AddProductService extends cds.ApplicationService {
  async init() {

    this.on('createCompleteProduct', async (req) => {
      try {
        const result = await addProductWithPresentations(req);

        // Si el servicio ya manejó la respuesta (ej. error), no hacer nada más
        if (!result) return;

        // Si no hay objeto de respuesta HTTP (llamada interna), devolver el resultado
        if (!req.http?.res) {
          return result;
        }

        // Para éxito, devolver 201 Created con el resultado
        req.http.res.status(result.status || 201).send(result);

      } catch (error) {
        console.error("Error en el controlador 'createCompleteProduct':", error);
        req.error(error.code || 500, error.message);
      }
    });

    return super.init();
  }
}

module.exports = AddProductService;