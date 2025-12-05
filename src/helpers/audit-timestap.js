// helpers/audit-timestap.js
/**
 * Actualiza o crea un documento en Mongo con campos de auditoría.
 * @param {mongoose.Model} model - Modelo de Mongoose
 * @param {Object} filter - Filtro para encontrar el documento
 * @param {Object} data - Datos a guardar
 * @param {String} user - Usuario que realiza la acción
 * @param {String} action - CREATE o UPDATE
 * @returns {Promise<Object>} Documento actualizado o creado
 */
async function saveWithAudit(model, filter, data, user, action) {
  const now = new Date();

  if (action === 'CREATE') {
    const newDoc = new model({
      ...data,
      REGUSER: user,
      REGDATE: now,
    });
    await newDoc.save();
    return newDoc.toObject();
  }

  if (action === 'UPDATE') {
    // 1. Encontrar el documento
    const docToUpdate = await model.findOne(filter);
    if (!docToUpdate) throw new Error('Documento no encontrado para actualizar');

    // 2. Asignar los nuevos datos y los campos de auditoría
    Object.assign(docToUpdate, data);
    docToUpdate.MODUSER = user;
    docToUpdate.MODDATE = now;

    // 3. Guardar el documento. Esto disparará el middleware pre('save') del modelo.
    await docToUpdate.save();

    // 4. Devolver el documento actualizado como un objeto plano
    return docToUpdate.toObject();
  }

  throw new Error('Acción no soportada: ' + action);
}

module.exports = { saveWithAudit };
