const mongoose = require('mongoose');

const ZTPromocionesSchema = new mongoose.Schema({
  IdPromoOK: { 
    type: String, 
    required: true, 
    unique: true,   // Identificador único
    trim: true 
  },
  Titulo: { 
    type: String, 
    required: true, 
    trim: true 
  },
  Descripcion: { 
    type: String, 
    required: false,
    trim: true 
  },
  FechaIni: { 
    type: Date, 
    required: true 
  },
  FechaFin: { 
    type: Date, 
    required: true 
  },
  // PRESENTACIONES APLICABLES - Array de presentaciones con sus productos
  ProductosAplicables: [{
    IdPresentaOK: { 
      type: String, 
      required: false,
      trim: true 
    },
    SKUID: { 
      type: String, 
      required: true,
      trim: true 
    },
    NombreProducto: { 
      type: String, 
      trim: true 
    },
    NombrePresentacion: { 
      type: String, 
      trim: true 
    },
    PrecioOriginal: { 
      type: Number,
      min: 0
    }
  }],
  // DESCUENTO
  DescuentoPorcentaje: { 
    type: Number,
    min: 0,
    max: 100,
    default: 0
  },
  DescuentoMonto: {
    type: Number,
    min: 0,
    default: 0
  },
  TipoDescuento: {
    type: String,
    enum: ['PORCENTAJE', 'MONTO_FIJO'],
    default: 'PORCENTAJE'
  },
  // CONFIGURACIÓN ADICIONAL
  PermiteAcumulacion: {
    type: Boolean,
    default: false
  },
  LimiteUsos: {
    type: Number,
    min: 0,
    default: null
  },
  UsosActuales: {
    type: Number,
    min: 0,
    default: 0
  },
  // AUDITORÍA Y CONTROL
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
  }
}, { 
  timestamps: true  // Maneja automáticamente createdAt y updatedAt
});

// Validación personalizada: debe tener al menos productos, categorías o marcas aplicables
ZTPromocionesSchema.pre('validate', function(next) {
  const hasProducts = this.ProductosAplicables && this.ProductosAplicables.length > 0;
  const hasCategories = this.CategoriasAplicables && this.CategoriasAplicables.length > 0;
  const hasBrands = this.MarcasAplicables && this.MarcasAplicables.length > 0;
  const hasLegacySKUID = this.SKUID;
  const hasLegacyIdLista = this.IdListaOK;
  
  if (!hasProducts && !hasCategories && !hasBrands && !hasLegacySKUID && !hasLegacyIdLista) {
    return next(new Error('Debe especificar al menos productos, categorías, marcas aplicables, o mantener compatibilidad con SKUID/IdListaOK'));
  }
  next();
});

// Validación de fechas: FechaFin debe ser mayor que FechaIni
ZTPromocionesSchema.pre('validate', function(next) {
  if (this.FechaFin <= this.FechaIni) {
    return next(new Error('La fecha fin debe ser posterior a la fecha inicio'));
  }
  next();
});

// Validación de descuento: debe tener un descuento válido
ZTPromocionesSchema.pre('validate', function(next) {
  if (this.TipoDescuento === 'PORCENTAJE' && (!this.DescuentoPorcentaje || this.DescuentoPorcentaje <= 0)) {
    return next(new Error('Debe especificar un porcentaje de descuento válido mayor a 0'));
  }
  if (this.TipoDescuento === 'MONTO_FIJO' && (!this.DescuentoMonto || this.DescuentoMonto <= 0)) {
    return next(new Error('Debe especificar un monto de descuento válido mayor a 0'));
  }
  next();
});

// Exportar el modelo
module.exports = mongoose.model('ZTPROMOCIONES', ZTPromocionesSchema, 'ZTPROMOCIONES');