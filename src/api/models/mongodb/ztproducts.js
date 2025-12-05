const mongoose = require('mongoose');

// Schema para registrar modificaciones (historial de auditoría)
const ModificationSchema = new mongoose.Schema(
  {
    user: { type: String, required: true },
    date: { type: Date, default: Date.now },
    action: { type: String, enum: ["CREATE", "UPDATE", "DELETE"], required: true },
    changes: { type: Object, default: {} }, // campos que cambiaron
  },
  { _id: false }
);

const ZTProductSchema = new mongoose.Schema({
  SKUID: { 
    type: String, 
    required: true, 
    unique: true,   // Identificador único
    trim: true 
  },
  PRODUCTNAME: { 
    type: String, 
    required: true, 
    trim: true 
  },
  DESSKU: { 
    type: String, 
    required: true, 
    trim: true 
  },
  MARCA: {
    type: String,
    trim: true,
    default: ''
  },
  CATEGORIAS: [{ type: String, ref: "ZTCATEGORIAS" }],

  IDUNIDADMEDIDA: { 
    type: String, 
    required: true 
  },
  BARCODE: { 
    type: String, 
    index: true,   // Índice para búsquedas rápidas
    unique: true,
    sparse: true   // Evita conflictos si hay productos sin código de barras
  },
    INFOAD: {
      type: String,
      default: "",
    },
  REGUSER: { 
    type: String, 
    required: true 
  },
  REGDATE: { 
    type: Date, 
    default: Date.now 
  },
  MODUSER: { 
    type: String, 
    default: null 
  },
  MODDATE: { 
    type: Date, 
    default: null 
  },
  ACTIVED: { 
    type: Boolean, 
    default: true 
  },
  DELETED: { 
    type: Boolean, 
    default: false 
  },
  HISTORY: [ModificationSchema]
}, { 

});


ZTProductSchema.pre("save", function (next) {
  const doc = this;

  if (doc.isNew) {
    // Registro inicial
    doc.HISTORY.push({
      user: doc.REGUSER,
      action: "CREATE",
      changes: doc.toObject(),
    });
  } else {
    // Actualización
    const modifiedFields = doc.modifiedPaths().reduce((acc, path) => {
      if (!["HISTORY", "MODUSER", "MODDATE", "updatedAt"].includes(path)) {
        acc[path] = doc.get(path);
      }
      return acc;
    }, {});

    if (Object.keys(modifiedFields).length > 0) {
      doc.MODDATE = new Date(); // actualizar MODDATE
      doc.HISTORY.push({
        user: doc.MODUSER || "system",
        action: "UPDATE",
        changes: modifiedFields,
      });
    }
  }

  next();
});

// Exportar el modelo
module.exports = mongoose.model('ZTPRODUCTS', ZTProductSchema, 'ZTPRODUCTS');
