import mongoose from "mongoose";

const ModificationSchema = new mongoose.Schema(
  {
    user: { type: String, required: true },
    date: { type: Date, default: Date.now },
    action: { type: String, enum: ["CREATE", "UPDATE", "DELETE"], required: true },
    changes: { type: Object, default: {} },
  },
  { _id: false }
);

const ZTPRODUCTS_PRESENTACIONES = new mongoose.Schema(
  {
    IdPresentaOK: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    SKUID: {
      type: String,
      required: true,
      trim: true,
      ref: "ZTPRODUCTS",
    },
   NOMBREPRESENTACION: {
      type: String,
      required: true,
      trim: true,
    },
    Descripcion: {
      type: String,
      required: true,
      trim: true,
    },
    PropiedadesExtras: {
      type: Map,
      of: String,
      default: {},
    },

    ACTIVED:  { type: Boolean, default: true },
    DELETED:  { type: Boolean, default: false },

    REGUSER:  { type: String, required: true },
    REGDATE:  { type: Date, default: Date.now },
    MODUSER:  { type: String, default: null },
    MODDATE:  { type: Date, default: null },

    HISTORY: [ModificationSchema],
  },
  {

    timestamps: true,
  }
);

ZTPRODUCTS_PRESENTACIONES.pre("save", function (next) {
  const doc = this;

  const EXCLUDE = new Set([
    "HISTORY",
    "MODUSER",
    "MODDATE",
    "updatedAt",
    "createdAt",
    "__v",
  ]);

  if (doc.isNew) {
    doc.HISTORY.push({
      user: doc.REGUSER,        
      action: "CREATE", 
      changes: doc.toObject(),
    });
  } else {
    
    const modified = doc.modifiedPaths().reduce((acc, path) => {
      if (!EXCLUDE.has(path)) {
        acc[path] = doc.get(path);
      }
      return acc;
    }, {});

    if (Object.keys(modified).length > 0) {
      doc.MODDATE = new Date(); 
      doc.HISTORY.push({
        user: doc.MODUSER || "system",
        action: "UPDATE",
        changes: modified,
      });
    }
  }

  next();
});

export const ZTProducts_Presentaciones = mongoose.model(
  "ZTPRODUCTS_PRESENTACIONES",
  ZTPRODUCTS_PRESENTACIONES,
  "ZTPRODUCTS_PRESENTACIONES"
);
