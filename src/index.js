// import express, { Express, Request, Response, NextFunction } from 'express';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import { pool, checkConnection } from './db/configDB.js';
import routes from './routes/index.js';
import {
  tblAccountTypes,
  tblCurrencies,
  tblUserRoles,
} from './db/populateDB.js';

dotenv.config();
// interface CustomError extends Error {status?:number}
// type CustomError = Error & { status?: number };
// const app: Express = express();
const app = express();
app.disable('x-powered-by');
// const {
//   DB_USER,
//   DB_NAME,
//   DB_PASSWORD,
//   DB_PORT,
//   // PORT,
//   JWT_SECRET,
//   NODE_ENV,
// } = process.env;
// console.log(DB_USER, DB_NAME, DB_PASSWORD, DB_PORT, JWT_SECRET, NODE_ENV);

const PORT = parseInt(process.env.PORT ?? '5000');

//Middlewares
app.use(cors());
app.use(helmet());
app.use(morgan('dev'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

app.use(
  cors({
    origin: (origin, callback) => {
      const ACCEPTED_ORIGINS = [
        'http://localhost:5000',
        'http://localhost:3001',
        'http://localhost:8080',
        'http://localhost:1234',
        'http://localhost:5432',
      ];
      if (!origin || ACCEPTED_ORIGINS.includes(origin)) {
        return callback(null, true);
      }
      console.error('CORS error: Origin not allowed', origin);

      return callback(
        new Error('Your address is not an accepted origin CORS'),
        false
      );
    },
    credentials: true, // Allow to send cookies
  })
);
// app.use(cors('*'));
//allow cross origin sharing request
app.use(helmet.crossOriginResourcePolicy({ policy: 'cross-origin' }));
app.use(cookieParser());
//initiate
console.log('message', 'Hola Mundo');

//------------------
// Función para inicializar la base de datos
async function initializeDatabase() {
  try {
    console.log('Verificando si la base de datos necesita inicialización...');

    // Initialize currencies table
    await tblCurrencies();
    await tblUserRoles();
    await tblAccountTypes();

    console.log('Base de datos inicializada correctamente.');
  } catch (error) {
    console.error(
      'Error durante la inicialización de la base de datos:',
      error
    );
    throw error; // Relanzar el error para manejarlo en el nivel superior
  }
}

// Inicializar la base de datos y luego iniciar el servidor

await checkConnection();
await initializeDatabase()
  .then(() => {
    // Iniciar el servidor
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`Server running on port ${PORT}`);
    });
  })
  .catch((error) => {
    console.error('Error crítico durante la inicialización:', error);
    process.exit(1); // Salir del proceso si hay un error crítico
  });

pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
  // Termina la aplicación si hay un error grave
  // process.exit(-1);
});
//------------------
//Middleware route handling
app.use('/api', routes);

//------------------
//verificar donde o cuando cerrar la conexion con la base de datos
// app.use('*', (req, res) => {
//   res.status(404).json({ error: '404', message: 'not found' });
// });

//message error handling
// app.use((err: CustomError, req: Request, res: Response, next: NextFunction) => {
app.use((err, req, res) => {
  console.log('error handled, response ');
  const errorStatus = err.status || 500;
  res.status(errorStatus).json({
    message: err.message || 'there was an error',
    status: errorStatus,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
  });
});
