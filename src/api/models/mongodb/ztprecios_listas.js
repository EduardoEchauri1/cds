const mongoose = require("mongoose");

// ============================================
// ESQUEMA DE HISTORIAL DE MODIFICACIONES
// ============================================
const ModificationSchema = new mongoose.Schema(
  {
    user: { type: String, required: true },
    date: { type: Date, default: Date.now },
    action: { type: String, enum: ["CREATE", "UPDATE", "DELETE"], required: true },
    changes: { type: Object, default: {} },
  },
  { _id: false }
);

// ============================================
// ESQUEMA PRINCIPAL: ZTPRECIOS_LISTAS
// ============================================
const ZTPRECIOS_LISTAS = new mongoose.Schema({
  IDLISTAOK: { type: String, required: true, unique: true, trim: true },
  IDINSTITUTOOK: { type: String, trim: true },
  IDLISTABK: { type: String, trim: true },

  SKUSIDS: { type: [String], default: [] },

  DESLISTA: { type: String, required: true, trim: true },
  FECHAEXPIRAINI: { type: Date, required: true },
  FECHAEXPIRAFIN: { type: Date, required: true },
  IDTIPOLISTAOK: { type: String, trim: true },
  IDTIPOGENERALISTAOK: { type: String, trim: true },
  IDTIPOFORMULAOK: { type: String, trim: true },
  REGUSER: { type: String, required: true },
  REGDATE: { type: Date, default: Date.now },
  MODUSER: { type: String },
  MODDATE: { type: Date },
  ACTIVED: { type: Boolean, default: true },
  DELETED: { type: Boolean, default: false },
  HISTORY: [ModificationSchema],
});

// ============================================
// MIDDLEWARE PARA GUARDAR HISTORIAL DE CAMBIOS
// ============================================
ZTPRECIOS_LISTAS.pre("save", function (next) { //// Se ejecuta ANTES de guardar un documento
  const doc = this; //// El documento actual

  if (doc.isNew) { // // ← ES UN DOCUMENTO NUEVO (INSERT)
    doc.HISTORY.push({ //agrega un nuevo registro al array History del doc
      user: doc.REGUSER, //aqui se ve el usuario que creó el documento
      action: "CREATE", //identifica el tipo de operacion que se realizó en este caso crear
      changes: doc.toObject(), //Convierte el documento de Mongoose a un objeto JavaScript plano.
    });
  } else { //  // ← ES UNA ACTUALIZACIÓN EXISTENTE (UPDATE)
    const modifiedFields = doc.modifiedPaths().reduce((acc, path) => {
      // doc.modifiedPaths() : función de Mongoose que retorna un array de los campos que fueron modificados.
      //solo registra en HISTORY qué campos cambiaron, no todo el documento.
      if (!["HISTORY", "MODUSER", "MODDATE"].includes(path)) {
        acc[path] = doc.get(path); //Agrega el campo al objeto acumulador con su nuevo valor.
      //doc.get() es el método de Mongoose para obtener el valor actual del documento.
      }
      return acc; //Retorna el acumulador para que se use en la siguiente iteración.
    }, {});

    if (Object.keys(modifiedFields).length > 0) { //Verifica si hay cambios reales que registrar.
      doc.MODDATE = new Date(); //Actualiza la fecha de última modificación.
      //se ejecuta dentro de if,  osea solo si hay cambios
      doc.HISTORY.push({ //Agrega un nuevo registro al array de historial.
        //HISTORY: array que guarda todos los datos
        user: doc.MODUSER || "system", //registra quien hizo el cambio
        action: "UPDATE", //el documento ya existia y se modificó 
        changes: modifiedFields, //Registra QUÉ campos cambiaron y sus nuevos valores.
      });
    }
  }

  next(); //Permite continuar al siguiente paso (guardar en BD).
});

// ============================================
// EXPORTACIÓN DEL MODELO (CommonJS)
// ============================================
module.exports = mongoose.model("ZTPRECIOS_LISTAS", ZTPRECIOS_LISTAS, "ZTPRECIOS_LISTAS");
