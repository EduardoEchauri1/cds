import multer from 'multer';

const upload = multer({
  dest: 'uploads/',
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB
});

export const uploadMiddleware = upload.single('file');
