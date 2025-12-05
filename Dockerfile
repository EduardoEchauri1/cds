# 1. ETAPA BASE: Usa una imagen de Node.js ligera (slim)
# La versión 20.x coincide con tus requisitos de motor (engines)
FROM node:20-slim

# 2. DIRECTORIO DE TRABAJO: Define el directorio de la aplicación
WORKDIR /usr/src/app

# 3. COPIA DE METADATOS: Copia solo package.json y package-lock.json
# Esto permite que la capa de instalación de dependencias se cachee
COPY package*.json ./

# 4. INSTALACIÓN DE DEPENDENCIAS: Instala solo las dependencias de producción
# Esto asegura una imagen final más pequeña, ya que las dependencias de desarrollo no son necesarias
RUN npm install --production

# 5. COPIA DE CÓDIGO: Copia el resto del código fuente del proyecto
# Esto incluye server.js, .cdsrc.json, y todos tus archivos CDS/JS
COPY . .

# 6. PUERTO: Define el puerto interno que Express/CAP usará
# Azure Container Apps (ACA) o App Service usará esta información.
# Tu server.js está configurado para usar process.env.PORT, pero este es el puerto interno por defecto.
EXPOSE 8080

# 7. COMANDO DE INICIO: Ejecuta el script 'start' definido en tu package.json
# Esto ejecutará 'cds run', lo cual levantará tu servidor Express personalizado.
CMD [ "npm", "start" ]